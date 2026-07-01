import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { shapePost, shapeOffer } from '@/lib/bullpen/types';

// GET /api/bullpen/[slug]/offers
//
// The BUYER'S private view of their offers — the full stack with lender names
// + numbers, for the buyer's own compare cockpit. This is deliberately SEPARATE
// from the public [slug] route (which returns only a count). Today it's
// unguarded because there's no buyer auth yet; once the buyer portal lands this
// becomes owner-gated (created_by / a claim token). It must never be linked to
// from the public profile. (memory/project_bullpen_offer_privacy_and_flow)

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.toLowerCase().slice(0, 32);
  if (!slug) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: post } = await supabaseAdmin
    .from('bullpen_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: offers } = await supabaseAdmin
    .from('bullpen_offers')
    .select('*')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    post: shapePost(post as Record<string, unknown>),
    offers: (offers ?? []).map((o) => shapeOffer(o as Record<string, unknown>)),
    hasOffer: (offers?.length ?? 0) > 0,
  });
}
