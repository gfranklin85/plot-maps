import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// CSV parser (same as imports page)
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

function parseDate(str: string): string | null {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [m, d, rawY] = parts.map(Number);
  const y = rawY < 100 ? rawY + 2000 : rawY;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const STATUS_MAP: Record<string, string> = { S: 'Sold', A: 'Active', T: 'Pending' };

// Field matchers for auto-detection
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

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin check
  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { csvText, marketTag } = await request.json();
  if (!csvText) {
    return NextResponse.json({ error: 'csvText is required' }, { status: 400 });
  }

  const { headers, rows } = parseCSV(csvText);
  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: 'No data found in CSV' }, { status: 400 });
  }

  // Auto-detect fields
  const fieldMap = new Map<string, string>();
  // Handle combined owner name
  const ownerFirst = headers.find(h => /owner.*first/i.test(h));
  const ownerLast = headers.find(h => /owner.*last/i.test(h));

  for (const matcher of FIELD_MATCHERS) {
    if (matcher.field === 'owner_name' && ownerFirst && ownerLast) continue;
    const match = headers.find(h => matcher.test(h));
    if (match) fieldMap.set(matcher.field, match);
  }

  function getVal(row: Record<string, string>, field: string): string {
    if (field === 'owner_name' && ownerFirst && ownerLast) {
      return `${row[ownerFirst] || ''} ${row[ownerLast] || ''}`.trim();
    }
    const header = fieldMap.get(field);
    return header ? (row[header] || '') : '';
  }

  let inserted = 0, updated = 0, errors = 0;
  const now = new Date().toISOString();

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
      city: city ? city.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase()) : '',
      state, zip: getVal(row, 'zip') || '',
      listing_status: STATUS_MAP[listingStatus] || listingStatus || null,
      listing_price: listingPrice,
      selling_price: sellingPrice,
      dom: Number(getVal(row, 'dom')) || null,
      sqft: Number(getVal(row, 'sqft')) || null,
      year_built: Number(getVal(row, 'year_built')) || null,
      lot_acres: Number(getVal(row, 'lot_acres')) || null,
      listing_date: parseDate(getVal(row, 'listing_date')),
      selling_date: parseDate(getVal(row, 'selling_date')),
      price_range: sellingPrice ? `$${sellingPrice.toLocaleString()}` : listingPrice ? `$${listingPrice.toLocaleString()}` : null,
      source: 'MLS',
      status: 'new' as const,
      record_type: 'context',
      user_id: null, // NO user_id — shared/public data
      last_imported_at: now,
      seeded_market_tag: marketTag || null,
    };

    // Check if this address already exists as context
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('record_type', 'context')
      .ilike('property_address', `${addrKey}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      const { error } = await supabaseAdmin
        .from('leads')
        .update({ ...leadData, property_address: undefined })
        .eq('id', existing[0].id);
      if (error) errors++; else updated++;
    } else {
      // Insert new
      const { error } = await supabaseAdmin.from('leads').insert(leadData);
      if (error) errors++; else inserted++;
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    errors,
    total: rows.length,
    marketTag: marketTag || null,
  });
}
