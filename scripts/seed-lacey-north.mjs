/**
 * Seed north side of Lacey Blvd — commercial properties opposite the south side.
 * Usage: node scripts/seed-lacey-north.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NORTH_SIDE = [
  {
    property_address: '100 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Manuel Reyes', owner_name: 'Manuel Reyes',
    phone: '(559) 413-7602', phone_2: '(559) 413-7603', email: 'mreyes@valleyprintshop.com',
    mailing_address: '100 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Retail - COMMERCIAL', price_range: '$195,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 2100, year_built: 1966, lot_acres: 0.10,
    notes: 'Sqft: 2100 | Built: 1966 | Lot: 0.10 acres | Owner Type: Individual | Valley Print & Copy',
  },
  {
    property_address: '108 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Susan Takahashi', owner_name: 'Susan Takahashi',
    phone: '(559) 587-3241', phone_2: null, email: 'sue@hanfordfloral.com',
    mailing_address: '108 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Retail - COMMERCIAL', price_range: '$165,000', source: 'PropWire', status: 'new', priority: 'low',
    sqft: 1400, year_built: 1959, lot_acres: 0.07,
    notes: 'Sqft: 1400 | Built: 1959 | Lot: 0.07 acres | Owner Type: Individual | Hanford Floral & Gifts',
  },
  {
    property_address: '114 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Eddie Morales', owner_name: 'Eduardo Morales',
    phone: '(559) 362-8105', phone_2: '(559) 362-8106', email: null,
    mailing_address: '3450 N Douty St', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Commercial - COMMERCIAL', price_range: '$225,000', source: 'PropWire', status: 'new', priority: 'high',
    sqft: 3100, year_built: 1962, lot_acres: 0.13,
    listing_status: 'Active', listing_price: 225000, listing_date: '2026-02-18', dom: 46,
    notes: 'Sqft: 3100 | Built: 1962 | Lot: 0.13 acres | Owner Type: Individual | Morales Barber Shop & Salon | Active listing $225k',
  },
  {
    property_address: '120 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Diane Vang', owner_name: 'Diane & Paul Vang',
    phone: '(559) 904-5517', phone_2: null, email: 'dianevang@gmail.com',
    mailing_address: '120 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Commercial - COMMERCIAL', price_range: '$180,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1900, year_built: 1971, lot_acres: 0.09,
    notes: 'Sqft: 1900 | Built: 1971 | Lot: 0.09 acres | Owner Type: Individual | Pho Hanford Vietnamese Restaurant',
  },
  {
    property_address: '126 W Lacey Blvd, Hanford, CA, 93230',
    name: 'George Kazarian', owner_name: 'Kazarian Properties LLC',
    phone: '(559) 281-6473', phone_2: '(559) 281-6474', email: 'gkazarian@kazprops.com',
    mailing_address: '9100 N Fresno St', mailing_city: 'Fresno', mailing_state: 'CA', mailing_zip: '93720',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Office - COMMERCIAL', price_range: '$340,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 4800, year_built: 1978, lot_acres: 0.19,
    notes: 'Sqft: 4800 | Built: 1978 | Lot: 0.19 acres | Owner Type: Corporate | Kazarian Professional Center',
  },
  {
    property_address: '132 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Rosa Delgado', owner_name: 'Rosa M. Delgado',
    phone: '(559) 674-9328', phone_2: null, email: null,
    mailing_address: '132 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Retail - COMMERCIAL', price_range: '$145,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1100, year_built: 1954, lot_acres: 0.05,
    notes: "Sqft: 1100 | Built: 1954 | Lot: 0.05 acres | Owner Type: Individual | Rosa's Alterations & Bridal",
  },
  {
    property_address: '138 W Lacey Blvd, Hanford, CA, 93230',
    name: "Kevin O'Brien", owner_name: "Kevin O'Brien",
    phone: '(559) 528-4190', phone_2: '(559) 528-4191', email: 'kevin@kingsinsurance.net',
    mailing_address: '138 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Office - COMMERCIAL', price_range: '$260,000', source: 'PropWire', status: 'new', priority: 'low',
    sqft: 2600, year_built: 1982, lot_acres: 0.11,
    listing_status: 'Sold', listing_price: 270000, selling_price: 258000, selling_date: '2026-02-28', listing_date: '2025-12-10', dom: 62,
    notes: 'Sqft: 2600 | Built: 1982 | Lot: 0.11 acres | Owner Type: Individual | Kings Insurance Agency | Sold 02/2026 for $258k',
  },
  {
    property_address: '144 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Sanchez Family Trust', owner_name: 'Sanchez Family Trust',
    phone: '(559) 753-2086', phone_2: null, email: null,
    mailing_address: '6720 W Caldwell Ave', mailing_city: 'Visalia', mailing_state: 'CA', mailing_zip: '93291',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Commercial - COMMERCIAL', price_range: '$200,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 2800, year_built: 1965, lot_acres: 0.12,
    notes: 'Sqft: 2800 | Built: 1965 | Lot: 0.12 acres | Owner Type: Trust | VACANT STOREFRONT - former bakery',
  },
  {
    property_address: '150 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Tony Xiong', owner_name: 'Tony Xiong',
    phone: '(559) 839-6145', phone_2: '(559) 839-6146', email: 'tonyxiong@cellrepairpro.com',
    mailing_address: '150 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Retail - COMMERCIAL', price_range: '$160,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 1300, year_built: 1969, lot_acres: 0.06,
    notes: 'Sqft: 1300 | Built: 1969 | Lot: 0.06 acres | Owner Type: Individual | Cell Repair Pro',
  },
  {
    property_address: '156 W Lacey Blvd, Hanford, CA, 93230',
    name: 'Margaret Liu', owner_name: 'Margaret Liu',
    phone: '(559) 461-7832', phone_2: null, email: 'margaret@goldendragonhanford.com',
    mailing_address: '156 W Lacey Blvd', mailing_city: 'Hanford', mailing_state: 'CA', mailing_zip: '93230',
    city: 'Hanford', state: 'CA', zip: '93230',
    property_condition: 'Commercial - COMMERCIAL', price_range: '$285,000', source: 'PropWire', status: 'new', priority: 'medium',
    sqft: 3400, year_built: 1960, lot_acres: 0.15,
    notes: 'Sqft: 3400 | Built: 1960 | Lot: 0.15 acres | Owner Type: Individual | Golden Dragon Chinese Restaurant',
  },
];

async function main() {
  console.log('Seeding north side of Lacey Blvd...\n');

  // Dedup
  const { data: existing } = await supabase.from('leads').select('property_address');
  const existingSet = new Set(
    (existing || []).map(l => l.property_address?.toLowerCase().split(',')[0].trim()).filter(Boolean)
  );

  const toInsert = NORTH_SIDE.filter(l => {
    const key = l.property_address.toLowerCase().split(',')[0].trim();
    return !existingSet.has(key);
  });

  if (toInsert.length === 0) {
    console.log('All north-side properties already exist.');
    return;
  }

  console.log(`Inserting ${toInsert.length} leads...`);

  const { data: inserted, error } = await supabase.from('leads').insert(toInsert).select('id, property_address');
  if (error) { console.error('Insert error:', error.message); return; }

  console.log(`Inserted ${inserted.length} leads\n`);

  // Place on north side — same lng range as south side, lat shifted ~0.0003 north
  const baseLat = 36.3282;
  const startLng = -119.6490;
  const endLng = -119.6540;
  const step = (endLng - startLng) / (inserted.length - 1);

  for (let i = 0; i < inserted.length; i++) {
    const lead = inserted[i];
    const lat = baseLat + (Math.random() * 0.0001 - 0.00005);
    const lng = startLng + step * i;

    await supabase.from('leads')
      .update({ latitude: lat, longitude: lng, geocoded_at: new Date().toISOString() })
      .eq('id', lead.id);

    console.log(`  ${lead.property_address} -> ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
