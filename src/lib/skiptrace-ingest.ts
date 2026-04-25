// Shared ingestion logic used by both the Tracerfy webhook handler
// (POST /api/webhooks/tracerfy) and the admin backfill route
// (POST /api/admin/skiptrace/backfill). Lives in lib/ so we can keep
// route.ts files clean (Next.js complains about non-method exports).

import { supabaseAdmin } from '@/lib/supabase-server';
import { getQueueResults } from '@/lib/tracerfy';

export interface OrderAddress {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_id?: string;
}

export function normalizeAddr(s: string | null | undefined): string {
  if (!s) return '';
  return s.toUpperCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
}

export interface IngestSummary {
  matched: number;
  total: number;
}

export async function ingestQueueResults({
  queueId,
  orderId,
  userId,
  orderAddresses,
}: {
  queueId: number;
  orderId: string;
  userId: string;
  orderAddresses: OrderAddress[];
}): Promise<IngestSummary> {
  const results = await getQueueResults(queueId);

  const byAddr = new Map<string, OrderAddress>();
  for (const a of orderAddresses) {
    if (a.address) byAddr.set(normalizeAddr(a.address), a);
  }
  const matchedLeadIds = new Set<string>();

  let matched = 0;

  if (results && results.length > 0) {
    for (const result of results) {
      const traceAddr = result.address?.trim();
      if (!traceAddr) continue;

      const ownerName = [result.first_name, result.last_name].filter(Boolean).join(' ').trim() || null;
      const allPhones = [
        result.primary_phone,
        result.mobile_1, result.mobile_2, result.mobile_3,
        result.landline_1, result.landline_2,
      ].filter(p => p && p.trim());
      const phones = Array.from(new Set(allPhones)).slice(0, 3);
      const email = result.email_1?.trim() || null;
      const mailingAddr = [result.mail_address, result.mail_city, result.mail_state]
        .filter(Boolean).join(', ') || null;

      const hasContact = ownerName || phones.length > 0 || email;
      const status = hasContact ? 'completed' : 'not_found';

      const orderEntry = byAddr.get(normalizeAddr(traceAddr));
      let targetIds: string[] = [];

      if (orderEntry?.lead_id) {
        targetIds = [orderEntry.lead_id];
      } else {
        const { data: leads } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('user_id', userId)
          .ilike('property_address', `${traceAddr}%`)
          .limit(5);
        targetIds = (leads || []).map(l => l.id);
      }

      for (const id of targetIds) {
        const update: Record<string, unknown> = { skiptrace_status: status };
        if (ownerName) update.owner_name = ownerName;
        if (phones[0]) update.phone = phones[0];
        if (phones[1]) update.phone_2 = phones[1];
        if (phones[2]) update.phone_3 = phones[2];
        if (email) update.email = email;
        if (mailingAddr) update.mailing_address = mailingAddr;

        await supabaseAdmin.from('leads').update(update).eq('id', id);
        matchedLeadIds.add(id);
        if (status === 'completed') matched++;
      }
    }
  }

  // Any ordered address whose lead wasn't returned by the vendor → not_found
  for (const a of orderAddresses) {
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
    .eq('id', orderId);

  console.log(`Tracerfy ingest: order ${orderId} fulfilled, ${matched} leads populated`);
  return { matched, total: orderAddresses.length };
}
