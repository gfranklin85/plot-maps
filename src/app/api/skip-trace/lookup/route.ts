import { NextResponse } from 'next/server';
import { getAuthUser, isSubscribed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { instantLookup } from '@/lib/tracerfy';
import { logCost } from '@/lib/cost-tracker';

const LOOKUP_COST_CENTS = 50; // $0.50 charged to user wallet per lookup

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await isSubscribed(user.id)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const { leadId, address, city, state, zip } = await request.json();

    if (!address || !city || !state) {
      return NextResponse.json({ error: 'address, city, and state required' }, { status: 400 });
    }

    // Check wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id, balance_cents, total_spent_cents')
      .eq('user_id', user.id)
      .single();

    if (!wallet || wallet.balance_cents < LOOKUP_COST_CENTS) {
      return NextResponse.json({
        error: 'insufficient_balance',
        balance_cents: wallet?.balance_cents || 0,
        required_cents: LOOKUP_COST_CENTS,
      }, { status: 402 });
    }

    // Call Tracerfy instant lookup
    const result = await instantLookup(address, city, state, zip);

    // Only charge if we got a hit
    if (result.hit && result.persons.length > 0) {
      // Deduct from wallet
      const newBalance = wallet.balance_cents - LOOKUP_COST_CENTS;
      await supabaseAdmin
        .from('wallets')
        .update({
          balance_cents: newBalance,
          total_spent_cents: wallet.total_spent_cents + LOOKUP_COST_CENTS,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      await supabaseAdmin.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'spend',
        amount_cents: LOOKUP_COST_CENTS,
        balance_after_cents: newBalance,
        description: `Owner lookup — ${address.split(',')[0]}`,
      });

      // Extract best data from the first person result
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

      // Update the lead record if leadId provided
      if (leadId) {
        await supabaseAdmin
          .from('leads')
          .update({
            owner_name: ownerName || undefined,
            phone: phones[0] || undefined,
            phone_2: phones[1] || undefined,
            phone_3: phones[2] || undefined,
            email: email || undefined,
            mailing_address: mailingAddr || undefined,
          })
          .eq('id', leadId)
          .eq('user_id', user.id);
      }

      // Log cost
      logCost(user.id, 'tracerfy', 'instant_lookup', 0.10, 1, { hit: true, address });

      return NextResponse.json({
        hit: true,
        owner_name: ownerName,
        phones,
        email,
        mailing_address: mailingAddr,
        persons: result.persons,
        charged_cents: LOOKUP_COST_CENTS,
        balance_cents: newBalance,
      });
    }

    // Miss — no charge
    return NextResponse.json({
      hit: false,
      owner_name: null,
      phones: [],
      email: null,
      charged_cents: 0,
      balance_cents: wallet.balance_cents,
    });
  } catch (err) {
    console.error('Skip trace lookup error:', err);
    const message = err instanceof Error ? err.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
