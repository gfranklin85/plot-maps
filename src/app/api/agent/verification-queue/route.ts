import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET — list properties where an owner has requested agent verification.
//
// v1: returns ALL outstanding verification requests platform-wide. Region
// scoping by agent farm/territory is a Phase 2 add (the leads table doesn't
// yet carry a farm-zip association on the agent side). For now any agent
// with their license on file can pick up any pending verification — the
// market scarcity self-regulates volume.

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm caller has a license id on file
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('dre_license_id')
    .eq('id', user.id)
    .single();
  if (!profile?.dre_license_id) {
    return NextResponse.json({ requests: [], needs_license: true });
  }

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, property_address, city, state, zip, verification_requested_at')
    .not('verification_requested_at', 'is', null)
    .order('verification_requested_at', { ascending: true })
    .limit(200);

  return NextResponse.json({
    requests: (leads || []).map(l => ({
      lead_id: l.id,
      address: l.property_address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      requested_at: l.verification_requested_at,
    })),
  });
}
