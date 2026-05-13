import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { REGISTERED_SOURCES } from '@/lib/property-data/registry';

export const dynamic = 'force-dynamic';

// GET /api/admin/property-data/coverage
//
// Returns:
//   sources:  full list of registered PropertyDataSource records
//   regions:  parcel counts grouped by city/state (the spine table)
//   ingests:  recent ingest log rows
//
// Powers the admin coverage panel.

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Parcel counts grouped by city/state. Cheap rollup over the spine.
  const { data: spineRows } = await supabaseAdmin
    .from('properties')
    .select('city, state');
  const regionMap = new Map<string, number>();
  for (const row of spineRows ?? []) {
    const key = `${row.state ?? '?'}/${row.city ?? '?'}`;
    regionMap.set(key, (regionMap.get(key) ?? 0) + 1);
  }
  const regions = Array.from(regionMap.entries())
    .map(([key, count]) => {
      const [state, city] = key.split('/');
      return { state, city, parcelCount: count };
    })
    .sort((a, b) => b.parcelCount - a.parcelCount);

  // Ingest history — last 50.
  const { data: ingests } = await supabaseAdmin
    .from('property_data_ingests')
    .select('id, source_id, source_kind, source_description, records_ingested, records_updated, license_reference, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(50);

  const sources = REGISTERED_SOURCES.map(s => ({
    id: s.id,
    description: s.description,
    kind: s.kind,
    licenseReference: s.licenseReference,
    contributes: s.contributes,
    supportsSnapshot: typeof s.snapshot === 'function',
  }));

  return NextResponse.json({ sources, regions, ingests: ingests ?? [] });
}
