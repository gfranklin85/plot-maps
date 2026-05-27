import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET /api/addresses/[id]
//
// Full address record by id. PropertyPopup's addr:<id> resolver
// branch calls this when opening an address-based popup.

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const id = parseInt(ctx.params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('addresses')
    .select('id, street_number, street_name, unit, city, state, zip, county, full_address')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('address by id error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    streetNumber: data.street_number,
    streetName: data.street_name,
    unit: data.unit,
    city: data.city,
    state: data.state,
    zip: data.zip,
    county: data.county,
    fullAddress: data.full_address,
  });
}
