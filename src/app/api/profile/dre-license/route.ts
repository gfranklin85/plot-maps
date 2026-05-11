import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST — set the calling user's DRE (or equivalent) license number.
// Stored on profiles.dre_license_id. v1 trusts the entered value; state-API
// validation is Phase 2.
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dre_license_id } = (await request.json()) as { dre_license_id?: string };
  if (!dre_license_id || !dre_license_id.trim()) {
    return NextResponse.json({ error: 'dre_license_id required' }, { status: 400 });
  }

  await supabaseAdmin
    .from('profiles')
    .update({ dre_license_id: dre_license_id.trim() })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
