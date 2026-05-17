import { NextResponse } from 'next/server';
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Admin endpoint for flipping beta_access on/off for any profile by
// email. Caller must be authenticated AND marked is_admin = true on
// their own profile. The mutation uses the service-role client so
// it can bypass the per-row "users manage own profile" RLS — the
// admin check above is the gate.

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated', status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'not admin', status: 403 as const };
  return { user };
}

// GET — list waitlist entries + current beta_access status of all
// profiles. Used by the admin section in settings to render the list.
export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const [{ data: waitlist }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from('waitlist')
      .select('id, email, note, created_at, invited_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, beta_access, is_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return NextResponse.json({
    waitlist: waitlist ?? [],
    profiles: profiles ?? [],
  });
}

// POST — flip beta_access for a profile by email. Body: { email, grant }.
// `grant` is boolean: true → grant access, false → revoke.
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? '').toString().trim().toLowerCase();
  const grant = !!body.grant;
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Update the matching profile.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ beta_access: grant })
    .eq('email', email)
    .select('id, email, beta_access')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'no profile with that email' }, { status: 404 });

  // If we just granted access AND there's a matching waitlist entry,
  // stamp it as invited so the admin's list view stays organized.
  if (grant) {
    await supabaseAdmin
      .from('waitlist')
      .update({ invited_at: new Date().toISOString(), invited_by: gate.user.id })
      .eq('email', email);
  }

  return NextResponse.json({ profile: updated });
}
