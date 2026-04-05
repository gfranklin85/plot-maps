import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // '2026-04'
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = getCurrentMonth();

  // Get or create usage record for this month
  let { data } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .single();

  if (!data) {
    // Determine limit based on subscription
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();

    const limit = profile?.subscription_status === 'active' ? 2000 : 500;

    const { data: created } = await supabaseAdmin
      .from('usage_tracking')
      .insert({ user_id: user.id, month, geocodes_used: 0, geocodes_limit: limit })
      .select()
      .single();

    data = created;
  }

  return NextResponse.json({
    month: data?.month,
    geocodes_used: data?.geocodes_used || 0,
    geocodes_limit: data?.geocodes_limit || 500,
    geocodes_remaining: Math.max(0, (data?.geocodes_limit || 500) - (data?.geocodes_used || 0)),
  });
}

// Increment geocode usage
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { count = 1 } = await request.json();
  const month = getCurrentMonth();

  // Get current usage
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .single();

  if (!usage) {
    // Create if doesn't exist
    await supabaseAdmin
      .from('usage_tracking')
      .insert({ user_id: user.id, month, geocodes_used: count, geocodes_limit: 500 });

    return NextResponse.json({ geocodes_used: count, geocodes_remaining: 500 - count });
  }

  const newUsed = (usage.geocodes_used || 0) + count;

  await supabaseAdmin
    .from('usage_tracking')
    .update({ geocodes_used: newUsed, updated_at: new Date().toISOString() })
    .eq('id', usage.id);

  return NextResponse.json({
    geocodes_used: newUsed,
    geocodes_remaining: Math.max(0, (usage.geocodes_limit || 500) - newUsed),
    over_limit: newUsed > (usage.geocodes_limit || 500),
  });
}
