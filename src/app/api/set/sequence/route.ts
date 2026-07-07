import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/set/sequence?territory=<uuid>&n=3
//
// Returns the auto-generated camera SEQUENCE for a neighborhood mission: an
// establishing sweep over the area, then drops over ~n target parcels. The map
// flies through these keyframes (the run-through). memory/the_thesis (the
// camera welcome that lowers prospecting friction). Auto-scales to any of the
// 444 neighborhoods.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const territory = url.searchParams.get('territory');
  const nRaw = parseInt(url.searchParams.get('n') ?? '3', 10);
  const n = Number.isFinite(nRaw) ? Math.min(Math.max(nRaw, 1), 5) : 3;
  if (!territory) {
    return NextResponse.json({ error: 'territory required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('build_mission_sequence', {
    _territory_id: territory,
    _n: n,
  });
  if (error) {
    console.error('build_mission_sequence error:', error.message);
    return NextResponse.json({ error: 'sequence build failed' }, { status: 500 });
  }

  const steps = (Array.isArray(data) ? data : []).map((r: {
    step: number; kind: string; lat: number; lng: number;
    altitude: number; heading: number; pitch: number; range: number;
    duration_ms: number; apn: string | null; address: string | null;
  }) => ({
    step: r.step,
    kind: r.kind,
    lat: r.lat,
    lng: r.lng,
    altitude: r.altitude,
    heading: r.heading,
    pitch: r.pitch,
    range: r.range,
    durationMs: r.duration_ms,
    apn: r.apn,
    address: r.address,
  }));

  return NextResponse.json({ territory, steps });
}
