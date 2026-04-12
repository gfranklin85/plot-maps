import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get or create wallet
  let { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!wallet) {
    const { data: created } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: user.id })
      .select('*')
      .single();
    wallet = created;
  }

  if (!wallet) {
    return NextResponse.json({ error: 'Failed to get wallet' }, { status: 500 });
  }

  return NextResponse.json({
    balance_cents: wallet.balance_cents,
    balance: (wallet.balance_cents / 100).toFixed(2),
    total_deposited: (wallet.total_deposited_cents / 100).toFixed(2),
    total_spent: (wallet.total_spent_cents / 100).toFixed(2),
  });
}
