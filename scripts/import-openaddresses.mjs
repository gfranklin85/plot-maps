/**
 * Bulk import OpenAddresses GeoJSON into Supabase `addresses` table.
 *
 * Workflow:
 *   1. Download an OpenAddresses dump (e.g. us-ca-statewide.geojson from
 *      https://batch.openaddresses.io/ — free, no auth) and drop the
 *      .geojson file into scripts/openaddresses/
 *   2. Run: node scripts/import-openaddresses.mjs scripts/openaddresses/us-ca-kings.geojson
 *      or:  node scripts/import-openaddresses.mjs   (auto-detects all
 *           .geojson files in scripts/openaddresses/)
 *
 * Stream parser — files can be 5GB+, never load whole thing in memory.
 *
 * Re-run safe: addresses_source_dedup unique index causes ON CONFLICT
 * DO NOTHING on inserts. Re-ingest of the same dump is a no-op.
 *
 * Source identifier: we use the OpenAddresses 'hash' field when
 * present, else `${file_basename}:${line_number}`.
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, createReadStream, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH_SIZE = 1000;
const SOURCE = 'openaddresses';

// ── File discovery ────────────────────────────────────────────────
function findFiles(argv) {
  if (argv.length > 2) {
    return argv.slice(2).filter((p) => p.endsWith('.geojson'));
  }
  const dir = join(__dirname, 'openaddresses');
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.geojson'))
      .map((f) => join(dir, f));
  } catch {
    console.error('No file argument given and scripts/openaddresses/ does not exist.');
    console.error('Usage: node scripts/import-openaddresses.mjs <path-to-geojson>');
    process.exit(1);
  }
}

// ── OpenAddresses feature → addresses row ─────────────────────────
// OpenAddresses GeoJSON features look like:
// { "type": "Feature",
//   "properties": {
//     "hash": "abc123", "number": "546", "street": "Fox St",
//     "unit": "", "city": "Lemoore", "district": "Kings",
//     "region": "CA", "postcode": "93245", "id": "..." },
//   "geometry": { "type": "Point", "coordinates": [lng, lat] }
// }
function featureToRow(feature, file, lineNo) {
  if (!feature || feature.type !== 'Feature') return null;
  const g = feature.geometry;
  if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const [lng, lat] = g.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  // OpenAddresses sometimes emits 0,0 placeholders for un-geocodable
  // rows. Drop them — they'd cluster at the Gulf of Guinea on the map.
  if (lng === 0 && lat === 0) return null;

  const p = feature.properties ?? {};
  const street_number = (p.number ?? '').toString().trim() || null;
  const street_name   = (p.street ?? '').toString().trim() || null;
  const unit          = (p.unit ?? '').toString().trim() || null;
  const city          = (p.city ?? '').toString().trim() || null;
  const state         = (p.region ?? '').toString().trim() || null;
  const zip           = (p.postcode ?? '').toString().trim() || null;
  const county        = (p.district ?? '').toString().trim() || null;

  // Skip rows with no street + no number — useless for prospecting.
  if (!street_number && !street_name) return null;

  // Pre-render the display string. This is what skip-trace + mail use.
  const parts = [];
  if (street_number) parts.push(street_number);
  if (street_name)   parts.push(street_name);
  if (unit)          parts.push('#' + unit);
  const line1 = parts.join(' ');
  const cityzip = [city, state, zip].filter(Boolean).join(' ');
  const full_address = [line1, cityzip].filter(Boolean).join(', ');

  const source_id = p.hash || p.id || `${basename(file)}:${lineNo}`;

  return {
    street_number,
    street_name,
    unit,
    city,
    state,
    zip,
    county,
    full_address,
    geom: `SRID=4326;POINT(${lng} ${lat})`,
    source: SOURCE,
    source_id,
  };
}

// ── Bulk insert ───────────────────────────────────────────────────
async function flushBatch(rows) {
  if (rows.length === 0) return 0;
  // ON CONFLICT DO NOTHING via Supabase's upsert with ignoreDuplicates.
  const { error, count } = await supabase
    .from('addresses')
    .upsert(rows, {
      onConflict: 'source,source_id',
      ignoreDuplicates: true,
      count: 'exact',
    });
  if (error) {
    console.error('Insert error:', error.message);
    return 0;
  }
  return count ?? rows.length;
}

// ── Main ingest loop ──────────────────────────────────────────────
async function ingestFile(file) {
  console.log(`\n[ingest] ${file}`);
  const size = statSync(file).size;
  console.log(`[ingest] size: ${(size / 1024 / 1024).toFixed(1)} MB`);

  const stream = createReadStream(file, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let batch = [];
  let lineNo = 0;
  let parsed = 0;
  let skipped = 0;
  let inserted = 0;
  const startMs = Date.now();

  for await (const rawLine of rl) {
    lineNo += 1;
    const line = rawLine.trim();
    if (!line || line === '[' || line === ']') continue;
    // GeoJSON FeatureCollection one-per-line (the common OpenAddresses
    // shape). Strip trailing commas.
    const json = line.endsWith(',') ? line.slice(0, -1) : line;
    let feature;
    try {
      feature = JSON.parse(json);
    } catch {
      skipped += 1;
      continue;
    }
    const row = featureToRow(feature, file, lineNo);
    if (!row) { skipped += 1; continue; }
    parsed += 1;
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      inserted += await flushBatch(batch);
      batch = [];
      if (parsed % 10000 === 0) {
        const rate = (parsed / ((Date.now() - startMs) / 1000)).toFixed(0);
        console.log(`[ingest] parsed=${parsed} inserted=${inserted} skipped=${skipped} (${rate}/s)`);
      }
    }
  }
  if (batch.length > 0) {
    inserted += await flushBatch(batch);
  }
  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[ingest] DONE ${file} — parsed=${parsed} inserted=${inserted} skipped=${skipped} in ${elapsedS}s`);
}

async function main() {
  const files = findFiles(process.argv);
  if (files.length === 0) {
    console.error('No .geojson files to ingest.');
    process.exit(1);
  }
  console.log(`[ingest] ${files.length} file(s) to process`);
  for (const f of files) {
    await ingestFile(f);
  }
  console.log('\n[ingest] all files complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
