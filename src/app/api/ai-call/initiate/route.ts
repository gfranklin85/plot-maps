import { NextResponse } from 'next/server';
import { getAuthUser, getBillingContext } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { startCall } from '@/lib/vapi';
import { ASSISTANT_TEMPLATES, buildAssistantOverrides, varsToVapiVariables, type TemplateVariables } from '@/lib/ai-assistant-templates';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// Minimum estimate in minutes for budget check — a user needs at least this
// much covered (included + wallet) to START a call. Calls can go shorter or
// longer than this; we reconcile in the webhook.
const MIN_BUDGET_MINUTES = 2;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    leadId,
    phoneNumber,
    assistantKey = 'neighbor_warmth',
  }: {
    leadId?: string;
    phoneNumber: string;
    assistantKey?: string;
  } = body;

  if (!phoneNumber) {
    return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
  }

  const template = ASSISTANT_TEMPLATES[assistantKey];
  if (!template) {
    return NextResponse.json({ error: 'Unknown assistant' }, { status: 400 });
  }

  const { tier, isAdmin } = await getBillingContext(user.id);
  const month = getCurrentMonth();
  const isFree = tier.key === 'free';

  let includedRemaining = tier.aiMinutes;
  let walletBalanceCents = 0;

  if (!isAdmin) {
    // ── 1. Check included AI minutes remaining ────────────────────────────
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

    includedRemaining = Math.max(0, tier.aiMinutes - aiUsed);

    // ── 2. Check wallet balance if user may exceed included ──────────────
    // Enforce minimum budget: user must have at least MIN_BUDGET_MINUTES covered.
    const minutesShortfall = Math.max(0, MIN_BUDGET_MINUTES - includedRemaining);

    if (minutesShortfall > 0) {
      if (isFree || tier.aiOverageCentsPerMin === 0) {
        return NextResponse.json({
          error: 'limit_reached',
          message: `You've used your AI minutes. Upgrade your plan to continue.`,
          upgrade: true,
          tier: tier.key,
          ai_minutes_remaining: includedRemaining,
          ai_minutes_limit: tier.aiMinutes,
        }, { status: 402 });
      }

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance_cents')
        .eq('user_id', user.id)
        .single();
      walletBalanceCents = Number(wallet?.balance_cents || 0);

      const minRequiredCents = minutesShortfall * tier.aiOverageCentsPerMin;
      if (walletBalanceCents < minRequiredCents) {
        return NextResponse.json({
          error: 'insufficient_balance',
          message: `You have ${includedRemaining} AI minutes left. A ${MIN_BUDGET_MINUTES}-minute call requires $${(minRequiredCents / 100).toFixed(2)} in your wallet. Top up to continue.`,
          needs_topup: true,
          tier: tier.key,
          ai_minutes_remaining: includedRemaining,
          overage_per_min_cents: tier.aiOverageCentsPerMin,
          wallet_balance_cents: walletBalanceCents,
          min_required_cents: minRequiredCents,
        }, { status: 402 });
      }
    }
  }

  // ── 3. Gather lead + profile + nearest comp for template variables ──────
  const [leadRes, profileRes] = await Promise.all([
    leadId
      ? supabaseAdmin.from('leads').select('*').eq('id', leadId).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('profiles')
      .select('full_name, company, ai_custom_opening')
      .eq('id', user.id)
      .single(),
  ]);

  const lead = leadRes.data as {
    latitude?: number | null;
    longitude?: number | null;
    property_address?: string | null;
    city?: string | null;
    owner_name?: string | null;
    name?: string | null;
  } | null;
  const profile = profileRes.data as {
    full_name?: string | null;
    company?: string | null;
    ai_custom_opening?: string | null;
  } | null;

  const agentFirstName = (profile?.full_name || user.email || 'your agent').split(' ')[0];
  const agentCompany = profile?.company || 'Plot Maps';
  const ownerFirstName = (() => {
    const full = lead?.owner_name || lead?.name || '';
    const first = full.split(' ')[0];
    return first || null;
  })();

  // Find nearest Sold comp within ~1 mile (rough bbox) to reference in the opener
  let nearestComp: {
    property_address?: string | null;
    selling_price?: number | null;
    dom?: number | null;
    sqft?: number | null;
  } | null = null;

  if (lead?.latitude != null && lead?.longitude != null) {
    // Rough degree box: 0.015 deg ≈ 1 mile latitude, wider at higher lat but close enough for Central CA
    const latMin = lead.latitude - 0.015;
    const latMax = lead.latitude + 0.015;
    const lngMin = lead.longitude - 0.02;
    const lngMax = lead.longitude + 0.02;

    const { data: comps } = await supabaseAdmin
      .from('leads')
      .select('property_address, selling_price, dom, sqft, selling_date, latitude, longitude')
      .eq('listing_status', 'Sold')
      .gte('latitude', latMin)
      .lte('latitude', latMax)
      .gte('longitude', lngMin)
      .lte('longitude', lngMax)
      .not('selling_price', 'is', null)
      .order('selling_date', { ascending: false })
      .limit(5);

    nearestComp = comps?.[0] || null;
  }

  const formatPrice = (p?: number | null): string | null => {
    if (!p) return null;
    if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)} million`;
    return `$${Math.round(p / 1000)}K`;
  };

  const ppsf = (() => {
    if (!nearestComp?.selling_price || !nearestComp?.sqft || nearestComp.sqft <= 0) return null;
    return `$${Math.round(nearestComp.selling_price / nearestComp.sqft)} per square foot`;
  })();

  const templateVars: TemplateVariables = {
    agent_first_name: agentFirstName,
    agent_company: agentCompany,
    owner_first_name: ownerFirstName,
    reference_address: nearestComp?.property_address?.split(',')[0] || null,
    sold_price: formatPrice(nearestComp?.selling_price),
    dom: nearestComp?.dom != null ? `${nearestComp.dom} days` : null,
    ppsf,
    property_city: lead?.city || null,
    custom_opening: profile?.ai_custom_opening || null,
  };

  const overrides = buildAssistantOverrides(template, templateVars);

  // ── 4. Resolve assistant ID from env (mapped per template key) ──────────
  // Assistants are created once via `scripts/create-vapi-assistants.ts` and
  // their IDs are stored as env vars like VAPI_ASSISTANT_NEIGHBOR_WARMTH.
  const envKey = `VAPI_ASSISTANT_${assistantKey.toUpperCase()}`;
  const assistantId = process.env[envKey];
  if (!assistantId) {
    return NextResponse.json({
      error: 'assistant_not_provisioned',
      message: `Assistant "${assistantKey}" hasn't been provisioned in VAPI yet. Run the setup script.`,
    }, { status: 500 });
  }

  // ── 5. Start the VAPI call ──────────────────────────────────────────────
  let vapiCall;
  try {
    vapiCall = await startCall({
      assistantId,
      phoneNumber,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      assistantOverrides: {
        firstMessage: overrides.firstMessage,
        variableValues: varsToVapiVariables(templateVars),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'VAPI call failed';
    console.error('VAPI startCall error:', err);
    return NextResponse.json({ error: 'vapi_start_failed', message }, { status: 500 });
  }

  // ── 6. Record the call in our DB ────────────────────────────────────────
  const { data: aiCallRow } = await supabaseAdmin
    .from('ai_calls')
    .insert({
      user_id: user.id,
      lead_id: leadId || null,
      vapi_call_id: vapiCall.id,
      assistant_id: assistantId,
      assistant_key: assistantKey,
      assistant_name: template.label,
      phone_called: phoneNumber,
      status: 'initiating',
    })
    .select('id')
    .single();

  return NextResponse.json({
    id: aiCallRow?.id,
    vapi_call_id: vapiCall.id,
    monitor_listen_url: vapiCall.monitor?.listenUrl || null,
    monitor_control_url: vapiCall.monitor?.controlUrl || null,
    first_message: overrides.firstMessage,
    included_remaining: includedRemaining,
    wallet_balance_cents: walletBalanceCents,
    overage_per_min_cents: tier.aiOverageCentsPerMin,
  });
}
