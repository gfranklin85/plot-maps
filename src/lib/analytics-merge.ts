import { supabaseAdmin } from '@/lib/supabase-server';

export async function mergeAnonymousSession(anonymousId: string, userId: string) {
  // Find the anonymous session
  const { data: session } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id')
    .eq('anonymous_id', anonymousId)
    .single();

  if (!session) return;

  // Mark session as converted
  await supabaseAdmin
    .from('anonymous_sessions')
    .update({
      user_id: userId,
      converted: true,
      converted_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  // Link all events to the user
  await supabaseAdmin
    .from('analytics_events')
    .update({ user_id: userId })
    .eq('anonymous_id', anonymousId);

  // Update profile last_active_at
  await supabaseAdmin
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
}
