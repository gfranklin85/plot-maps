import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';
import { sendPostcard, postgridEnvironment, type AddressInput } from '@/lib/postgrid';

// POST /api/seed/send — seed a target area with "someone wants to move here"
// postcards (Greg 2026-07-08: the empty-search growth loop). A seller whose
// search found no match routes to their target area, picks homes, and mails
// them an invitation to post their own status — turning a dead end into real
// doors knocked. Reuses the production sendPostcard layer (auth, cost logging,
// test/live env gating). Requires sign-in (seeding sends real mail + money).

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

// PostGrid defaults to TEST env unless POSTGRID_ENVIRONMENT=live — so this
// can't accidentally send real mail on deploy.
const MAX_PER_BATCH = 25;

// The return address the seed postcards mail back to (undeliverable returns).
const FROM: AddressInput = {
  companyName: 'PlotMaps by Position',
  addressLine1: '1444 N Van Ness Ave',
  city: 'Fresno',
  provinceOrState: 'CA',
  postalOrZip: '93728',
  countryCode: 'US',
};

// Front + back artwork. Simple, honest, no owner name (we don't have it and
// don't need it) — a participation invite, not a relief pitch.
function frontHTML(area: string) {
  return `<div style="font-family:Arial,sans-serif;width:100%;height:100%;box-sizing:border-box;padding:48px;background:#f4f7fc;color:#0c1322;display:flex;flex-direction:column;justify-content:center;">
    <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#1349d4;text-transform:uppercase;">PlotMaps · by Position</div>
    <div style="font-size:38px;font-weight:800;line-height:1.1;margin-top:14px;">Someone wants to move to ${area}.</div>
    <div style="font-size:20px;margin-top:16px;color:#3a4553;">Thinking of selling? You might already have a match.</div>
  </div>`;
}
function backHTML() {
  return `<div style="font-family:Arial,sans-serif;width:100%;height:100%;box-sizing:border-box;padding:44px;color:#0c1322;display:flex;flex-direction:column;justify-content:center;">
    <div style="font-size:22px;font-weight:800;line-height:1.25;">A real buyer is looking in your area right now.</div>
    <div style="font-size:15px;margin-top:14px;line-height:1.5;color:#3a4553;">PlotMaps connects people who want to move. Post where <b>you'd</b> go and what you've got — if it lines up, we make the connection. Free, private until you choose.</div>
    <div style="font-size:19px;font-weight:800;color:#1349d4;margin-top:18px;">Post yours: plot.solutions/post</div>
  </div>`;
}

interface SeedAddress {
  fullAddress?: string; streetNumber?: string; streetName?: string;
  addressLine1?: string; city?: string; state?: string; zip?: string;
}

// Parse "113 N POWELL AVE #UNIT A, LEMOORE CA 93245" → line1 / city / state /
// zip when the discrete fields aren't provided. PostGrid needs them split.
function parseFull(full?: string): { line1: string; city: string; state: string; zip: string } | null {
  if (!full) return null;
  const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const tail = parts[parts.length - 1]; // "LEMOORE CA 93245" or "CA 93245"
  // Two forms: "CITY ST ZIP" (one comma) or "…, CITY, ST ZIP" (two commas).
  let city: string, m: RegExpMatchArray | null;
  const twoPart = tail.match(/^([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i);
  if (twoPart && parts.length >= 3) {
    city = parts[parts.length - 2];
    m = twoPart; // [ , state, zip ] — city separate
    const line1 = parts.slice(0, parts.length - 2).join(', ');
    if (!line1) return null;
    return { line1, city, state: m[1].toUpperCase(), zip: m[2] };
  }
  m = tail.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i); // "CITY ST ZIP"
  if (!m) return null;
  const line1 = parts.slice(0, parts.length - 1).join(', ');
  if (!line1) return null;
  return { line1, city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] };
}

function toPgAddress(a: SeedAddress): AddressInput | null {
  let line1 = a.addressLine1
    || [a.streetNumber, a.streetName].filter(Boolean).join(' ').trim();
  let city = a.city, state = a.state, zip = a.zip;
  // Fill any gaps from the full_address string.
  if (!city || !state || !zip || !line1) {
    const p = parseFull(a.fullAddress);
    if (p) { line1 = line1 || p.line1; city = city || p.city; state = state || p.state; zip = zip || p.zip; }
  }
  if (!line1 || !city || !state || !zip) return null;
  return {
    // PostGrid needs a name OR company; residents are unknown, so address the
    // household generically (deliverable to the resident).
    companyName: 'Current Resident',
    addressLine1: line1,
    city,
    provinceOrState: state,
    postalOrZip: zip,
    countryCode: 'US',
  };
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Sign in to send' }, { status: 401 });

  let body: { wantId?: string; areaLabel?: string; addresses?: SeedAddress[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const area = (body.areaLabel || 'your area').slice(0, 80);
  const addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, MAX_PER_BATCH) : [];
  if (addresses.length === 0) {
    return NextResponse.json({ error: 'pick at least one home' }, { status: 400 });
  }

  const front = frontHTML(area);
  const back = backHTML();
  const results: { ok: boolean; to: string; id?: string; error?: string }[] = [];

  for (const raw of addresses) {
    const to = toPgAddress(raw);
    const label = raw.fullAddress || to?.addressLine1 || 'address';
    if (!to) { results.push({ ok: false, to: label, error: 'incomplete address' }); continue; }
    try {
      const pc = await sendPostcard({
        to, from: FROM, frontHTML: front, backHTML: back, size: '6x4',
        description: `PlotMaps seed — ${area}`,
        metadata: { kind: 'seed', want_id: body.wantId ?? '', area },
        userId: user.id,
      });
      results.push({ ok: true, to: label, id: pc.id });
    } catch (e) {
      results.push({ ok: false, to: label, error: e instanceof Error ? e.message : 'send failed' });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  // Record the seed batch so we can attribute growth + show it on the request.
  if (sent > 0 && body.wantId) {
    await supabaseAdmin.from('seed_batches').insert({
      want_id: body.wantId, user_id: user.id, area, count: sent,
      environment: postgridEnvironment(),
    }).then(({ error }) => { if (error) console.error('seed_batches insert:', error.message); });
  }

  return NextResponse.json({ sent, total: addresses.length, environment: postgridEnvironment(), results });
}
