import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// ── CSV Parser ──
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      rows.push(row);
    }
  }
  return { headers, rows };
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

// ── RPR Paste Parser ──
const RPR_STATUSES = ['Active Under Contract', 'Active', 'Pending', 'Sold', 'Closed', 'Expired', 'Withdrawn'];
const RPR_TYPES = ['SFR', 'MULT', 'LAND', 'FARM', 'MOBI', 'OTHER', 'CONDO', 'COOP'];
const NOISE_PATTERNS = [
  /^Property Image$/i,
  /^\d+ Selected$/i,
  /^Status$/i,
  /^Type$/i,
  /^Price\s/i,
  /^Address$/i,
  /^Beds$/i,
  /^Baths$/i,
  /^Sqft$/i,
  /^Lot Size$/i,
  /^Year Built$/i,
  /^\$\/sqft$/i,
  /^Saved$/i,
  /^Multiple Listings$/i,
  /^NEW$/i,
  /^OPEN:/i,
  /^Pre-foreclosure$/i,
  /^Foreclosure$/i,
];

interface RPRProperty {
  status: string;
  type: string;
  price: number | null;
  date: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_acres: number | null;
  year_built: number | null;
}

function parseRPR(text: string): RPRProperty[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Filter out noise lines
  const clean: string[] = [];
  for (const line of lines) {
    if (NOISE_PATTERNS.some(p => p.test(line))) continue;
    if (line === '–') continue;
    clean.push(line);
  }

  const properties: RPRProperty[] = [];
  let i = 0;

  while (i < clean.length) {
    // Look for a status line
    const statusMatch = RPR_STATUSES.find(s => clean[i] === s);
    if (!statusMatch) { i++; continue; }

    const status = statusMatch;
    i++;
    if (i >= clean.length) break;

    // Next should be property type
    const type = RPR_TYPES.includes(clean[i]) ? clean[i] : 'SFR';
    if (RPR_TYPES.includes(clean[i])) i++;

    // Look for price (starts with $)
    let price: number | null = null;
    while (i < clean.length && !clean[i].startsWith('$')) {
      i++; // skip "Multiple Listings", "NEW" etc that weren't caught
      if (i >= clean.length) break;
    }
    if (i < clean.length && clean[i].startsWith('$')) {
      price = Number(clean[i].replace(/[$,]/g, '')) || null;
      i++;
    }

    // Look for date (M/D/YY pattern)
    let date: string | null = null;
    if (i < clean.length && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(clean[i])) {
      const parts = clean[i].split('/').map(Number);
      if (parts.length === 3) {
        const y = parts[2] < 100 ? parts[2] + 2000 : parts[2];
        date = `${y}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
      }
      i++;
    }

    // Address line (street address)
    let address = '';
    if (i < clean.length && !RPR_STATUSES.includes(clean[i])) {
      address = clean[i];
      i++;
    }

    // City, State Zip line (e.g., "Hanford, CA 93230")
    let city = '', state = 'CA', zip = '';
    if (i < clean.length && clean[i].includes(',')) {
      const cityLine = clean[i];
      const commaIdx = cityLine.indexOf(',');
      city = cityLine.substring(0, commaIdx).trim();
      const stateZip = cityLine.substring(commaIdx + 1).trim();
      const stateZipParts = stateZip.split(/\s+/);
      if (stateZipParts.length >= 1) state = stateZipParts[0];
      if (stateZipParts.length >= 2) zip = stateZipParts[1];
      i++;

      // Combine address with city for full address
      address = `${address}, ${city}, ${state} ${zip}`;
    }

    // Beds (number or –)
    let beds: number | null = null;
    if (i < clean.length) {
      const b = Number(clean[i]);
      if (!isNaN(b) && b >= 0 && b <= 50) { beds = b; i++; }
      else if (clean[i] === '–') i++;
    }

    // Baths
    let baths: number | null = null;
    if (i < clean.length) {
      const b = Number(clean[i]);
      if (!isNaN(b) && b >= 0 && b <= 50) { baths = b; i++; }
      else if (clean[i] === '–') i++;
    }

    // Sqft (number with commas, or –)
    let sqft: number | null = null;
    if (i < clean.length) {
      const s = Number(clean[i].replace(/,/g, ''));
      if (!isNaN(s) && s > 50) { sqft = s; i++; }
      else if (clean[i] === '–') i++;
    }

    // Lot size (number) + unit (Acres or Sq Ft)
    let lot_acres: number | null = null;
    if (i < clean.length) {
      const lotNum = Number(clean[i].replace(/,/g, ''));
      if (!isNaN(lotNum) && lotNum > 0) {
        i++;
        if (i < clean.length) {
          if (clean[i] === 'Acres') { lot_acres = lotNum; i++; }
          else if (clean[i] === 'Sq Ft') { lot_acres = Math.round((lotNum / 43560) * 100) / 100; i++; }
          else { lot_acres = lotNum; } // assume acres
        }
      } else if (clean[i] === '–') i++;
    }

    // Year built
    let year_built: number | null = null;
    if (i < clean.length) {
      const y = Number(clean[i]);
      if (!isNaN(y) && y >= 1800 && y <= 2030) { year_built = y; i++; }
      else if (clean[i] === '–') i++;
    }

    // $/sqft (skip — we calculate it ourselves)
    if (i < clean.length && clean[i].startsWith('$')) i++;

    if (address) {
      properties.push({ status, type, price, date, address, city, state, zip, beds, baths, sqft, lot_acres, year_built });
    }
  }

  return properties;
}

// ── Shared date parser ──
function parseDateStr(str: string): string | null {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [m, d, rawY] = parts.map(Number);
  const y = rawY < 100 ? rawY + 2000 : rawY;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function titleCase(str: string): string {
  return str.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

// ── Auto-detect format ──
function detectFormat(text: string): 'csv' | 'rpr' {
  const firstLine = text.trim().split('\n')[0] || '';
  // If first line contains commas and looks like CSV headers
  if (firstLine.includes(',') && /address|owner|phone|status|city/i.test(firstLine)) return 'csv';
  // If text contains RPR status keywords
  if (RPR_STATUSES.some(s => text.includes(s)) && text.includes('Property Image')) return 'rpr';
  // If has typical RPR patterns
  if (/\$[\d,]+/.test(text) && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) && /CA \d{5}/.test(text)) return 'rpr';
  return 'csv'; // default
}

// ── CSV field matchers ──
const FIELD_MATCHERS: { field: string; test: (h: string) => boolean }[] = [
  { field: 'property_address', test: (h) => /address/i.test(h) && !/mail/i.test(h) },
  { field: 'owner_name', test: (h) => /owner.*(?:first|last|name)/i.test(h) },
  { field: 'name', test: (h) => /^name\s*1?$/i.test(h) || /contact.*name/i.test(h) },
  { field: 'phone', test: (h) => /phone\s*1?$/i.test(h) && !/2|3/i.test(h) },
  { field: 'city', test: (h) => /^city$/i.test(h) },
  { field: 'state', test: (h) => /^state$/i.test(h) },
  { field: 'zip', test: (h) => /^zip$/i.test(h) || /postal/i.test(h) },
  { field: 'listing_status', test: (h) => /^status$/i.test(h) },
  { field: 'listing_price', test: (h) => /listing.*price/i.test(h) },
  { field: 'selling_price', test: (h) => /selling.*price/i.test(h) },
  { field: 'dom', test: (h) => /^dom$/i.test(h) || /days.*market/i.test(h) },
  { field: 'sqft', test: (h) => /sq.*ft|square.*f/i.test(h) || /living.*sq/i.test(h) },
  { field: 'year_built', test: (h) => /year.*built/i.test(h) },
  { field: 'lot_acres', test: (h) => /lot.*acre|lot.*size/i.test(h) },
  { field: 'listing_date', test: (h) => /listing.*date/i.test(h) },
  { field: 'selling_date', test: (h) => /selling.*date/i.test(h) },
  { field: 'price_range', test: (h) => /price|value|estimated/i.test(h) },
];

const STATUS_MAP: Record<string, string> = { S: 'Sold', A: 'Active', T: 'Pending' };

export async function POST(request: Request) {
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

  const { csvText, marketTag, format: requestedFormat } = await request.json();
  if (!csvText) {
    return NextResponse.json({ error: 'Data is required' }, { status: 400 });
  }

  const format = requestedFormat || detectFormat(csvText);
  const now = new Date().toISOString();
  let inserted = 0, updated = 0, errors = 0, total = 0, geocoded = 0;
  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Geocode a single address — only for new records
  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`);
      const data = await res.json();
      if (data.results?.[0]?.geometry?.location) {
        return data.results[0].geometry.location;
      }
    } catch { /* non-fatal */ }
    return null;
  }

  if (format === 'rpr') {
    // ── RPR Paste Flow ──
    const properties = parseRPR(csvText);
    total = properties.length;

    if (total === 0) {
      return NextResponse.json({ error: 'No properties found in pasted text. Make sure you copied the full RPR listing data.' }, { status: 400 });
    }

    for (const prop of properties) {
      const addrKey = prop.address.split(',')[0].trim().toUpperCase();

      const leadData = {
        property_address: prop.address,
        name: prop.address.split(',')[0],
        city: titleCase(prop.city),
        state: prop.state,
        zip: prop.zip,
        listing_status: prop.status === 'Active Under Contract' ? 'Pending' : prop.status,
        listing_price: prop.price,
        sqft: prop.sqft,
        year_built: prop.year_built,
        lot_acres: prop.lot_acres,
        listing_date: prop.date,
        price_range: prop.price ? `$${prop.price.toLocaleString()}` : null,
        property_condition: prop.type,
        source: 'RPR',
        status: 'new' as const,
        record_type: 'context',
        user_id: null,
        last_imported_at: now,
        seeded_market_tag: marketTag || null,
      };

      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('record_type', 'context')
        .ilike('property_address', `${addrKey}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing record
        const { error } = await supabaseAdmin
          .from('leads')
          .update({ ...leadData, property_address: undefined })
          .eq('id', existing[0].id);
        if (error) { errors++; }
        else {
          updated++;
          // Geocode if existing record has no coordinates
          const { data: coordCheck } = await supabaseAdmin
            .from('leads')
            .select('latitude')
            .eq('id', existing[0].id)
            .single();
          if (!coordCheck?.latitude) {
            const geo = await geocodeAddress(prop.address);
            if (geo) {
              await supabaseAdmin.from('leads').update({
                latitude: geo.lat, longitude: geo.lng, geocoded_at: now,
              }).eq('id', existing[0].id);
              geocoded++;
            }
          }
        }
      } else {
        // Insert new — then geocode
        const { data: insertedData, error } = await supabaseAdmin.from('leads').insert(leadData).select('id').single();
        if (error) { errors++; }
        else {
          inserted++;
          // Geocode the new record
          const geo = await geocodeAddress(prop.address);
          if (geo && insertedData) {
            await supabaseAdmin.from('leads').update({
              latitude: geo.lat, longitude: geo.lng, geocoded_at: now,
            }).eq('id', insertedData.id);
            geocoded++;
          }
        }
      }
    }
  } else {
    // ── CSV Flow (existing logic) ──
    const { headers, rows } = parseCSV(csvText);
    total = rows.length;

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV' }, { status: 400 });
    }

    const fieldMap = new Map<string, string>();
    const ownerFirst = headers.find(h => /owner.*first/i.test(h));
    const ownerLast = headers.find(h => /owner.*last/i.test(h));

    for (const matcher of FIELD_MATCHERS) {
      if (matcher.field === 'owner_name' && ownerFirst && ownerLast) continue;
      const match = headers.find(h => matcher.test(h));
      if (match) fieldMap.set(matcher.field, match);
    }

    const getVal = (row: Record<string, string>, field: string): string => {
      if (field === 'owner_name' && ownerFirst && ownerLast) {
        return `${row[ownerFirst] || ''} ${row[ownerLast] || ''}`.trim();
      }
      const header = fieldMap.get(field);
      return header ? (row[header] || '') : '';
    }

    for (const row of rows) {
      const address = getVal(row, 'property_address');
      if (!address) { errors++; continue; }

      const addrKey = address.split(',')[0].trim().toUpperCase();
      const listingStatus = getVal(row, 'listing_status');
      const city = getVal(row, 'city') || address.split(',')[1]?.trim() || '';
      const state = getVal(row, 'state') || 'CA';
      const ownerName = getVal(row, 'owner_name') || getVal(row, 'name') || '';
      const sellingPrice = Number(getVal(row, 'selling_price')) || null;
      const listingPrice = Number(getVal(row, 'listing_price')) || null;

      const leadData = {
        property_address: address,
        name: ownerName || address.split(',')[0],
        owner_name: ownerName || null,
        phone: getVal(row, 'phone') || null,
        city: city ? titleCase(city) : '',
        state, zip: getVal(row, 'zip') || '',
        listing_status: STATUS_MAP[listingStatus] || listingStatus || null,
        listing_price: listingPrice,
        selling_price: sellingPrice,
        dom: Number(getVal(row, 'dom')) || null,
        sqft: Number(getVal(row, 'sqft')) || null,
        year_built: Number(getVal(row, 'year_built')) || null,
        lot_acres: Number(getVal(row, 'lot_acres')) || null,
        listing_date: parseDateStr(getVal(row, 'listing_date')),
        selling_date: parseDateStr(getVal(row, 'selling_date')),
        price_range: sellingPrice ? `$${sellingPrice.toLocaleString()}` : listingPrice ? `$${listingPrice.toLocaleString()}` : null,
        source: 'MLS',
        status: 'new' as const,
        record_type: 'context',
        user_id: null,
        last_imported_at: now,
        seeded_market_tag: marketTag || null,
      };

      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('record_type', 'context')
        .ilike('property_address', `${addrKey}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        const { error } = await supabaseAdmin
          .from('leads')
          .update({ ...leadData, property_address: undefined })
          .eq('id', existing[0].id);
        if (error) errors++; else updated++;
      } else {
        const { error } = await supabaseAdmin.from('leads').insert(leadData);
        if (error) errors++; else inserted++;
      }
    }
  }

  const geocodeCost = Math.round(geocoded * 0.7) / 100; // $0.007 per geocode

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    geocoded,
    errors,
    total,
    format,
    geocodeCost,
    marketTag: marketTag || null,
  });
}
