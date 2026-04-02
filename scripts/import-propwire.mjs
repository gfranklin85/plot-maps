/**
 * Bulk import Propwire CSV exports into Supabase leads table.
 *
 * Usage:
 *   1. Place CSV files in scripts/ directory
 *   2. Run: node scripts/import-propwire.mjs
 *
 * This script:
 *   - Parses Propwire CSV format
 *   - Maps columns to leads table fields
 *   - Deduplicates by property address
 *   - Inserts in batches
 *   - Geocodes via Google Maps API
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';
const GOOGLE_API_KEY = 'AIzaSyDPQhfHosE7BH9NnyB24TcJtTcYIqPYsHA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CSV Parser (handles quoted fields with commas) ──
function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      rows.push(row);
    }
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Map Propwire row to leads table ──
function mapRow(row) {
  const ownerFirst = row['Owner 1 First Name'] || '';
  const ownerLast = row['Owner 1 Last Name'] || '';
  const ownerName = [ownerFirst, ownerLast].filter(Boolean).join(' ').trim();

  const address = row['Address'] || '';
  const city = row['City'] || '';
  const state = row['State'] || '';
  const zip = row['Zip'] || '';

  // Build full address for property_address
  const fullAddr = [address, city, state, zip].filter(Boolean).join(', ');

  return {
    property_address: fullAddr || null,
    owner_name: ownerName || row['Name 1'] || null,
    name: row['Name 1'] || ownerName || null,
    phone: row['Phone 1'] || null,
    phone_2: row['Phone 2'] || null,
    phone_3: row['Phone 3'] || null,
    email: row['Email'] || null,
    mailing_address: row['Owner Mailing Address'] || null,
    mailing_city: row['Owner Mailing City'] || null,
    mailing_state: row['Owner Mailing State'] || null,
    mailing_zip: row['Owner Mailing Zip'] || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    price_range: row['Estimated Value'] ? `$${Number(row['Estimated Value']).toLocaleString()}` : null,
    property_condition: [row['Property Type'], row['Property Use']].filter(Boolean).join(' - ') || null,
    source: 'PropWire',
    status: 'New',
    priority: 'medium',
    notes: [
      row['Living Square Feet'] ? `Sqft: ${row['Living Square Feet']}` : '',
      row['Year Built'] ? `Built: ${row['Year Built']}` : '',
      row['Lot (Acres)'] ? `Lot: ${row['Lot (Acres)']} acres` : '',
      row['Bedrooms'] ? `Beds: ${row['Bedrooms']}` : '',
      row['Bathrooms'] ? `Baths: ${row['Bathrooms']}` : '',
      row['Units Count'] && row['Units Count'] !== '0' ? `Units: ${row['Units Count']}` : '',
      row['Last Sale Date'] ? `Last Sale: ${row['Last Sale Date']}` : '',
      row['Last Sale Amount'] && row['Last Sale Amount'] !== '0' ? `Sale Price: $${Number(row['Last Sale Amount']).toLocaleString()}` : '',
      row['Estimated Equity'] ? `Equity: $${Number(row['Estimated Equity']).toLocaleString()}` : '',
      row['Owner Type'] ? `Owner Type: ${row['Owner Type']}` : '',
    ].filter(Boolean).join(' | '),
  };
}

// ── Geocode ──
async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results?.length) {
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
    };
  }
  return null;
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──
async function main() {
  // Find CSV files in scripts/ directory
  const files = readdirSync(__dirname).filter(f => f.endsWith('.csv') && f.includes('Propwire'));

  if (files.length === 0) {
    console.log('No Propwire CSV files found in scripts/ directory.');
    console.log('Place your CSV files here and re-run.');
    console.log('Tip: Files should be named like "Propwire Export - xxx Properties - xxx.csv"');
    return;
  }

  console.log(`Found ${files.length} CSV file(s):`);
  files.forEach(f => console.log(`  - ${f}`));

  // Get existing addresses to deduplicate
  console.log('\nFetching existing leads for dedup...');
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('property_address');

  const existingAddresses = new Set(
    (existingLeads || [])
      .map(l => l.property_address?.toLowerCase().split(',')[0].trim())
      .filter(Boolean)
  );
  console.log(`Found ${existingAddresses.size} existing addresses.`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalGeocoded = 0;
  let allInsertedIds = [];

  for (const file of files) {
    console.log(`\n═══ Processing: ${file} ═══`);
    const text = readFileSync(join(__dirname, file), 'utf-8');
    const { rows } = parseCSV(text);
    console.log(`  Parsed ${rows.length} rows`);

    const mapped = rows.map(mapRow).filter(r => r.property_address);
    console.log(`  ${mapped.length} rows with addresses`);

    // Deduplicate
    const toInsert = mapped.filter(r => {
      const key = r.property_address?.toLowerCase().split(',')[0].trim();
      if (existingAddresses.has(key)) return false;
      existingAddresses.add(key); // prevent cross-file dupes too
      return true;
    });

    console.log(`  ${toInsert.length} new (${mapped.length - toInsert.length} duplicates skipped)`);
    totalSkipped += mapped.length - toInsert.length;

    // Insert in batches of 25
    const BATCH = 25;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id, property_address, city, state, zip');

      if (error) {
        console.error(`  Batch ${i}-${i + batch.length} error:`, error.message);
      } else {
        totalInserted += data.length;
        allInsertedIds.push(...data);
        process.stdout.write(`  Inserted ${totalInserted}...\r`);
      }
    }
    console.log(`  ✅ Inserted ${toInsert.length} leads from ${file}`);
  }

  console.log(`\n═══ IMPORT COMPLETE ═══`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped (dupes): ${totalSkipped}`);

  // Geocode all inserted leads
  if (allInsertedIds.length > 0) {
    console.log(`\n═══ GEOCODING ${allInsertedIds.length} leads ═══`);
    console.log(`  Estimated cost: $${(allInsertedIds.length * 0.005).toFixed(2)}`);

    for (let i = 0; i < allInsertedIds.length; i++) {
      const lead = allInsertedIds[i];
      const addr = lead.property_address;
      if (!addr) continue;

      const coords = await geocodeAddress(addr);
      if (coords) {
        await supabase
          .from('leads')
          .update({
            latitude: coords.lat,
            longitude: coords.lng,
            geocoded_at: new Date().toISOString(),
          })
          .eq('id', lead.id);
        totalGeocoded++;
      }

      // Rate limit: 50ms between requests
      await delay(50);

      if ((i + 1) % 50 === 0) {
        process.stdout.write(`  Geocoded ${i + 1}/${allInsertedIds.length}...\r`);
      }
    }

    console.log(`\n  ✅ Geocoded ${totalGeocoded}/${allInsertedIds.length} leads`);
  }

  console.log(`\n═══ ALL DONE ═══`);
  console.log(`  Total in DB: ${totalInserted + existingAddresses.size}`);
  console.log(`  With coordinates: ${totalGeocoded}`);
}

main().catch(console.error);
