import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyWebhookSignature } from '@/lib/vapi';
import { getTier, ADMIN_TIER } from '@/lib/tier-config';
import { logCost } from '@/lib/cost-tracker';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// VAPI cost per minute to log internally (our actual cost, not what we charge)
const VAPI_REAL_COST_PER_MIN = 0.18;

const INTENT_KEYWORDS: [string, string][] = [
  ['curious', 'curious'],
  ['maybe this year', 'maybe_this_year'],
  ['thinking about', 'maybe_this_year'],
  ['settled', 'settled_for_now'],
  ['not interested', 'not_interested'],
  ['wrong number', 'wrong_number'],
  ['call back', 'call_back_later'],
  ['no answer', 'no_answer'],
  ['voicemail', 'voicemail'],
  ['left a message', 'voicemail'],
];

function parseIntentFromSummary(summary: string): string | null {
  if (!summary) return null;
  const lower = summary.toLowerCase();
  for (const [keyword, intent] of INTENT_KEYWORDS) {
    if (lower.includes(keyword)) return intent;
  }
  return null;
}

interface VapiWebhookMessage {
  type: string;
  call?: {
    id: string;
    status?: string;
    startedAt?: string;
    endedAt?: string;
    endedReason?: string;
    cost?: number;
    costBreakdown?: Record<string, number>;
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
  };
  // VAPI sends different shapes depending on event — we only read a few fields
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-vapi-secret') || request.headers.get('authorization');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { message?: VapiWebhookMessage };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const msg = payload.message;
  if (!msg) return NextResponse.json({ ok: true });

  const vapiCallId = msg.call?.id;
  if (!vapiCallId) return NextResponse.json({ ok: true });

  // Look up our AI call record
  const { data: aiCall } = await supabaseAdmin
    .from('ai_calls')
    .select('id, user_id, lead_id, status, vapi_call_id, campaign_id')
    .eq('vapi_call_id', vapiCallId)
    .single();

  if (!aiCall) {
    // Not one of ours — ignore
    return NextResponse.json({ ok: true });
  }

  // ── status updates ──────────────────────────────────────────────────────
  if (msg.type === 'status-update' && msg.call?.status) {
    const statusMap: Record<string, string> = {
      queued: 'initiating',
      ringing: 'ringing',
      'in-progress': 'in-call',
      forwarding: 'in-call',
      ended: 'ended',
    };
    const mapped = statusMap[msg.call.status] || aiCall.status;
    await supabaseAdmin
      .from('ai_calls')
      .update({ status: mapped, updated_at: new Date().toISOString() })
      .eq('id', aiCall.id);
    return NextResponse.json({ ok: true });
  }

  // ── end-of-call-report: finalize billing and usage ──────────────────────
  if (msg.type === 'end-of-call-report' || msg.type === 'call.ended') {
    const call = msg.call;
    if (!call) return NextResponse.json({ ok: true });

    const startedAt = call.startedAt ? new Date(call.startedAt).getTime() : Date.now();
    const endedAt = call.endedAt ? new Date(call.endedAt).getTime() : Date.now();
    const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
    const minutesBilled = Math.ceil(durationSeconds / 60);

    // Determine billing split from tier + current usage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status, stripe_price_id, is_admin')
      .eq('id', aiCall.user_id)
      .single();

    const isAdmin = !!profile?.is_admin;
    const tier = isAdmin
      ? ADMIN_TIER
      : getTier(profile?.subscription_status || null, profile?.stripe_price_id || null);
    const isFree = tier.key === 'free';
    const month = getCurrentMonth();

    // Admins never consume credits or wallet balance
    let fromIncluded = 0;
    let fromOverage = 0;
    let overageCents = 0;

    if (!isAdmin) {
      // Current AI minutes used (lifetime for free, monthly otherwise)
      let aiUsed = 0;
      if (isFree) {
        const { data: allUsage } = await supabaseAdmin
          .from('usage_tracking')
          .select('ai_minutes_used')
          .eq('user_id', aiCall.user_id);
        aiUsed = (allUsage || []).reduce((s, r) => s + Number(r.ai_minutes_used || 0), 0);
      } else {
        const { data: usage } = await supabaseAdmin
          .from('usage_tracking')
          .select('ai_minutes_used')
          .eq('user_id', aiCall.user_id)
          .eq('month', month)
          .single();
        aiUsed = Number(usage?.ai_minutes_used || 0);
      }

      const includedRemaining = Math.max(0, tier.aiMinutes - aiUsed);
      fromIncluded = Math.min(minutesBilled, includedRemaining);
      fromOverage = minutesBilled - fromIncluded;
      overageCents = fromOverage * tier.aiOverageCentsPerMin;

      // Increment included usage
      if (fromIncluded > 0) {
        const { data: existing } = await supabaseAdmin
          .from('usage_tracking')
          .select('id, ai_minutes_used')
          .eq('user_id', aiCall.user_id)
          .eq('month', month)
          .single();

        if (existing) {
          await supabaseAdmin
            .from('usage_tracking')
            .update({
              ai_minutes_used: Number(existing.ai_minutes_used || 0) + fromIncluded,
              ai_minutes_limit: tier.aiMinutes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabaseAdmin
            .from('usage_tracking')
            .insert({
              user_id: aiCall.user_id,
              month,
              ai_minutes_used: fromIncluded,
              ai_minutes_limit: tier.aiMinutes,
              geocodes_used: 0,
              geocodes_limit: tier.geocodes,
              skip_traces_used: 0,
              skip_traces_limit: tier.skipTraces,
            });
        }
      }
    }

    // Deduct overage from wallet
    if (overageCents > 0) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id, balance_cents, total_spent_cents')
        .eq('user_id', aiCall.user_id)
        .single();

      if (wallet) {
        const newBalance = Math.max(0, Number(wallet.balance_cents || 0) - overageCents);
        await supabaseAdmin
          .from('wallets')
          .update({
            balance_cents: newBalance,
            total_spent_cents: Number(wallet.total_spent_cents || 0) + overageCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);

        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: aiCall.user_id,
          type: 'spend',
          amount_cents: overageCents,
          balance_after_cents: newBalance,
          description: `AI call overage — ${fromOverage} min`,
          metadata: {
            ai_call_id: aiCall.id,
            vapi_call_id: vapiCallId,
            overage_rate_cents: tier.aiOverageCentsPerMin,
            minutes: fromOverage,
          },
        });
      }
    }

    // Log real VAPI cost for internal tracking
    logCost(aiCall.user_id, 'vapi', 'call_minute', VAPI_REAL_COST_PER_MIN * minutesBilled, minutesBilled, {
      vapi_call_id: vapiCallId,
      ai_call_id: aiCall.id,
    });

    // Parse intent from summary if available
    const intentLabel = parseIntentFromSummary(call.summary || '');
    const answered = durationSeconds > 10;

    // Finalize the ai_calls row
    await supabaseAdmin
      .from('ai_calls')
      .update({
        status: 'ended',
        duration_seconds: durationSeconds,
        minutes_billed: minutesBilled,
        from_included: fromIncluded,
        from_overage_cents: overageCents,
        outcome: call.endedReason || null,
        transcript: call.transcript ? { raw: call.transcript } : null,
        summary: call.summary || null,
        ended_at: new Date(endedAt).toISOString(),
        ...(intentLabel ? { intent_label: intentLabel } : {}),
      })
      .eq('id', aiCall.id);

    // Campaign-specific: update prospect status + campaign stats
    if (aiCall.campaign_id) {
      await supabaseAdmin
        .from('campaign_prospects')
        .update({ call_status: 'completed' })
        .eq('ai_call_id', aiCall.id);

      const { data: camp } = await supabaseAdmin
        .from('campaigns')
        .select('calls_made, calls_answered')
        .eq('id', aiCall.campaign_id)
        .single();
      if (camp) {
        await supabaseAdmin
          .from('campaigns')
          .update({
            calls_made: (camp.calls_made || 0) + 1,
            calls_answered: answered ? (camp.calls_answered || 0) + 1 : (camp.calls_answered || 0),
            updated_at: new Date().toISOString(),
          })
          .eq('id', aiCall.campaign_id);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // Other message types: transcript chunks, tool calls, etc.
  // We don't persist them here — the UI polls /api/ai-call/status for live transcript.
  return NextResponse.json({ ok: true });
}
