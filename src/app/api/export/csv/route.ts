import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const FORMAT_COLUMNS: Record<string, string[]> = {
  'phone-list': ['owner_name', 'name', 'phone', 'phone_2', 'property_address'],
  'address-list': ['property_address', 'city', 'state', 'zip', 'owner_name'],
  'call-sheet': ['owner_name', 'name', 'phone', 'phone_2', 'phone_3', 'property_address', 'status', 'notes'],
  'mailing-sheet': ['owner_name', 'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip', 'property_address'],
};

const ALL_COLUMNS = [
  'id', 'name', 'owner_name', 'email', 'phone', 'phone_2', 'phone_3',
  'property_address', 'city', 'state', 'zip',
  'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
  'status', 'priority', 'source', 'tags', 'notes',
  'follow_up_date', 'last_contact_date',
  'price_range', 'property_condition', 'motivation',
  'latitude', 'longitude',
  'created_at', 'updated_at',
];

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join('; ') : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadIds, format, columns: customColumns } = body as {
      leadIds: string[];
      format: string;
      columns?: string[];
    };

    if (!leadIds || leadIds.length === 0) {
      return NextResponse.json({ error: 'No lead IDs provided' }, { status: 400 });
    }

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', leadIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads found' }, { status: 404 });
    }

    let selectedColumns: string[];
    if (format === 'full') {
      selectedColumns = customColumns && customColumns.length > 0 ? customColumns : ALL_COLUMNS;
    } else {
      selectedColumns = FORMAT_COLUMNS[format] || ALL_COLUMNS;
    }

    const headerRow = selectedColumns.join(',');
    const dataRows = leads.map((lead) =>
      selectedColumns.map((col) => escapeCsvValue(lead[col])).join(',')
    );
    const csv = [headerRow, ...dataRows].join('\n');

    const filename = `leads-${format}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
