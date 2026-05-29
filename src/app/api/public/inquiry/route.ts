// Public inquiry endpoint — receives submissions from the three public
// forms (Contact, Join Position, Request Market). NO auth required —
// these forms are accessible without an account by design.
//
// Locked 2026-05-29. See:
//   memory/project_landing_search_first_no_gate.md
//   memory/project_plot_maps_position_hierarchy.md
//
// Two side effects per submission:
//   1. Insert into public_inquiries table (if migration applied) for
//      durable record + future agent CRM
//   2. Email Greg via Resend so the inquiry hits his inbox immediately
//      regardless of CRM state
//
// Routing:
//   POST /api/public/inquiry
//   { kind: 'contact'|'agent'|'market', ...payload }
//
// Convenience wrappers at /api/public/contact, /api/public/agent-inquiry,
// /api/public/market-request just call this with the matching kind.
//
// Hardening:
//   - Bounded payload sizes (defends against junk submissions)
//   - Per-IP rate limit (in-memory; replace with Redis at scale)
//   - Honeypot field ignored on the form side; checked here

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';
const TO_EMAIL = process.env.INQUIRY_TO_EMAIL || 'gregfranklin523@gmail.com';

type InquiryKind = 'contact' | 'agent' | 'market';

interface InquiryPayload {
  kind?: InquiryKind;
  name?: string;
  email?: string;
  phone?: string;
  // Contact
  topic?: string;
  message?: string;
  // Agent
  license_number?: string;
  market?: string;
  current_brokerage?: string;
  what_building?: string;
  // Market
  query?: string;
  notes?: string;
  // Honeypot — must be empty
  website?: string;
}

const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 6;
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

function validate(payload: InquiryPayload): { ok: true; kind: InquiryKind } | { ok: false; error: string } {
  if (payload.website && payload.website.length > 0) {
    // Honeypot triggered — silently accept then drop
    return { ok: false, error: 'Invalid submission' };
  }
  const kind = payload.kind;
  if (kind !== 'contact' && kind !== 'agent' && kind !== 'market') {
    return { ok: false, error: 'Unknown inquiry kind' };
  }
  if (kind === 'contact') {
    if (!payload.name || !payload.email || !payload.message) {
      return { ok: false, error: 'Name, email, and message are required' };
    }
  } else if (kind === 'agent') {
    if (!payload.name || !payload.email || !payload.license_number) {
      return { ok: false, error: 'Name, email, and license number are required' };
    }
  } else if (kind === 'market') {
    if (!payload.query) {
      return { ok: false, error: 'Market query is required' };
    }
  }
  return { ok: true, kind };
}

function buildEmailSubject(kind: InquiryKind, p: InquiryPayload): string {
  if (kind === 'contact') return `Plot Maps · Contact from ${p.name ?? 'someone'}`;
  if (kind === 'agent') return `Plot Maps · Join Position inquiry from ${p.name ?? 'an agent'}`;
  return `Plot Maps · Market request: ${p.query ?? 'unknown'}`;
}

function buildEmailBody(kind: InquiryKind, p: InquiryPayload): string {
  const lines: string[] = [];
  lines.push(`Kind: ${kind}`);
  lines.push('');
  if (p.name) lines.push(`Name: ${p.name}`);
  if (p.email) lines.push(`Email: ${p.email}`);
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (kind === 'contact') {
    if (p.topic) lines.push(`Topic: ${p.topic}`);
    lines.push('');
    lines.push('Message:');
    lines.push(p.message ?? '');
  } else if (kind === 'agent') {
    if (p.license_number) lines.push(`DRE: ${p.license_number}`);
    if (p.market) lines.push(`Market: ${p.market}`);
    if (p.current_brokerage) lines.push(`Current brokerage: ${p.current_brokerage}`);
    lines.push('');
    lines.push('What they are building:');
    lines.push(p.what_building ?? '(empty)');
  } else if (kind === 'market') {
    lines.push(`Requested market: ${p.query}`);
    if (p.notes) {
      lines.push('');
      lines.push('Notes:');
      lines.push(p.notes);
    }
  }
  lines.push('');
  lines.push('--');
  lines.push('Sent from a Plot Maps public form.');
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  let raw: InquiryPayload;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Trim and bound all string fields
  const payload: InquiryPayload = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      (payload as Record<string, string>)[k] = v.trim().slice(0, 2000);
    }
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const checked = validate(payload);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  const kind = checked.kind;

  // 1. Durable record (best-effort — table may not exist yet during
  //    early launch; we don't block the user if it fails)
  try {
    await supabaseAdmin.from('public_inquiries').insert({
      kind,
      payload: payload as Record<string, unknown>,
      ip,
      user_agent: req.headers.get('user-agent') || null,
    });
  } catch {
    /* silent — we'll backfill from email if DB write fails */
  }

  // 2. Email Greg directly via Resend
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        replyTo: payload.email,
        subject: buildEmailSubject(kind, payload),
        text: buildEmailBody(kind, payload),
      });
    } catch {
      /* silent — DB write is the durable record */
    }
  }

  return NextResponse.json({ ok: true });
}
