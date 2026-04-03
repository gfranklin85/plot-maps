/**
 * Import MLS listing data (sold/active/pending) into the leads table.
 * Matches by address — updates existing leads or creates new ones.
 *
 * Usage: node scripts/import-mls.mjs
 * Place MLS CSV files (from MLS export) in the scripts/ directory.
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

// ── CSV Parser ──
function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
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
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
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

// ── Status mapping ──
const STATUS_MAP = { 'S': 'Sold', 'A': 'Active', 'T': 'Pending' };

// ── Parse date (MM/DD/YY or MM/DD/YYYY) ──
function parseDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  let [m, d, y] = parts.map(Number);
  if (y < 100) y += 2000;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Normalize address for matching ──
function normalizeAddr(addr) {
  if (!addr) return '';
  return addr
    .replace(/,\s*CA\s+\d{5}(-\d{4})?/i, '')  // strip state+zip
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// ── Geocode ──
async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results?.length) {
    return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng };
  }
  return null;
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──
async function main() {
  // Find MLS CSV files (not Propwire ones)
  const files = readdirSync(__dirname).filter(f =>
    f.endsWith('.csv') && !f.includes('Propwire') && (f.includes('RESI') || f.includes('MLS') || f.includes('mls'))
  );

  if (files.length === 0) {
    console.log('No MLS CSV files found in scripts/ directory.');
    console.log('Place your MLS CSV files here. They should have columns: Status, Address, Listing Price, etc.');
    console.log('Files should NOT contain "Propwire" in the name.');
    return;
  }

  console.log(`Found ${files.length} MLS CSV file(s):`);
  files.forEach(f => console.log(`  - ${f}`));

  // Fetch all existing leads for address matching
  console.log('\nFetching existing leads...');
  const { data: existingLeads } = await supabase.from('leads').select('id, property_address');
  const addrMap = new Map();
  (existingLeads || []).forEach(l => {
    if (l.property_address) {
      addrMap.set(normalizeAddr(l.property_address), l.id);
    }
  });
  console.log(`${addrMap.size} existing leads indexed.`);

  let totalUpdated = 0;
  let totalInserted = 0;
  let toGeocode = [];

  for (const file of files) {
    console.log(`\n═══ Processing: ${file} ═══`);
    const text = readFileSync(join(__dirname, file), 'utf-8');
    const rows = parseCSV(text);
    console.log(`  Parsed ${rows.length} rows`);

    for (const row of rows) {
      const address = row['Address'] || '';
      if (!address) continue;

      const listingStatus = STATUS_MAP[row['Status']] || row['Status'] || null;
      const listingPrice = Number(row['Listing Price']) || null;
      const sellingPrice = Number(row['Selling Price']) || null;
      const dom = Number(row['DOM']) || null;
      const sqft = Number(row['Square Footage']) || null;
      const lotAcres = Number(row['Lot Size - Acres']) || null;
      const yearBuilt = Number(row['Year Built']) || null;
      const listingDate = parseDate(row['Listing Date']);
      const pendingDate = parseDate(row['Pending Date']);
      const sellingDate = parseDate(row['Selling Date']);

      const mlsFields = {
        listing_status: listingStatus,
        listing_price: listingPrice,
        selling_price: sellingPrice,
        dom,
        listing_date: listingDate,
        pending_date: pendingDate,
        selling_date: sellingDate,
        sqft,
        lot_acres: lotAcres,
        year_built: yearBuilt,
      };

      // Try to match by address
      const normAddr = normalizeAddr(address);
      const existingId = addrMap.get(normAddr);

      if (existingId) {
        // Update existing lead
        const { error } = await supabase.from('leads').update(mlsFields).eq('id', existingId);
        if (error) {
          console.log(`  ⚠ Update failed for ${address}: ${error.message}`);
        } else {
          totalUpdated++;
        }
      } else {
        // Extract city/state/zip from address
        const parts = address.split(',').map(s => s.trim());
        const street = parts[0] || address;
        const city = parts[1] || 'Lemoore';
        const stateZip = (parts[2] || '').split(' ').filter(Boolean);
        const state = stateZip[0] || 'CA';
        const zip = stateZip[1]?.replace(/-\d+$/, '') || '';

        const newLead = {
          property_address: address,
          name: street,  // name is NOT NULL — use street as fallback
          city,
          state,
          zip,
          source: 'MLS',
          status: 'new',
          priority: 'medium',
          price_range: sellingPrice ? `$${sellingPrice.toLocaleString()}` : (listingPrice ? `$${listingPrice.toLocaleString()}` : null),
          ...mlsFields,
        };

        const { data, error } = await supabase.from('leads').insert(newLead).select('id, property_address');
        if (error) {
          console.log(`  ⚠ Insert failed for ${address}: ${error.message}`);
        } else {
          totalInserted++;
          if (data?.[0]) {
            addrMap.set(normAddr, data[0].id);
            toGeocode.push(data[0]);
          }
        }
      }
    }
    console.log(`  ✅ Processed ${rows.length} rows from ${file}`);
  }

  console.log(`\n═══ IMPORT COMPLETE ═══`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Inserted: ${totalInserted}`);

  // Geocode new entries
  if (toGeocode.length > 0) {
    console.log(`\n═══ GEOCODING ${toGeocode.length} new entries ═══`);
    let geocoded = 0;
    for (let i = 0; i < toGeocode.length; i++) {
      const lead = toGeocode[i];
      const coords = await geocodeAddress(lead.property_address);
      if (coords) {
        await supabase.from('leads').update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date().toISOString(),
        }).eq('id', lead.id);
        geocoded++;
      }
      await delay(50);
      if ((i + 1) % 25 === 0) {
        console.log(`  Geocoded ${i + 1}/${toGeocode.length}...`);
      }
    }
    console.log(`  ✅ Geocoded ${geocoded}/${toGeocode.length}`);
  }

  console.log('\n═══ ALL DONE ═══');
}

main().catch(console.error);
