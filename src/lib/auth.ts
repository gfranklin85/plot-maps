import { createServerSupabase, supabaseAdmin } from './supabase-server';

/**
 * Get the authenticated user from the request cookies.
 * Use in API routes to verify auth and get user ID.
 */
export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Check if a user has an active subscription.
 */
export async function isSubscribed(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();
  return data?.subscription_status === 'active';
}

/**
 * Get the user's tier config based on their subscription.
 */
export async function getTierForUser(userId: string) {
  const { getTier } = await import('./tier-config');
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_price_id')
    .eq('id', userId)
    .single();
  return getTier(data?.subscription_status || null, data?.stripe_price_id || null);
}
