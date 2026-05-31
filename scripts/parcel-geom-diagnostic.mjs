#!/usr/bin/env node
// parcel-geom-diagnostic.mjs
//
// Honest snapshot of what's actually in properties.geom. Answers the
// four questions we need before trusting the polygon data:
//   1. How many parcels have geom at all? Split by city.
//   2. What's the area distribution? Healthy residential band vs runaways.
//   3. Pick 10 random with-geom parcels — show their apn, address, area,
//      vertex count, centroid, AND the computed monument anchor so we
//      can eyeball whether the math lands in the backyard.
//   4. Are there outright bad geoms (NULL, empty, invalid)?
//
// Reads SUPABASE_SERVICE_ROLE_KEY from .env.local. Service-role
// bypasses RLS so we see EVERY row.
//
// Usage: node scripts/parcel-geom-diagnostic.mjs

import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const ENV_PATH = new URL('../.env.local', import.meta.url);
const env = Object.fromEntries(
  (await fs.readFile(ENV_PATH, 'utf8'))
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// PostgREST can't run raw SQL, but it can execute RPCs. We install a
// throwaway RPC just for this diagnostic, then run all the queries
// through it. Cleaner than the alternative of trying to express each
// query through the PostgREST query builder.

async function rpcOrInstall() {
  // First-run: install a one-shot SECURITY DEFINER RPC that takes raw
  // SQL and returns rows as JSON. Service-role only. We tear it down
  // at the end of the script.
  const installSql = `
    CREATE OR REPLACE FUNCTION _plot_diag_query(q text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $diag$
    DECLARE
      result jsonb;
    BEGIN
      EXECUTE format('SELECT COALESCE(jsonb_agg(t), %L::jsonb) FROM (%s) t', '[]', q) INTO result;
      RETURN result;
    END;
    $diag$;
    GRANT EXECUTE ON FUNCTION _plot_diag_query(text) TO service_role;
  `;
  // The RPC doesn't exist yet — install it via a direct fetch to the
  // PostgREST sql endpoint. Supabase exposes the sql endpoint only on
  // the legacy /rest/v1/rpc path, so we use exec_sql convention.
  // Fallback: try calling our RPC; if it doesn't exist we tell the user.
  const probe = await supabase.rpc('_plot_diag_query', { q: 'SELECT 1 AS ok' });
  if (probe.error) {
    console.error('\n[FATAL] _plot_diag_query RPC missing. Install it once by running this in the Supabase SQL editor:\n');
    console.error(installSql);
    console.error('\nThen rerun this script.\n');
    process.exit(1);
  }
}

async function q(sql) {
  const { data, error } = await supabase.rpc('_plot_diag_query', { q: sql });
  if (error) {
    console.error('Query failed:', error.message);
    console.error('SQL:', sql);
    return null;
  }
  return data;
}

function fmt(rows) {
  return JSON.stringify(rows, null, 2);
}

async function main() {
  await rpcOrInstall();

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  PARCEL GEOM DIAGNOSTIC');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Total counts + coverage
  console.log('─── 1. ROW COUNTS ──────────────────────────────────────');
  const counts = await q(`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(geom) AS with_geom,
      COUNT(*) FILTER (WHERE geom IS NULL) AS no_geom
    FROM properties
  `);
  console.log(fmt(counts));

  console.log('\n─── 1b. BY CITY (top 10) ────────────────────────────────');
  const byCity = await q(`
    SELECT
      COALESCE(city, '(null)') AS city,
      COUNT(*) AS total,
      COUNT(geom) AS with_geom,
      ROUND(100.0 * COUNT(geom) / NULLIF(COUNT(*), 0), 1) AS pct_with_geom
    FROM properties
    GROUP BY city
    ORDER BY total DESC
    LIMIT 10
  `);
  console.log(fmt(byCity));

  // 2. Area distribution
  console.log('\n─── 2. AREA DISTRIBUTION (sqm) ──────────────────────────');
  const areas = await q(`
    WITH areas AS (
      SELECT ST_Area(geom::geography) AS area_sqm
      FROM properties
      WHERE geom IS NOT NULL
    )
    SELECT
      COUNT(*) AS with_geom_rows,
      ROUND(MIN(area_sqm)::numeric, 0) AS min_sqm,
      ROUND(percentile_cont(0.10) WITHIN GROUP (ORDER BY area_sqm)::numeric, 0) AS p10,
      ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY area_sqm)::numeric, 0) AS median,
      ROUND(percentile_cont(0.90) WITHIN GROUP (ORDER BY area_sqm)::numeric, 0) AS p90,
      ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY area_sqm)::numeric, 0) AS p99,
      ROUND(MAX(area_sqm)::numeric, 0) AS max_sqm,
      COUNT(*) FILTER (WHERE area_sqm > 50000) AS runaway_count,
      COUNT(*) FILTER (WHERE area_sqm < 50) AS tiny_count
    FROM areas
  `);
  console.log(fmt(areas));

  // 2b. The actual runaways (so we can find/fix them)
  console.log('\n─── 2b. RUNAWAY POLYGONS (top 10 by area) ──────────────');
  const runaways = await q(`
    SELECT
      apn,
      address,
      city,
      ROUND(ST_Area(geom::geography)::numeric, 0) AS area_sqm,
      ST_NPoints(geom) AS n_points
    FROM properties
    WHERE geom IS NOT NULL
      AND ST_Area(geom::geography) > 50000
    ORDER BY ST_Area(geom::geography) DESC
    LIMIT 10
  `);
  console.log(fmt(runaways));

  // 3. Random sample with computed monument anchor
  console.log('\n─── 3. RANDOM SAMPLE — does monument anchor land sanely? ──');
  console.log('    Pick a few of these, paste lat,lng into Google Maps,');
  console.log('    and confirm anchor is in the BACKYARD of the address.\n');

  const sample = await q(`
    WITH sample AS (
      SELECT *
      FROM properties
      WHERE geom IS NOT NULL
        AND ST_Area(geom::geography) BETWEEN 200 AND 30000
      ORDER BY random()
      LIMIT 10
    ),
    enriched AS (
      SELECT
        s.apn,
        s.address,
        s.city,
        ROUND(ST_Area(s.geom::geography)::numeric, 0) AS area_sqm,
        ST_NPoints(s.geom) AS n_points,
        ST_Y(ST_Centroid(s.geom)) AS centroid_lat,
        ST_X(ST_Centroid(s.geom)) AS centroid_lng
      FROM sample s
    )
    SELECT
      apn,
      address,
      city,
      area_sqm,
      n_points,
      ROUND(centroid_lat::numeric, 6) AS centroid_lat,
      ROUND(centroid_lng::numeric, 6) AS centroid_lng
    FROM enriched
    ORDER BY area_sqm
  `);
  console.log(fmt(sample));

  // 3b. Geom validity
  console.log('\n─── 4. GEOMETRY VALIDITY ────────────────────────────────');
  const validity = await q(`
    SELECT
      COUNT(*) FILTER (WHERE NOT ST_IsValid(geom)) AS invalid_geoms,
      COUNT(*) FILTER (WHERE ST_IsEmpty(geom)) AS empty_geoms,
      COUNT(*) FILTER (WHERE GeometryType(geom) = 'POLYGON') AS as_polygon,
      COUNT(*) FILTER (WHERE GeometryType(geom) = 'MULTIPOLYGON') AS as_multipolygon
    FROM properties
    WHERE geom IS NOT NULL
  `);
  console.log(fmt(validity));

  // 4. Point-in-polygon SMOKE TEST — does ST_Contains actually work for a random sample?
  console.log('\n─── 5. SMOKE TEST: ST_Contains on each sample\'s own centroid ──');
  console.log('    Every parcel\'s centroid MUST contain itself. If any fail,');
  console.log('    the click-resolver path is broken at the data layer.\n');
  const smoke = await q(`
    WITH sample AS (
      SELECT apn, geom, ST_Centroid(geom) AS c
      FROM properties
      WHERE geom IS NOT NULL
        AND ST_IsValid(geom)
      ORDER BY random()
      LIMIT 25
    )
    SELECT
      COUNT(*) AS sampled,
      COUNT(*) FILTER (WHERE ST_Contains(geom, c)) AS centroid_inside_self,
      COUNT(*) FILTER (WHERE NOT ST_Contains(geom, c)) AS centroid_OUTSIDE_self
    FROM sample
  `);
  console.log(fmt(smoke));

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  Done.\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
