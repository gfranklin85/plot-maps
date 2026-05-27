import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET /api/addresses/in-bbox?west=&south=&east=&north=&limit=300
//
// Returns the N closest-to-bbox-center addresses inside the viewport.
// AddressMarkerLayer calls this with the camera's current viewport
// bbox to populate the in-flight marker layer.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const west  = parseFloat(url.searchParams.get('west')  ?? 'NaN');
  const south = parseFloat(url.searchParams.get('south') ?? 'NaN');
  const east  = parseFloat(url.searchParams.get('east')  ?? 'NaN');
  const north = parseFloat(url.searchParams.get('north') ?? 'NaN');
  const limit = Math.max(1, Math.min(1000, parseInt(url.searchParams.get('limit') ?? '300', 10)));

  if (![west, south, east, north].every(Number.isFinite)) {
    return NextResponse.json({ error: 'west, south, east, north required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('addresses_in_bbox', {
    west, south, east, north, max_results: limit,
  });

  if (error) {
    console.error('addresses_in_bbox RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  return NextResponse.json({ addresses: data ?? [] });
}
