import { NextResponse } from 'next/server';
import { getAuthUser, getBillingContext } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { startCall } from '@/lib/vapi';
import { composeCampaignCall } from '@/lib/campaign-prompts';
import type { Lead } from '@/types';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const MIN_BUDGET_MINUTES = 2;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Load campaign + verify ownership
  const { data: campaign, error: campError } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
  }

  // Get next pending prospect
  const { data: nextProspect } = await supabaseAdmin
    .from('campaign_prospects')
    .select('*, lead:leads(*)')
    .eq('campaign_id', id)
    .eq('call_status', 'pending')
    .order('priority', { ascending: false })
    .order('call_order', { ascending: true })
    .limit(1)
    .single();

  if (!nextProspect || !nextProspect.lead) {
    return NextResponse.json({ error: 'No more prospects to call' }, { status: 404 });
  }

  const prospect = nextProspect.lead as Lead;

  if (!prospect.phone) {
    // Skip prospects without phone
    await supabaseAdmin
      .from('campaign_prospects')
      .update({ call_status: 'skipped' })
      .eq('id', nextProspect.id);
    return NextResponse.json({ error: 'Prospect has no phone number, skipped' }, { status: 400 });
  }

  // ── Billing check ──────────────────────────────────────────────────────
  const { tier, isAdmin } = await getBillingContext(user.id);
  const month = getCurrentMonth();
  const isFree = tier.key === 'free';

  if (!isAdmin) {
    let aiUsed = 0;
    if (isFree) {
      const { data: allUsage } = await supabaseAdmin
        .from('usage_tracking')
        .select('ai_minutes_used')
        .eq('user_id', user.id);
      aiUsed = (allUsage || []).reduce((s, r) => s + Number(r.ai_minutes_used || 0), 0);
    } else {
      const { data: usage } = await supabaseAdmin
        .from('usage_tracking')
        .select('ai_minutes_used')
        .eq('user_id', user.id)
        .eq('month', month)
        .single();
      aiUsed = Number(usage?.ai_minutes_used || 0);
    }

    const includedRemaining = Math.max(0, tier.aiMinutes - aiUsed);
    const minutesShortfall = Math.max(0, MIN_BUDGET_MINUTES - includedRemaining);

    if (minutesShortfall > 0) {
      if (isFree || tier.aiOverageCentsPerMin === 0) {
        return NextResponse.json({
          error: 'limit_reached',
          message: "You've used your AI minutes. Upgrade your plan to continue.",
          upgrade: true,
        }, { status: 402 });
      }

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance_cents')
        .eq('user_id', user.id)
        .single();
      const walletCents = Number(wallet?.balance_cents || 0);
      const minRequired = minutesShortfall * tier.aiOverageCentsPerMin;

      if (walletCents < minRequired) {
        return NextResponse.json({
          error: 'insufficient_balance',
          message: `Need $${(minRequired / 100).toFixed(2)} in wallet for overage. Top up to continue.`,
          needs_topup: true,
        }, { status: 402 });
      }
    }
  }

  // ── Load reference leads ───────────────────────────────────────────────
  const refIds: string[] = campaign.reference_lead_ids || [];
  const { data: refLeads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .in('id', refIds);

  if (!refLeads || refLeads.length === 0) {
    return NextResponse.json({ error: 'Reference properties not found' }, { status: 500 });
  }

  // ── Load profile ───────────────────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, company')
    .eq('id', user.id)
    .single();

  // ── Compose prompt ─────────────────────────────────────────────────────
  const composition = composeCampaignCall(campaign, prospect, refLeads, profile || {});

  // ── Resolve VAPI assistant ID ──────────────────────────────────────────
  const assistantId = process.env.VAPI_ASSISTANT_NEIGHBOR_WARMTH;
  if (!assistantId) {
    return NextResponse.json({ error: 'VAPI assistant not provisioned' }, { status: 500 });
  }

  // ── Mark prospect as calling ───────────────────────────────────────────
  await supabaseAdmin
    .from('campaign_prospects')
    .update({ call_status: 'calling' })
    .eq('id', nextProspect.id);

  // ── Start VAPI call ────────────────────────────────────────────────────
  let vapiCall;
  try {
    vapiCall = await startCall({
      assistantId,
      phoneNumber: prospect.phone,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      assistantOverrides: {
        firstMessage: composition.firstMessage,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          messages: [{ role: 'system', content: composition.systemPrompt }],
        },
      },
      metadata: {
        campaignId: id,
        referenceLeadId: composition.referenceLeadId,
        hookVariant: composition.hookVariantUsed,
      },
    });
  } catch (err) {
    await supabaseAdmin
      .from('campaign_prospects')
      .update({ call_status: 'failed' })
      .eq('id', nextProspect.id);

    const message = err instanceof Error ? err.message : 'VAPI call failed';
    return NextResponse.json({ error: 'vapi_start_failed', message }, { status: 500 });
  }

  // ── Record in ai_calls ─────────────────────────────────────────────────
  const { data: aiCallRow } = await supabaseAdmin
    .from('ai_calls')
    .insert({
      user_id: user.id,
      lead_id: prospect.id,
      vapi_call_id: vapiCall.id,
      assistant_id: assistantId,
      assistant_key: 'campaign_' + id,
      assistant_name: campaign.assistant_name,
      phone_called: prospect.phone,
      status: 'initiating',
      campaign_id: id,
      reference_lead_id: composition.referenceLeadId,
      hook_variant_used: composition.hookVariantUsed,
    })
    .select('id')
    .single();

  // Link ai_call to campaign_prospect
  if (aiCallRow) {
    await supabaseAdmin
      .from('campaign_prospects')
      .update({ ai_call_id: aiCallRow.id })
      .eq('id', nextProspect.id);
  }

  return NextResponse.json({
    ai_call_id: aiCallRow?.id,
    vapi_call_id: vapiCall.id,
    monitor_listen_url: vapiCall.monitor?.listenUrl || null,
    first_message: composition.firstMessage,
    hook_variant_used: composition.hookVariantUsed,
    reference_lead_id: composition.referenceLeadId,
    prospect_name: prospect.owner_name || prospect.name || 'Unknown',
    prospect_address: prospect.property_address,
  });
}
