import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

// /api/listings — the FREE listings marketplace (Greg, 2026-07-13).
//
// POST: post a property listing for free. The page gates on Google sign-in
// (kills spam, ties to a real account); here we stamp the session user. Only
// `address` is required. RLS locks the table to service-role, so this route is
// the single gate — it shapes what's public. Returns { id }.
//
// GET: browse public active listings (the /listings grid). ?mine=1 = the
// signed-in user's own listings. ?id=<uuid> = one listing (detail view).
//
// bullpen/move-request pattern: supabaseAdmin, best-effort auth stamp, sanitize.

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PUBLIC_COLS =
  'id, address, city, state, zip, lat, lng, apn, status, price, beds, baths, ' +
  'sqft, lot_sqft, year_built, property_type, description, photos, ' +
  'contact_name, contact_email, contact_phone, posted_by, created_at';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // ?mine=1 — the signed-in user's own listings (for their dashboard/manage)
  if (url.searchParams.get('mine') === '1') {
    let userId: string | null = null;
    try { userId = (await getAuthUser())?.id ?? null; } catch { userId = null; }
    if (!userId) return NextResponse.json({ listings: [] });
    const { data } = await supabaseAdmin
      .from('listings')
      .select(PUBLIC_COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return NextResponse.json({ listings: data ?? [] });
  }

  // ?id — one listing (detail page)
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(PUBLIC_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ listing: data });
  }

  // default — the public browse grid: public + active/pending, newest first.
  // Optional filters: ?status=, ?q= (address/city text), ?type=, ?min/max price.
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');
  const type = url.searchParams.get('type');
  const min = url.searchParams.get('min');
  const max = url.searchParams.get('max');

  let query = supabaseAdmin
    .from('listings')
    .select(PUBLIC_COLS)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && ['active', 'pending', 'sold'].includes(status)) query = query.eq('status', status);
  else query = query.in('status', ['active', 'pending']); // hide sold + drafts by default
  if (type) query = query.eq('property_type', type);
  if (q) query = query.or(`address.ilike.%${q}%,city.ilike.%${q}%`);
  const minN = min ? parseFloat(min) : null;
  const maxN = max ? parseFloat(max) : null;
  if (minN != null && Number.isFinite(minN)) query = query.gte('price', minN);
  if (maxN != null && Number.isFinite(maxN)) query = query.lte('price', maxN);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'could not load' }, { status: 500 });

  let listings = (data ?? []) as unknown as Record<string, unknown>[];

  // includeComps=1 — also surface ACTIVE MLS comps as listing rows so the
  // buyer board isn't empty while the free-post marketplace seeds. These are
  // read-only comps (id prefixed `comp:`), shaped to the same card contract.
  if (url.searchParams.get('includeComps') === '1') {
    let cq = supabaseAdmin
      .from('sold_comps')
      .select('id, address, city, state, zip, list_price, sqft, lot_acres, year_built, dom, status, lat, lng')
      .eq('status', 'A')
      .order('list_date', { ascending: false })
      .limit(200);
    if (q) cq = cq.or(`address.ilike.%${q}%,city.ilike.%${q}%`);
    const minN2 = min ? parseFloat(min) : null;
    const maxN2 = max ? parseFloat(max) : null;
    if (minN2 != null && Number.isFinite(minN2)) cq = cq.gte('list_price', minN2);
    if (maxN2 != null && Number.isFinite(maxN2)) cq = cq.lte('list_price', maxN2);
    const { data: comps } = await cq;
    const compRows = (comps ?? []).map((c) => ({
      id: `comp:${c.id}`,
      address: c.address, city: c.city, state: c.state, zip: c.zip,
      // geocoded 2026-07-14 against OUR OWN addresses table (152/165 matched
      // by street number + zip5 + street-name token — no external geocoder)
      lat: c.lat ?? null, lng: c.lng ?? null, apn: null,
      status: 'active',
      price: c.list_price, beds: null, baths: null,
      sqft: c.sqft, lot_sqft: c.lot_acres ? Math.round((c.lot_acres as number) * 43560) : null,
      year_built: c.year_built, property_type: 'single-family',
      description: null, photos: [] as string[],
      contact_name: null, contact_email: null, contact_phone: null,
      posted_by: 'agent', created_at: new Date(0).toISOString(),
      dom: c.dom,
    }));
    listings = [...listings, ...compRows];
  }

  return NextResponse.json({ listings });
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
  const intOr = (v: unknown) => {
    const n = num(v);
    return n == null ? null : Math.round(n);
  };

  // the one hard requirement: an address
  const address = str(body.address);
  if (!address) return NextResponse.json({ error: 'address is required' }, { status: 400 });

  // best-effort session stamp (page gates on Google sign-in)
  let userId: string | null = null;
  try { userId = (await getAuthUser())?.id ?? null; } catch { userId = null; }

  const photos = Array.isArray(body.photos)
    ? body.photos.filter((p) => typeof p === 'string').slice(0, 24)
    : [];

  const propertyType = str(body.propertyType);
  const validTypes = ['single-family', 'condo', 'land', 'multi', 'manufactured', 'townhouse', 'other'];

  const row = {
    user_id: userId,
    posted_by: str(body.postedBy) === 'agent' ? 'agent' : 'owner',
    apn: str(body.apn, 60),
    address,
    city: str(body.city, 120),
    state: str(body.state, 20),
    zip: str(body.zip, 20),
    lat: num(body.lat),
    lng: num(body.lng),
    status: ['active', 'pending', 'sold', 'draft'].includes(String(body.status)) ? String(body.status) : 'active',
    price: num(body.price),
    beds: num(body.beds),
    baths: num(body.baths),
    sqft: intOr(body.sqft),
    lot_sqft: intOr(body.lotSqft),
    year_built: intOr(body.yearBuilt),
    property_type: propertyType && validTypes.includes(propertyType) ? propertyType : (propertyType ? 'other' : null),
    description: str(body.description, 4000),
    photos,
    contact_name: str(body.contactName, 160),
    contact_email: str(body.contactEmail, 200),
    contact_phone: str(body.contactPhone, 40),
    visibility: str(body.visibility) === 'draft' ? 'draft' : 'public',
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('listings')
    .insert(row)
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('listings insert error:', error?.message);
    return NextResponse.json({ error: 'could not post listing' }, { status: 500 });
  }
  return NextResponse.json({ id: inserted.id });
}
