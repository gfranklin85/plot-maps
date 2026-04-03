import { createServerSupabase } from './supabase-server';

/**
 * Get the authenticated user from the request cookies.
 * Use in API routes to verify auth and get user ID.
 */
export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
