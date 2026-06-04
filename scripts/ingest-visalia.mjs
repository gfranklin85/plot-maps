// Ingest City of Visalia parcels (OpenAddresses NDJSON) into the
// `properties` table so the existing parcel_at_point PostGIS gate works
// in Visalia. Mirrors the Kings ingest shape verified from the live DB:
//
//   properties.geom = GeoJSON object { type, crs:{name:'EPSG:4326'}, coordinates }
//   fips_county_code = '06107' (Tulare; Visalia is the county seat)
//   apn              = the parcel `pid`
//   monument_lat/lng = backyard anchor (centroid offset 40% toward the
//                      longest exterior-edge midpoint, clamped interior)
//
// OpenAddresses Visalia parcels carry geometry + pid ONLY (no owner /
// value / beds). Those assessor fields stay null; the polygon is the
// monument gate, which is all this load needs.
//
// Data caveats handled: line-delimited GeoJSON (parse per line), 667
// duplicate pids + 14 missing pid (first-wins dedupe; missing pid skipped
// with a count). Idempotent: upsert on apn.
//
// Usage:  node scripts/ingest-visalia.mjs            (full run)
//         node scripts/ingest-visalia.mjs --limit=50 (smoke test)
//         node scripts/ingest-visalia.mjs --dry      (parse only, no writes)

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// ── config ──────────────────────────────────────────────────────────
const DATA =
  'C:/Users/gregf/OneDrive/Desktop/Plot stuff/ParcelAddressData/city_of_visalia-parcels-city.geojson';
const FIPS_TULARE = '06107';
const SPINE_SOURCE = 'openaddresses-visalia-parcels-2026-05';
const BATCH = 500;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

// ── env ─────────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── geometry helpers ────────────────────────────────────────────────

// Normalize to MultiPolygon (the geom column type) + wrap in the crs
// envelope the DB stores. A Polygon becomes a single-member MultiPolygon.
function withCrs(geom) {
  const coordinates =
    geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return {
    type: 'MultiPolygon',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    coordinates,
  };
}

// The exterior ring used for anchor math: Polygon → ring[0];
// MultiPolygon → the largest polygon's ring[0].
function exteriorRing(geom) {
  if (geom.type === 'Polygon') return geom.coordinates[0];
  if (geom.type === 'MultiPolygon') {
    let best = null;
    let bestArea = -1;
    for (const poly of geom.coordinates) {
      const a = Math.abs(ringSignedArea(poly[0]));
      if (a > bestArea) { bestArea = a; best = poly[0]; }
    }
    return best;
  }
  return null;
}

// Shoelace signed area (in degree^2 — fine for relative comparison + centroid).
function ringSignedArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

// Polygon centroid via the standard area-weighted formula (exterior ring).
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-14) {
    // Degenerate — average the vertices.
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of ring) { sx += x; sy += y; n++; }
    return [sx / n, sy / n];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

// Even-odd point-in-polygon (single ring).
function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Monument anchor = polygon centroid (Greg's call 2026-05-30: simplest,
// always inside the lot, monument rises from the middle). The Kings
// "backyard" 40%-offset formula can re-backfill later if we want it; for
// the gate test, centroid is correct and testable now. Falls back to the
// vertex average for degenerate rings (handled inside ringCentroid).
function monumentAnchor(geom) {
  const ring = exteriorRing(geom);
  if (!ring || ring.length < 4) return null;
  const c = ringCentroid(ring);
  // Guarantee the anchor is inside (concave lots can push the area
  // centroid outside the ring); fall back to a guaranteed-interior point.
  if (pointInRing(c, ring)) return c;
  // Vertex average as a cheap interior-ish fallback.
  let sx = 0, sy = 0, n = 0;
  for (const [x, y] of ring) { sx += x; sy += y; n++; }
  return [sx / n, sy / n];
}

// ── stream parse + upsert ───────────────────────────────────────────

async function flush(rows) {
  if (DRY || rows.length === 0) return { inserted: rows.length, error: null };
  const { error } = await db.from('properties').upsert(rows, { onConflict: 'apn' });
  return { inserted: error ? 0 : rows.length, error: error?.message ?? null };
}

const seen = new Set();
let parsed = 0, skippedNoPid = 0, dupPid = 0, badGeom = 0, queued = 0, written = 0;
let batch = [];
const errors = [];

const rl = readline.createInterface({
  input: fs.createReadStream(DATA, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

const nowIso = new Date().toISOString();

for await (const line of rl) {
  const i = line.indexOf('{"type"');
  if (i < 0) continue;
  let s = line.slice(i);
  if (s.endsWith(',')) s = s.slice(0, -1);
  let f;
  try { f = JSON.parse(s); } catch { continue; }
  if (f.type !== 'Feature') continue;
  parsed++;

  const pid = f.properties?.pid;
  if (!pid) { skippedNoPid++; continue; }
  if (seen.has(pid)) { dupPid++; continue; }

  const geom = f.geometry;
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) { badGeom++; continue; }

  const anchor = monumentAnchor(geom);
  if (!anchor) { badGeom++; continue; }

  seen.add(pid);
  batch.push({
    apn: String(pid),
    fips_county_code: FIPS_TULARE,
    city: 'Visalia',
    state: 'CA',
    geom: withCrs(geom),
    monument_lat: anchor[1],
    monument_lng: anchor[0],
    spine_source: SPINE_SOURCE,
    spine_acquired_at: nowIso,
  });
  queued++;

  if (queued >= LIMIT) break;

  if (batch.length >= BATCH) {
    const { inserted, error } = await flush(batch);
    written += inserted;
    if (error) errors.push(error);
    batch = [];
    process.stdout.write(`\r  written=${written} parsed=${parsed} dup=${dupPid} noPid=${skippedNoPid} badGeom=${badGeom}   `);
  }
}
rl.close();

// Final partial batch.
if (batch.length) {
  const { inserted, error } = await flush(batch);
  written += inserted;
  if (error) errors.push(error);
}

const summary = {
  parsed, queued, written,
  uniquePids: seen.size,
  skippedNoPid, dupPid, badGeom,
  dry: DRY, limit: LIMIT === Infinity ? null : LIMIT,
  errors: errors.slice(0, 5),
  errorCount: errors.length,
};
console.log('\n' + JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(process.cwd(), 'scripts', '_ingest-out.json'), JSON.stringify(summary, null, 2));
