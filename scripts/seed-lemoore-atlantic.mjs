/**
 * Seed mock residential data on Atlantic Ave & Acacia Dr in Lemoore, CA
 * Usage: node scripts/seed-lemoore-atlantic.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';
const GOOGLE_API_KEY = 'AIzaSyDPQhfHosE7BH9NnyB24TcJtTcYIqPYsHA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MOCK_LEADS = [
  // ── North side of Atlantic Ave (west to east) ──
  {
    property_address: '1560 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Daniel Herrera', owner_name: 'Daniel & Maria Herrera',
    phone: '(559) 924-3187', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1560 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$365,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1850, year_built: 2005, lot_acres: 0.18,
    notes: 'Sqft: 1850 | Built: 2005 | Lot: 0.18 acres | Owner Type: Individual',
  },
  {
    property_address: '1548 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Kevin Nakamura', owner_name: 'Kevin Nakamura',
    phone: '(559) 997-4521', phone_2: '(559) 997-4522', email: 'knakamura@gmail.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1548 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$372,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1920, year_built: 2005, lot_acres: 0.17,
    notes: 'Sqft: 1920 | Built: 2005 | Lot: 0.17 acres | Owner Type: Individual',
  },
  {
    property_address: '1536 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Rachel Dominguez', owner_name: 'Rachel Dominguez',
    phone: '(559) 362-8044', phone_2: null, email: 'rdominguez@yahoo.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1536 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$358,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1780, year_built: 2004, lot_acres: 0.17,
    notes: 'Sqft: 1780 | Built: 2004 | Lot: 0.17 acres | Owner Type: Individual',
  },
  {
    property_address: '1512 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Brian Watts', owner_name: 'Brian & Connie Watts',
    phone: '(559) 408-6193', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1512 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$381,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 2010, year_built: 2005, lot_acres: 0.19,
    listing_status: 'Sold', listing_price: 389000, selling_price: 381000, selling_date: '2026-02-20', listing_date: '2025-12-15', dom: 52,
    notes: 'Sqft: 2010 | Built: 2005 | Lot: 0.19 acres | Owner Type: Individual | Sold 02/2026 for $381k',
  },
  {
    property_address: '1464 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Jose Padilla', owner_name: 'Jose & Laura Padilla',
    phone: '(559) 741-2058', phone_2: '(559) 741-2059', email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1464 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$395,000', source: 'PropWire', status: 'new', priority: 'high',
    sqft: 2150, year_built: 2006, lot_acres: 0.20,
    notes: 'Sqft: 2150 | Built: 2006 | Lot: 0.20 acres | Owner Type: Individual',
  },
  {
    property_address: '1448 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Stephanie Tran', owner_name: 'Stephanie Tran',
    phone: '(559) 513-7840', phone_2: null, email: 'steph.tran@hotmail.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '8400 N Palm Ave', mailing_city: 'Fresno', mailing_state: 'CA', mailing_zip: '93711',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$348,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1750, year_built: 2004, lot_acres: 0.16,
    notes: 'Sqft: 1750 | Built: 2004 | Lot: 0.16 acres | Owner Type: Individual | ABSENTEE OWNER',
  },
  {
    property_address: '1432 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Mark Ellison', owner_name: 'Mark & Jennifer Ellison',
    phone: '(559) 286-9473', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1432 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$370,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1890, year_built: 2005, lot_acres: 0.18,
    notes: 'Sqft: 1890 | Built: 2005 | Lot: 0.18 acres | Owner Type: Individual',
  },
  {
    property_address: '1416 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Lisa Campos', owner_name: 'Lisa Campos',
    phone: '(559) 654-3201', phone_2: '(559) 654-3202', email: 'lcampos@outlook.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1416 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$362,000', source: 'PropWire', status: 'new', priority: 'low',
    sqft: 1820, year_built: 2005, lot_acres: 0.17,
    notes: 'Sqft: 1820 | Built: 2005 | Lot: 0.17 acres | Owner Type: Individual',
  },
  {
    property_address: '1400 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Anthony Reeves', owner_name: 'Anthony Reeves',
    phone: '(559) 878-1546', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1400 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$355,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1790, year_built: 2004, lot_acres: 0.17,
    notes: 'Sqft: 1790 | Built: 2004 | Lot: 0.17 acres | Owner Type: Individual',
  },
  {
    property_address: '1384 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Sandra Kowalski', owner_name: 'Sandra Kowalski',
    phone: '(559) 429-7680', phone_2: null, email: 'sandrak@gmail.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1384 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$345,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1720, year_built: 2004, lot_acres: 0.16,
    listing_status: 'Active', listing_price: 349900, listing_date: '2026-03-15', dom: 21,
    notes: 'Sqft: 1720 | Built: 2004 | Lot: 0.16 acres | Owner Type: Individual | Active listing $349,900',
  },

  // ── South side of Atlantic Ave / Acacia Dr ──
  {
    property_address: '1559 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Roberto Silva', owner_name: 'Roberto & Ana Silva',
    phone: '(559) 301-5824', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1559 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$378,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1960, year_built: 2005, lot_acres: 0.19,
    notes: 'Sqft: 1960 | Built: 2005 | Lot: 0.19 acres | Owner Type: Individual',
  },
  {
    property_address: '1547 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Tammy Larsen', owner_name: 'Tammy Larsen',
    phone: '(559) 782-4139', phone_2: '(559) 782-4140', email: 'tlarsen@sbcglobal.net',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1547 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$352,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1810, year_built: 2004, lot_acres: 0.17,
    notes: 'Sqft: 1810 | Built: 2004 | Lot: 0.17 acres | Owner Type: Individual',
  },
  {
    property_address: '1535 Atlantic Ave, Lemoore, CA, 93245',
    name: 'Derek Fujimoto', owner_name: 'Derek Fujimoto',
    phone: '(559) 615-9027', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1535 Atlantic Ave', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$368,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1870, year_built: 2005, lot_acres: 0.18,
    notes: 'Sqft: 1870 | Built: 2005 | Lot: 0.18 acres | Owner Type: Individual',
  },
  {
    property_address: '1467 Acacia Dr, Lemoore, CA, 93245',
    name: 'Carmen Avila', owner_name: 'Carmen Avila',
    phone: '(559) 438-2716', phone_2: null, email: 'cavila@icloud.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1467 Acacia Dr', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$385,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 2020, year_built: 2006, lot_acres: 0.19,
    notes: 'Sqft: 2020 | Built: 2006 | Lot: 0.19 acres | Owner Type: Individual',
  },
  {
    property_address: '1451 Acacia Dr, Lemoore, CA, 93245',
    name: 'Troy McAllister', owner_name: 'Troy & Dawn McAllister',
    phone: '(559) 567-8342', phone_2: null, email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1451 Acacia Dr', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$375,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1940, year_built: 2005, lot_acres: 0.18,
    notes: 'Sqft: 1940 | Built: 2005 | Lot: 0.18 acres | Owner Type: Individual',
  },
  {
    property_address: '1435 Acacia Dr, Lemoore, CA, 93245',
    name: 'Michelle Orozco', owner_name: 'Michelle Orozco',
    phone: '(559) 893-1054', phone_2: '(559) 893-1055', email: null,
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '3200 W Shaw Ave', mailing_city: 'Fresno', mailing_state: 'CA', mailing_zip: '93711',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$342,000', source: 'PropWire', status: 'new', priority: 'high',
    sqft: 1700, year_built: 2004, lot_acres: 0.16,
    notes: 'Sqft: 1700 | Built: 2004 | Lot: 0.16 acres | Owner Type: Individual | ABSENTEE OWNER',
  },
  {
    property_address: '1387 Acacia Dr, Lemoore, CA, 93245',
    name: 'Gary Pham', owner_name: 'Gary & Linda Pham',
    phone: '(559) 204-6538', phone_2: null, email: 'garypham@gmail.com',
    city: 'Lemoore', state: 'CA', zip: '93245',
    mailing_address: '1387 Acacia Dr', mailing_city: 'Lemoore', mailing_state: 'CA', mailing_zip: '93245',
    property_condition: 'Single Family Residence - RESIDENTIAL', price_range: '$390,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 2080, year_built: 2006, lot_acres: 0.20,
    notes: 'Sqft: 2080 | Built: 2006 | Lot: 0.20 acres | Owner Type: Individual',
  },
];

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

async function main() {
  console.log('Seeding Atlantic Ave / Acacia Dr, Lemoore...\n');

  // Dedup
  const { data: existing } = await supabase.from('leads').select('property_address');
  const existingSet = new Set(
    (existing || []).map(l => l.property_address?.toLowerCase().split(',')[0].trim()).filter(Boolean)
  );

  const toInsert = MOCK_LEADS.filter(l => {
    const key = l.property_address.toLowerCase().split(',')[0].trim();
    return !existingSet.has(key);
  });

  if (toInsert.length === 0) {
    console.log('All properties already exist.');
    return;
  }

  console.log(`Inserting ${toInsert.length} leads...`);
  const { data: inserted, error } = await supabase.from('leads').insert(toInsert).select('id, property_address');
  if (error) { console.error('Insert error:', error.message); return; }
  console.log(`Inserted ${inserted.length} leads\n`);

  // Geocode
  console.log('Geocoding...');
  let geocoded = 0;
  for (let i = 0; i < inserted.length; i++) {
    const lead = inserted[i];
    const coords = await geocodeAddress(lead.property_address);
    if (coords) {
      await supabase.from('leads')
        .update({ latitude: coords.lat, longitude: coords.lng, geocoded_at: new Date().toISOString() })
        .eq('id', lead.id);
      console.log(`  ${lead.property_address} -> ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      geocoded++;
    } else {
      console.log(`  ${lead.property_address} -> FAILED`);
    }
    await delay(50);
  }

  console.log(`\nGeocoded ${geocoded}/${inserted.length} leads`);
  console.log('Done!');
}

main().catch(console.error);
