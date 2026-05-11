// Server-only silent skip-trace.
//
// Plot's product trait: raw owner phone/name are never returned to the client.
// This wrapper hits Tracerfy, persists the result on the leads row server-side,
// and returns only a hit/no-hit verdict + cached phone availability for callers
// that need to gate downstream actions (e.g. dial). It MUST NOT be called from
// client code or have its return value forwarded to the client.

import { instantLookup } from './tracerfy';
import { supabaseAdmin } from './supabase-server';
import { logCost } from './cost-tracker';

export interface SilentLookupOutcome {
  hit: boolean;
  has_phone: boolean;
  has_email: boolean;
  has_mailing_address: boolean;
}

/**
 * Looks up the owner for a lead via Tracerfy, writes the results back to the
 * leads row server-side, and returns only a sanitised summary. Phone, email,
 * owner_name, and mailing_address never leave server memory. Subsequent calls
 * return cached availability if the lead row already has a phone.
 */
export async function silentLookup(params: {
  userId: string;
  leadId: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
}): Promise<SilentLookupOutcome> {
  const { userId, leadId, address, city, state, zip } = params;

  // If the lead already has skip-trace data, skip the API call.
  const { data: existing } = await supabaseAdmin
    .from('leads')
    .select('phone, email, mailing_address')
    .eq('id', leadId)
    .single();
  if (existing?.phone) {
    return {
      hit: true,
      has_phone: !!existing.phone,
      has_email: !!existing.email,
      has_mailing_address: !!existing.mailing_address,
    };
  }

  let result;
  try {
    result = await instantLookup(address, city, state, zip);
  } catch (err) {
    console.error('silentLookup tracerfy error:', err);
    return { hit: false, has_phone: false, has_email: false, has_mailing_address: false };
  }

  if (!result.hit || !result.persons.length) {
    return { hit: false, has_phone: false, has_email: false, has_mailing_address: false };
  }

  const person = result.persons[0];
  const phones = (person.phones || [])
    .filter(p => p.number && !p.dnc)
    .sort((a, b) => a.rank - b.rank)
    .map(p => p.number)
    .slice(0, 3);
  const email = person.emails?.[0]?.email || null;
  const ownerName = person.full_name || null;
  const mailingAddr = person.mailing_address
    ? [
        person.mailing_address.street,
        person.mailing_address.city,
        person.mailing_address.state,
        person.mailing_address.zip,
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  await supabaseAdmin
    .from('leads')
    .update({
      owner_name: ownerName || undefined,
      phone: phones[0] || undefined,
      phone_2: phones[1] || undefined,
      phone_3: phones[2] || undefined,
      email: email || undefined,
      mailing_address: mailingAddr || undefined,
      skiptrace_status: 'completed',
    })
    .eq('id', leadId)
    .eq('user_id', userId);

  logCost(userId, 'tracerfy', 'instant_lookup', 0.1, 1, { hit: true, address, silent: true });

  return {
    hit: true,
    has_phone: !!phones[0],
    has_email: !!email,
    has_mailing_address: !!mailingAddr,
  };
}
