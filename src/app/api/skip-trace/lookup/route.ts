import { NextResponse } from 'next/server';
import { getAuthUser, getTierForUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { instantLookup } from '@/lib/tracerfy';
import { logCost } from '@/lib/cost-tracker';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tier = await getTierForUser(user.id);
    const { leadId, address, city, state, zip } = await request.json();

    if (!address || !city || !state) {
      return NextResponse.json({ error: 'address, city, and state required' }, { status: 400 });
    }

    // Check monthly skip trace allocation
    const month = getCurrentMonth();
    const isFree = tier.key === 'free';

    let usedCount = 0;
    if (isFree) {
      const { data: allUsage } = await supabaseAdmin
        .from('usage_tracking')
        .select('skip_traces_used')
        .eq('user_id', user.id);
      usedCount = (allUsage || []).reduce((s, r) => s + (r.skip_traces_used || 0), 0);
    } else {
      const { data: usage } = await supabaseAdmin
        .from('usage_tracking')
        .select('skip_traces_used')
        .eq('user_id', user.id)
        .eq('month', month)
        .single();
      usedCount = usage?.skip_traces_used || 0;
    }

    if (usedCount >= tier.skipTraces) {
      return NextResponse.json({
        error: 'limit_reached',
        message: `You've used all ${tier.skipTraces} skip traces this month.`,
        upgrade: true,
        tier: tier.key,
        skip_traces_used: usedCount,
        skip_traces_limit: tier.skipTraces,
      }, { status: 402 });
    }

    // Call Tracerfy
    const result = await instantLookup(address, city, state, zip);

    if (result.hit && result.persons.length > 0) {
      // Increment skip trace usage
      const { data: usage } = await supabaseAdmin
        .from('usage_tracking')
        .select('id, skip_traces_used')
        .eq('user_id', user.id)
        .eq('month', month)
        .single();

      if (usage) {
        await supabaseAdmin.from('usage_tracking')
          .update({ skip_traces_used: (usage.skip_traces_used || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', usage.id);
      } else {
        await supabaseAdmin.from('usage_tracking')
          .insert({ user_id: user.id, month, skip_traces_used: 1, geocodes_used: 0, geocodes_limit: tier.geocodes, skip_traces_limit: tier.skipTraces });
      }

      // Extract best data
      const person = result.persons[0];
      const phones = person.phones
        ?.filter(p => p.number && !p.dnc)
        .sort((a, b) => a.rank - b.rank)
        .map(p => p.number)
        .slice(0, 3) || [];
      const email = person.emails?.[0]?.email || null;
      const ownerName = person.full_name || null;
      const mailingAddr = person.mailing_address
        ? [person.mailing_address.street, person.mailing_address.city, person.mailing_address.state, person.mailing_address.zip].filter(Boolean).join(', ')
        : null;

      // Update lead record
      if (leadId) {
        await supabaseAdmin.from('leads').update({
          owner_name: ownerName || undefined,
          phone: phones[0] || undefined,
          phone_2: phones[1] || undefined,
          phone_3: phones[2] || undefined,
          email: email || undefined,
          mailing_address: mailingAddr || undefined,
        }).eq('id', leadId).eq('user_id', user.id);
      }

      logCost(user.id, 'tracerfy', 'instant_lookup', 0.10, 1, { hit: true, address });

      return NextResponse.json({
        hit: true,
        owner_name: ownerName,
        phones,
        email,
        mailing_address: mailingAddr,
        persons: result.persons,
      });
    }

    return NextResponse.json({ hit: false, owner_name: null, phones: [], email: null });
  } catch (err) {
    console.error('Skip trace lookup error:', err);
    const message = err instanceof Error ? err.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
