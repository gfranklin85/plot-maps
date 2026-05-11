import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Twilio webhook for inbound SMS replies to Plot system text invitations.
// No auth header — Twilio is the caller.
//
// Three patterns we parse out of the body:
//   1) Bare STOP variant ("STOP", "stop", "STOPALL", etc.)
//        → channel-routing signal only. Set leads.text_declined.
//   2) "<name-token(s)> STOP" where <name-token(s)> matches leads.owner_name
//        → recipient is confirming they're the owner; same channel-routing
//          signal but we DO NOT set phone_on_record_is_bad. Future plans
//          can act on the positive identity confirmation.
//   3) "<name-token(s)> STOP" where <name-token(s)> does NOT match
//        → wrong-number recipient; phone_on_record_is_bad → mail is the
//          right next channel (re-skip-trace gives the same bad number).
//   4) Anything else → treat as a regular reply: log to property_messages,
//      mark inquiry as 'replied'.
//
// STOP keywords accepted: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT.

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);

/** Match the verification-flow normalization. Lowercase, strip
 *  non-alphanumeric except spaces, collapse whitespace, trim. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedBody {
  kind: 'bare_stop' | 'named_stop' | 'reply';
  /** For named_stop: the normalized name token(s) the recipient typed. */
  namePart?: string;
}

function parseBody(raw: string): ParsedBody {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'reply' };

  // Tokenize on whitespace; uppercase for keyword detection.
  const tokens = trimmed.split(/\s+/);
  const upperTokens = tokens.map(t => t.toUpperCase());

  // Bare STOP variant — entire body is a single STOP keyword.
  if (tokens.length === 1 && STOP_KEYWORDS.has(upperTokens[0])) {
    return { kind: 'bare_stop' };
  }

  // Named STOP variant — last token is a STOP keyword, preceded by name token(s).
  if (tokens.length >= 2 && STOP_KEYWORDS.has(upperTokens[upperTokens.length - 1])) {
    const namePart = tokens.slice(0, -1).join(' ');
    return { kind: 'named_stop', namePart: normalizeName(namePart) };
  }

  return { kind: 'reply' };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fromNumber = (formData.get('From') as string | null)?.trim() || '';
  const body = ((formData.get('Body') as string | null) || '').trim();

  if (!fromNumber) {
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // Resolve the lead by phone (server-side; never exposed to clients).
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, owner_name')
    .or(`phone.eq.${fromNumber},phone_2.eq.${fromNumber},phone_3.eq.${fromNumber}`)
    .limit(1)
    .maybeSingle();

  if (!lead) {
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  const { data: inquiry } = await supabaseAdmin
    .from('property_inquiries')
    .select('id, initiator_user_id')
    .eq('lead_id', lead.id)
    .eq('channel', 'text_invite')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!inquiry) {
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  const parsed = parseBody(body);

  // ── Bare STOP ──────────────────────────────────────────────────────
  if (parsed.kind === 'bare_stop') {
    await supabaseAdmin
      .from('leads')
      .update({ text_declined: true, text_declined_at: new Date().toISOString() })
      .eq('id', lead.id);
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'opted_out', replied_at: new Date().toISOString() })
      .eq('id', inquiry.id);
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Named STOP ─────────────────────────────────────────────────────
  if (parsed.kind === 'named_stop') {
    const deedNorm = normalizeName(lead.owner_name || '');
    const matches = !!parsed.namePart && !!deedNorm && parsed.namePart === deedNorm;
    const updates: Record<string, unknown> = {
      text_declined: true,
      text_declined_at: new Date().toISOString(),
    };
    if (!matches) {
      updates.phone_on_record_is_bad = true;
      updates.phone_on_record_is_bad_at = new Date().toISOString();
    }
    await supabaseAdmin.from('leads').update(updates).eq('id', lead.id);
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'opted_out', replied_at: new Date().toISOString() })
      .eq('id', inquiry.id);
    return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // ── Regular reply ──────────────────────────────────────────────────
  await supabaseAdmin.from('property_messages').insert({
    lead_id: lead.id,
    thread_user_id: inquiry.initiator_user_id,
    sender_role: 'system',
    body: `Owner replied to invitation: ${body}`,
  });
  await supabaseAdmin
    .from('property_inquiries')
    .update({ status: 'replied', replied_at: new Date().toISOString() })
    .eq('id', inquiry.id);

  return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
}
