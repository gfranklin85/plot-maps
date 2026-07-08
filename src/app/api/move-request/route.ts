import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

// POST /api/move-request
//
// The onramp save: an ad visitor completes "Post a move request" (/post) with
// NO account, and this persists it — a `wants` row (visibility='private': the
// trust sequence is private draft → verified → public) plus `want_amenities`
// tag rows from the amenity vocabulary. No auth required (bullpen pattern);
// if a session exists we stamp user_id. Contact is a soft optional ask so a
// match can reach them. Returns { id } — the client keeps it for the later
// claim/verification (Prompt 2). memory/the_thesis (the want-map; Commercial
// #1 "Post What You Want").

export const dynamic = 'force-dynamic';
// supabase-js .select() is a GET under Next's patched fetch — force no-store
// so this route never serves stale data (see the_facts gotcha).
export const fetchCache = 'force-no-store';

// GET /api/move-request?id=<uuid>
//
// The My Move Request page's data: the want (the uuid is the bearer credential)
// + its amenity tags + DIRECT connections + multi-party MOVE PATHS (webs, not
// swaps) + the live active-request count. The want joins the match graph even
// while private — "private at first, structured for matching."
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const [wantRes, tagRes, destRes, directRes, pathsRes, countRes] = await Promise.all([
    supabaseAdmin.from('wants').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('want_amenities')
      .select('amenity_slug, amenities(label, icon)')
      .eq('want_id', id),
    supabaseAdmin.from('want_destinations')
      .select('id, label, lat, lng, is_fuzzy, priority')
      .eq('want_id', id)
      .order('priority', { ascending: true }),
    supabaseAdmin.rpc('connections_for_want', { _want_id: id, _radius_km: 1200 }),
    supabaseAdmin.rpc('paths_for_want', { _want_id: id, _radius_km: 400, _max_len: 4 }),
    supabaseAdmin.from('wants').select('id', { count: 'exact', head: true }).eq('visibility', 'public'),
  ]);

  if (wantRes.error || !wantRes.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Dedupe direct connections by the other poster (a person can appear
  // inbound AND outbound) — keep the strongest, note mutuality.
  type Direct = {
    other_id: string; other_label: string; other_to_label: string;
    other_move_condition: string | null; direction: string;
    matched_destination: string | null;
    match_pct: number; mutual: boolean; shared_tags: string[] | null;
  };
  const best = new Map<string, Direct>();
  for (const d of ((directRes.data ?? []) as Direct[])) {
    const prev = best.get(d.other_id);
    if (!prev || d.match_pct > prev.match_pct) best.set(d.other_id, d);
  }

  return NextResponse.json({
    want: wantRes.data,
    // Supabase types the joined relation as an array; it's a to-one join.
    tags: (tagRes.data ?? []).map((t) => {
      const rel = Array.isArray(t.amenities) ? t.amenities[0] : t.amenities;
      const a = rel as { label?: string; icon?: string | null } | null;
      return { slug: t.amenity_slug as string, label: a?.label ?? (t.amenity_slug as string), icon: a?.icon ?? null };
    }),
    destinations: destRes.data ?? [],
    direct: Array.from(best.values()).sort((a, b) => b.match_pct - a.match_pct),
    paths: (pathsRes.data ?? []) as Array<{ chain: string[]; labels: string[]; chain_len: number }>,
    activeCount: countRes.count ?? 0,
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const str = (v: unknown, max = 400) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s.slice(0, max) : null;
  };
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: unknown) => v === true;

  // The one hard requirement: a destination (the dream leads — step 1).
  const toLabel = str(body.toLabel);
  if (!toLabel) {
    return NextResponse.json({ error: 'destination is required' }, { status: 400 });
  }

  // Best-effort session stamp.
  let userId: string | null = null;
  try {
    const user = await getAuthUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const row = {
    user_id: userId,
    owner_name: str(body.name),
    owner_contact: str(body.contact),
    // where they are now (step 4)
    from_label: str(body.fromLabel),
    from_lat: num(body.fromLat),
    from_lng: num(body.fromLng),
    // where they want to go (step 1). to_* = the PRIMARY destination; the
    // full set (wide + narrow wants: FL/GA/TN…) lands in want_destinations.
    to_label: toLabel,
    to_lat: num(body.toLat),
    to_lng: num(body.toLng),
    to_is_fuzzy: bool(body.toFuzzy) || num(body.toLat) === null,
    // occupation means everything — it determines where someone CAN go
    occupation: str(body.occupation, 160),
    industry: str(body.industry, 160),
    // comparative population anchoring ("as big as Lemoore?")
    population_anchor: ['smaller', 'same', 'bigger', 'any'].includes(String(body.populationAnchor))
      ? String(body.populationAnchor)
      : null,
    // quantified criteria (step 1 "make it concrete" + step 2)
    acres_min: num(body.acresMin),
    beds_min: num(body.bedsMin) !== null ? Math.round(num(body.bedsMin)!) : null,
    criteria_notes: str(body.criteriaNotes, 2000),
    // payment (step 3)
    target_monthly: num(body.targetMonthly),
    down_payment: num(body.downPayment),
    max_price: num(body.maxPrice),
    financing_type: str(body.financingType),
    // what they have (step 5)
    has_current_home: bool(body.hasCurrentHome),
    current_home_value: num(body.currentHomeValue),
    equity: num(body.equity),
    open_to_seller_carry: bool(body.openToSellerCarry),
    open_to_trade: bool(body.openToTrade),
    timing: str(body.timing),
    // THE question — "I'd move if X" (the gathering thesis)
    move_condition: str(body.moveCondition, 1000),
    // verification: the CHOSEN method (step 6); execution follows later.
    // Status stays 'unverified' until a method actually completes.
    verification_method: ['mail', 'document', 'agent', 'representative', 'later'].includes(String(body.verificationMethod))
      ? String(body.verificationMethod)
      : null,
    verification_status: 'unverified',
    status: 'new',
    visibility: 'private', // private draft; verification gates public
    source: 'owner',
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('wants')
    .insert(row)
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('move-request insert error:', error?.message);
    return NextResponse.json({ error: 'could not post' }, { status: 500 });
  }

  // The destination SET — every additional acceptable region ("Florida,
  // Georgia, Tennessee…", the resolved "closer to family" cities). Each row
  // is matchable; the RPCs test ANY of them. No coords = not matchable yet
  // (is_fuzzy) — but never silently dropped.
  const destinations = Array.isArray(body.destinations) ? body.destinations.slice(0, 12) : [];
  const destRows = destinations
    .map((d: unknown, i: number) => {
      const o = (d ?? {}) as Record<string, unknown>;
      const label = str(o.label, 200);
      if (!label || label === toLabel) return null;
      const lat = num(o.lat);
      const lng = num(o.lng);
      return {
        want_id: inserted.id,
        label,
        lat,
        lng,
        is_fuzzy: lat === null || lng === null,
        priority: i + 1,
      };
    })
    .filter(Boolean);
  if (destRows.length > 0) {
    const { error: destErr } = await supabaseAdmin.from('want_destinations').insert(destRows);
    if (destErr) console.error('want_destinations insert error:', destErr.message);
  }

  // Amenity tags — validate against the vocabulary so junk slugs can't land.
  const requested = Array.isArray(body.amenities)
    ? Array.from(new Set(body.amenities.map((v) => String(v).toLowerCase().trim()).filter(Boolean)))
    : [];
  if (requested.length > 0) {
    const { data: valid } = await supabaseAdmin
      .from('amenities')
      .select('slug')
      .in('slug', requested);
    const slugs = (valid ?? []).map((a: { slug: string }) => a.slug);
    if (slugs.length > 0) {
      const { error: tagErr } = await supabaseAdmin
        .from('want_amenities')
        .insert(slugs.map((slug) => ({ want_id: inserted.id, amenity_slug: slug })));
      if (tagErr) console.error('want_amenities insert error:', tagErr.message);
    }
  }

  return NextResponse.json({ id: inserted.id });
}

// PATCH /api/move-request — the AFTER-post soft ask: "Where should we send
// matches?" Attaches contact (email/phone) + optional name to a just-posted
// move request. The uuid is the bearer credential (only the poster's browser
// has it — it was returned by their POST). No account wall.
export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
  // My Move Request page controls: pause/resume + switch verification method.
  const status = typeof body.status === 'string' && ['new', 'paused'].includes(body.status) ? body.status : null;
  const method = typeof body.verificationMethod === 'string'
    && ['mail', 'document', 'agent', 'representative', 'later'].includes(body.verificationMethod)
    ? body.verificationMethod : null;
  if (!id || (!contact && !status && !method)) {
    return NextResponse.json({ error: 'id and a field required' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('wants')
    .update({
      ...(contact ? { owner_contact: contact } : {}),
      ...(name ? { owner_name: name } : {}),
      ...(status ? { status } : {}),
      ...(method ? { verification_method: method } : {}),
    })
    .eq('id', id);
  if (error) {
    console.error('move-request contact error:', error.message);
    return NextResponse.json({ error: 'could not save contact' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
