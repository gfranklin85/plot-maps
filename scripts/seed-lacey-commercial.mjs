/**
 * Seed mock commercial property data on Lacey Ave in Hanford, CA
 * between 11th Ave and 12th Ave — for product screenshots.
 *
 * Usage:  node scripts/seed-lacey-commercial.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';
const GOOGLE_API_KEY = 'AIzaSyDPQhfHosE7BH9NnyB24TcJtTcYIqPYsHA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Mock commercial properties ──
const MOCK_LEADS = [
  {
    property_address: '101 N Lacey Ave, Hanford, CA, 93230',
    name: 'Robert Matsumoto',
    owner_name: 'Robert Matsumoto',
    phone: '(559) 384-2917',
    phone_2: '(559) 384-2920',
    email: 'rmatsumoto@cvinsurance.com',
    mailing_address: '101 N Lacey Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Office - COMMERCIAL',
    price_range: '$210,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 2400,
    year_built: 1972,
    lot_acres: 0.12,
    notes: 'Sqft: 2400 | Built: 1972 | Lot: 0.12 acres | Owner Type: Individual | Central Valley Insurance Group',
  },
  {
    property_address: '109 N Lacey Ave, Hanford, CA, 93230',
    name: 'Maria Gutierrez',
    owner_name: 'Dr. Maria E. Gutierrez',
    phone: '(559) 410-7834',
    phone_2: null,
    email: 'office@hanfordfamilydental.com',
    mailing_address: '2841 W Lacey Blvd',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Office - COMMERCIAL',
    price_range: '$295,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 3200,
    year_built: 1985,
    lot_acres: 0.15,
    notes: 'Sqft: 3200 | Built: 1985 | Lot: 0.15 acres | Owner Type: Individual | Hanford Family Dental',
  },
  {
    property_address: '115 N Lacey Ave, Hanford, CA, 93230',
    name: 'Thomas Garcia',
    owner_name: 'Thomas & Rosa Garcia',
    phone: '(559) 267-4581',
    phone_2: '(559) 267-4582',
    email: null,
    mailing_address: '1520 E Florinda St',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Commercial - COMMERCIAL',
    price_range: '$185,000',
    source: 'PropWire',
    status: 'new',
    priority: 'high',
    sqft: 2800,
    year_built: 1958,
    lot_acres: 0.10,
    notes: 'Sqft: 2800 | Built: 1958 | Lot: 0.10 acres | Owner Type: Individual | La Cocina Mexican Grill',
  },
  {
    property_address: '121 N Lacey Ave, Hanford, CA, 93230',
    name: 'James Patterson',
    owner_name: 'James Patterson',
    phone: '(559) 583-6190',
    phone_2: null,
    email: 'jim@valleyhardware.net',
    mailing_address: '121 N Lacey Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Retail - COMMERCIAL',
    price_range: '$385,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 5500,
    year_built: 1963,
    lot_acres: 0.20,
    listing_status: 'Sold',
    listing_price: 399000,
    selling_price: 385000,
    selling_date: '2026-01-15',
    listing_date: '2025-11-20',
    dom: 45,
    notes: 'Sqft: 5500 | Built: 1963 | Lot: 0.20 acres | Owner Type: Individual | Valley Hardware & Supply | Sold 01/2026 for $385k',
  },
  {
    property_address: '127 N Lacey Ave, Hanford, CA, 93230',
    name: 'Frank Oliveira',
    owner_name: 'Frank Oliveira',
    phone: '(559) 721-3045',
    phone_2: '(559) 721-3046',
    phone_3: '(559) 350-8812',
    email: null,
    mailing_address: '4012 W Grangeville Blvd',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Retail - COMMERCIAL',
    price_range: '$275,000',
    source: 'PropWire',
    status: 'new',
    priority: 'high',
    sqft: 1800,
    year_built: 1955,
    lot_acres: 0.08,
    listing_status: 'Active',
    listing_price: 275000,
    listing_date: '2026-03-10',
    dom: 26,
    notes: 'Sqft: 1800 | Built: 1955 | Lot: 0.08 acres | Owner Type: Individual | Lacey Liquor & Deli | Active listing $275k',
  },
  {
    property_address: '133 N Lacey Ave, Hanford, CA, 93230',
    name: 'Patricia Sandoval',
    owner_name: 'Patricia Sandoval',
    phone: '(559) 449-2167',
    phone_2: null,
    email: 'pat@kingscountytax.com',
    mailing_address: '133 N Lacey Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Office - COMMERCIAL',
    price_range: '$155,000',
    source: 'PropWire',
    status: 'new',
    priority: 'low',
    sqft: 1200,
    year_built: 1968,
    lot_acres: 0.06,
    notes: 'Sqft: 1200 | Built: 1968 | Lot: 0.06 acres | Owner Type: Individual | Kings County Tax Services',
  },
  {
    property_address: '139 N Lacey Ave, Hanford, CA, 93230',
    name: 'Singh Family Trust',
    owner_name: 'Singh Family Trust',
    phone: '(559) 302-8874',
    phone_2: null,
    email: null,
    mailing_address: '8920 W Manning Ave',
    mailing_city: 'Fresno',
    mailing_state: 'CA',
    mailing_zip: '93706',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Commercial - COMMERCIAL',
    price_range: '$240,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 3600,
    year_built: 1961,
    lot_acres: 0.14,
    notes: 'Sqft: 3600 | Built: 1961 | Lot: 0.14 acres | Owner Type: Trust | VACANT STOREFRONT',
  },
  {
    property_address: '145 N Lacey Ave, Hanford, CA, 93230',
    name: 'Linda Chen',
    owner_name: 'David & Linda Chen',
    phone: '(559) 516-4293',
    phone_2: '(559) 516-4294',
    email: null,
    mailing_address: '145 N Lacey Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Commercial - COMMERCIAL',
    price_range: '$170,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 1500,
    year_built: 1975,
    lot_acres: 0.07,
    notes: 'Sqft: 1500 | Built: 1975 | Lot: 0.07 acres | Owner Type: Individual | Sunrise Nail & Spa',
  },
  {
    property_address: '151 N Lacey Ave, Hanford, CA, 93230',
    name: 'Richard Yamamoto',
    owner_name: 'Richard Yamamoto',
    phone: '(559) 638-1720',
    phone_2: null,
    email: 'ryamamoto@goldenstaterealty.com',
    mailing_address: '151 N Lacey Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Office - COMMERCIAL',
    price_range: '$220,000',
    source: 'PropWire',
    status: 'new',
    priority: 'low',
    sqft: 2000,
    year_built: 1988,
    lot_acres: 0.09,
    notes: 'Sqft: 2000 | Built: 1988 | Lot: 0.09 acres | Owner Type: Individual | Golden State Realty Group',
  },
  {
    property_address: '157 N Lacey Ave, Hanford, CA, 93230',
    name: 'Carol Henderson',
    owner_name: 'Carol Henderson',
    phone: '(559) 772-5034',
    phone_2: '(559) 772-5035',
    email: 'carol@hanfordautoparts.com',
    mailing_address: '3100 N 10th Ave',
    mailing_city: 'Hanford',
    mailing_state: 'CA',
    mailing_zip: '93230',
    city: 'Hanford',
    state: 'CA',
    zip: '93230',
    property_condition: 'Retail - COMMERCIAL',
    price_range: '$310,000',
    source: 'PropWire',
    status: 'new',
    priority: 'medium',
    sqft: 4200,
    year_built: 1970,
    lot_acres: 0.18,
    notes: 'Sqft: 4200 | Built: 1970 | Lot: 0.18 acres | Owner Type: Individual | Hanford Auto Parts',
  },
];

// ── Fallback coordinates along the block ──
// Lacey Ave between 11th and 12th: ~36.3265 to ~36.3280 lat, ~-119.6457 lng
function fallbackCoords(index) {
  const baseLat = 36.3265;
  const step = 0.00015;
  return { lat: baseLat + step * index, lng: -119.6457 };
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
  console.log('═══ Seeding Lacey Ave commercial properties ═══\n');

  // Dedup: fetch existing addresses
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('property_address');

  const existingAddresses = new Set(
    (existingLeads || [])
      .map(l => l.property_address?.toLowerCase().split(',')[0].trim())
      .filter(Boolean)
  );

  const toInsert = MOCK_LEADS.filter(lead => {
    const key = lead.property_address.toLowerCase().split(',')[0].trim();
    return !existingAddresses.has(key);
  });

  if (toInsert.length === 0) {
    console.log('All 10 Lacey Ave properties already exist. Nothing to insert.');
    return;
  }

  console.log(`Inserting ${toInsert.length} new commercial leads (${MOCK_LEADS.length - toInsert.length} already exist)...\n`);

  // Insert
  const { data: inserted, error } = await supabase
    .from('leads')
    .insert(toInsert)
    .select('id, property_address');

  if (error) {
    console.error('Insert error:', error.message);
    return;
  }

  console.log(`✅ Inserted ${inserted.length} leads\n`);

  // Geocode
  console.log('Geocoding...');
  let geocoded = 0;

  for (let i = 0; i < inserted.length; i++) {
    const lead = inserted[i];
    let coords = await geocodeAddress(lead.property_address);

    if (!coords) {
      coords = fallbackCoords(i);
      console.log(`  ${lead.property_address} — fallback coords`);
    } else {
      console.log(`  ${lead.property_address} — geocoded`);
    }

    await supabase
      .from('leads')
      .update({
        latitude: coords.lat,
        longitude: coords.lng,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    geocoded++;
    await delay(50);
  }

  console.log(`\n✅ Geocoded ${geocoded}/${inserted.length} leads`);
  console.log('\n═══ DONE ═══');
}

main().catch(console.error);
