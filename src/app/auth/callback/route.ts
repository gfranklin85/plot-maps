import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { mergeAnonymousSession } from '@/lib/analytics-merge';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session?.user) {
      // Merge anonymous analytics session with the new user
      const cookieStore = await cookies();
      const anonId = cookieStore.get('pm_anon_id')?.value;
      if (anonId) {
        mergeAnonymousSession(anonId, data.session.user.id).catch(() => {
          /* non-blocking — don't fail auth for analytics */
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
