import { createServerSupabase, supabaseAdmin } from './supabase-server';
import { ADMIN_TIER, getTier, type TierConfig } from './tier-config';

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
 * Check if a user is an admin.
 * Admins bypass ALL billing gates (credit checks, wallet deductions, limits).
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return !!data?.is_admin;
}

/**
 * Get the user's tier config based on their subscription.
 * Admin users always get the ADMIN_TIER (unlimited everything).
 */
export async function getTierForUser(userId: string): Promise<TierConfig> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_price_id, is_admin')
    .eq('id', userId)
    .single();
  if (data?.is_admin) return ADMIN_TIER;
  return getTier(data?.subscription_status || null, data?.stripe_price_id || null);
}

/**
 * Get both the tier and the admin flag in a single DB round-trip.
 * Use this in API routes that need to branch on isAdmin (to skip usage
 * writes and wallet deductions).
 */
export async function getBillingContext(userId: string): Promise<{ tier: TierConfig; isAdmin: boolean }> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_price_id, is_admin')
    .eq('id', userId)
    .single();
  const isAdmin = !!data?.is_admin;
  const tier = isAdmin ? ADMIN_TIER : getTier(data?.subscription_status || null, data?.stripe_price_id || null);
  return { tier, isAdmin };
}
