import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { normalizeAddr } from '@/lib/skiptrace-ingest';

// POST /api/admin/skiptrace/ingest-csv
// Body: { orderId?: string, csv: string }
//
// Manual CSV ingestion for stragglers — when Tracerfy delivered results
// to email instead of webhook (e.g. the webhook URL wasn't configured),
// admins paste the CSV here and the rows update matching leads.
//
// If orderId is given: matches addresses against the lead_ids stashed on
// that order. If omitted: best-effort match by user_id (must be admin's
// own user_id) + property_address prefix.
//
// CSV columns (Tracerfy export format):
//   address, city, state, first_name, last_name, mail_address, mail_city, mail_state,
//   primary_phone, primary_phone_type, Email-1..Email-5, Mobile-1..Mobile-5,
//   Landline-1..Landline-3
export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({})) as { orderId?: string; csv?: string; userId?: string };
  if (!body.csv) {
    return NextResponse.json({ error: 'csv required' }, { status: 400 });
  }

  // Determine target user_id and (optional) lead_id mapping
  let targetUserId = body.userId || user.id;
  type AddrEntry = { address: string; lead_id?: string };
  let orderAddrs: AddrEntry[] = [];

  if (body.orderId) {
    const { data: order } = await supabaseAdmin
      .from('prospect_orders')
      .select('id, user_id, addresses')
      .eq('id', body.orderId)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    targetUserId = order.user_id;
    orderAddrs = (order.addresses as AddrEntry[]) || [];
  }

  const byAddr = new Map<string, AddrEntry>();
  for (const a of orderAddrs) {
    if (a.address) byAddr.set(normalizeAddr(a.address), a);
  }

  // Parse CSV (simple — fields don't contain commas in this vendor's output)
  const lines = body.csv.trim().split(/\r?\n/);
  if (lines.length < 2) return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 });

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim());

  function pick(row: string[], header: string): string {
    const idx = headers.indexOf(header);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  }

  const matchedLeadIds = new Set<string>();
  let matched = 0;
  let notFound = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim());
    if (row.length < 3) continue;

    const address = pick(row, 'address');
    const city = pick(row, 'city');
    const state = pick(row, 'state');
    if (!address) continue;

    const fullAddr = [address, city, state].filter(Boolean).join(', ');
    const ownerName = [pick(row, 'first_name'), pick(row, 'last_name')].filter(Boolean).join(' ').trim() || null;

    const phones: string[] = [];
    const primary = pick(row, 'primary_phone');
    if (primary) phones.push(primary);
    for (const k of ['Mobile-1', 'Mobile-2', 'Mobile-3', 'Mobile-4', 'Mobile-5', 'Landline-1', 'Landline-2', 'Landline-3']) {
      const p = pick(row, k);
      if (p) phones.push(p);
    }
    const dedupedPhones = Array.from(new Set(phones)).slice(0, 3);

    const email = pick(row, 'Email-1') || null;
    const mailParts = [pick(row, 'mail_address'), pick(row, 'mail_city'), pick(row, 'mail_state')].filter(Boolean);
    const mailingAddr = mailParts.length > 0 ? mailParts.join(', ') : null;

    const hasContact = ownerName || dedupedPhones.length > 0 || email;
    const status = hasContact ? 'completed' : 'not_found';

    // Resolve target lead(s)
    let targetIds: string[] = [];
    const orderEntry = byAddr.get(normalizeAddr(address)) || byAddr.get(normalizeAddr(fullAddr));
    if (orderEntry?.lead_id) {
      targetIds = [orderEntry.lead_id];
    } else {
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('user_id', targetUserId)
        .ilike('property_address', `${address}%`)
        .limit(5);
      targetIds = (leads || []).map(l => l.id);
    }

    if (targetIds.length === 0) {
      notFound++;
      continue;
    }

    for (const id of targetIds) {
      const update: Record<string, unknown> = { skiptrace_status: status };
      if (ownerName) update.owner_name = ownerName;
      if (dedupedPhones[0]) update.phone = dedupedPhones[0];
      if (dedupedPhones[1]) update.phone_2 = dedupedPhones[1];
      if (dedupedPhones[2]) update.phone_3 = dedupedPhones[2];
      if (email) update.email = email;
      if (mailingAddr) update.mailing_address = mailingAddr;

      await supabaseAdmin.from('leads').update(update).eq('id', id);
      matchedLeadIds.add(id);
      if (status === 'completed') matched++;
    }
  }

  // Mark any remaining order leads not represented in the CSV as not_found
  if (body.orderId) {
    for (const a of orderAddrs) {
      if (a.lead_id && !matchedLeadIds.has(a.lead_id)) {
        await supabaseAdmin
          .from('leads')
          .update({ skiptrace_status: 'not_found' })
          .eq('id', a.lead_id)
          .eq('skiptrace_status', 'pending');
      }
    }
    await supabaseAdmin
      .from('prospect_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', body.orderId);
  }

  return NextResponse.json({
    ok: true,
    rows: lines.length - 1,
    matched,
    not_found_address: notFound,
  });
}
