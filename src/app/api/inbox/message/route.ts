// /api/inbox/message — captures buyer inquiries from the listed-property
// popup. Locked 2026-05-30. Every Call / Email / Message / Tour button
// on the public-layer Tier 1 popup POSTs here. Routes to Position
// Realty (the brokerage entity that operates inside Plot Maps per
// project-plot-maps-position-hierarchy + project-two-layer-audience-strategy).
//
// Two side effects:
//   1. Best-effort insert into the public_inquiries table with kind
//      'buyer-inquiry' for later admin inbox UI
//   2. Email Greg via Resend so the inquiry hits his inbox immediately,
//      regardless of DB state
//
// Public route — no auth required. The public layer must work without
// signup (per project-landing-search-first-no-gate).
//
// Hardening:
//   - Per-IP rate limit (in-memory token bucket; replace with Redis at scale)
//   - Bounded payload sizes
//   - Honeypot field
//   - Required: action + listing_id (or listing_address). Optional:
//     buyer's name/phone/email/message (filled when the buyer provides them)

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';
const TO_EMAIL = process.env.INQUIRY_TO_EMAIL || 'gregfranklin523@gmail.com';

type InquiryAction = 'call' | 'email' | 'message' | 'tour';

interface InboxPayload {
  action?: InquiryAction;
  listing_id?: string;
  listing_address?: string;
  listing_price?: number;
  listing_status?: string;
  listing_agent?: string;
  listing_brokerage?: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_email?: string;
  buyer_message?: string;
  // Honeypot — must be empty
  website?: string;
}

const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 12;
const WINDOW_MS = 10 * 60 * 1000;

function takeToken(ip: string): boolean {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now >= b.refillAt) {
    BUCKETS.set(ip, { tokens: MAX_TOKENS - 1, refillAt: now + WINDOW_MS });
    return true;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}

function validAction(a: string | undefined): a is InquiryAction {
  return a === 'call' || a === 'email' || a === 'message' || a === 'tour';
}

function buildSubject(p: InboxPayload): string {
  const verb =
    p.action === 'call' ? 'Call request' :
    p.action === 'email' ? 'Email inquiry' :
    p.action === 'tour' ? 'Tour request' :
    'Message';
  const addr = p.listing_address || 'a listing';
  return `Plot Maps · ${verb} on ${addr}`;
}

function buildBody(p: InboxPayload): string {
  const lines: string[] = [];
  lines.push(`Action: ${p.action}`);
  if (p.listing_id) lines.push(`Listing ID: ${p.listing_id}`);
  if (p.listing_address) lines.push(`Address: ${p.listing_address}`);
  if (p.listing_price) lines.push(`Price: $${p.listing_price.toLocaleString()}`);
  if (p.listing_status) lines.push(`Status: ${p.listing_status}`);
  if (p.listing_agent) lines.push(`Listing agent: ${p.listing_agent}`);
  if (p.listing_brokerage) lines.push(`Listing brokerage: ${p.listing_brokerage}`);
  lines.push('');
  if (p.buyer_name || p.buyer_phone || p.buyer_email) {
    lines.push('Buyer:');
    if (p.buyer_name) lines.push(`  Name: ${p.buyer_name}`);
    if (p.buyer_phone) lines.push(`  Phone: ${p.buyer_phone}`);
    if (p.buyer_email) lines.push(`  Email: ${p.buyer_email}`);
  } else {
    lines.push('Buyer: (anonymous — no contact info provided)');
  }
  if (p.buyer_message) {
    lines.push('');
    lines.push('Message:');
    lines.push(p.buyer_message);
  }
  lines.push('');
  lines.push('--');
  lines.push('Captured by Plot Maps listing popup.');
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  let raw: InboxPayload;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Trim + bound strings
  const payload: InboxPayload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      (payload as Record<string, string>)[k] = v.trim().slice(0, 2000);
    } else if (typeof v === 'number') {
      (payload as Record<string, number>)[k] = v;
    }
  }

  if (payload.website && payload.website.length > 0) {
    // Honeypot triggered — silently accept then drop
    return NextResponse.json({ ok: true });
  }

  if (!validAction(payload.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (!payload.listing_id && !payload.listing_address) {
    return NextResponse.json({ error: 'listing_id or listing_address required' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // 1. Durable record (best-effort)
  try {
    await supabaseAdmin.from('public_inquiries').insert({
      kind: 'buyer-inquiry',
      payload: payload as unknown as Record<string, unknown>,
      ip,
      user_agent: req.headers.get('user-agent') || null,
    });
  } catch { /* silent — email is the backup */ }

  // 2. Email Greg via Resend
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        replyTo: payload.buyer_email,
        subject: buildSubject(payload),
        text: buildBody(payload),
      });
    } catch { /* silent — DB write is the backup */ }
  }

  return NextResponse.json({ ok: true });
}
