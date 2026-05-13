import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSourceById } from '@/lib/property-data/registry';

// Force dynamic — admin-only writes; we never want this prerendered.
export const dynamic = 'force-dynamic';

// POST /api/admin/property-data/snapshot
//   body: { sourceId: string }
//
// Kicks off the named source's snapshot() and writes an ingest row.
// Synchronous (waits for the snapshot to finish before responding) —
// Lemoore is ~10K parcels and finishes in seconds. For larger sources
// in a future phase we'll switch to a background job pattern.

export async function POST(req: Request) {
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

  const { sourceId } = await req.json();
  if (!sourceId || typeof sourceId !== 'string') {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  const source = getSourceById(sourceId);
  if (!source) {
    return NextResponse.json({ error: 'Unknown source' }, { status: 404 });
  }
  if (!source.snapshot) {
    return NextResponse.json({ error: 'Source does not support snapshot' }, { status: 400 });
  }

  const startedAt = new Date();
  const { data: ingest } = await supabaseAdmin
    .from('property_data_ingests')
    .insert({
      source_id: source.id,
      source_kind: source.kind,
      source_description: source.description,
      license_reference: source.licenseReference,
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single();

  if (!ingest?.id) {
    return NextResponse.json({ error: 'Failed to create ingest record' }, { status: 500 });
  }

  try {
    const result = await source.snapshot({ ingestId: ingest.id });
    await supabaseAdmin
      .from('property_data_ingests')
      .update({
        records_ingested: result.recordsIngested,
        records_updated: result.recordsUpdated,
        finished_at: new Date().toISOString(),
      })
      .eq('id', ingest.id);

    return NextResponse.json({
      ok: true,
      ingestId: ingest.id,
      recordsIngested: result.recordsIngested,
      recordsUpdated: result.recordsUpdated,
    });
  } catch (err) {
    console.error('Snapshot failed:', err);
    await supabaseAdmin
      .from('property_data_ingests')
      .update({
        finished_at: new Date().toISOString(),
        source_description: `${source.description} — FAILED: ${err instanceof Error ? err.message : 'unknown'}`,
      })
      .eq('id', ingest.id);

    return NextResponse.json({ error: 'Snapshot failed', detail: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
