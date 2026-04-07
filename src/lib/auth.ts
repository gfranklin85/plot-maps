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
