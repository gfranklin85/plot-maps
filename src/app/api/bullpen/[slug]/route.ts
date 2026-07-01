import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { shapePost } from '@/lib/bullpen/types';

// GET /api/bullpen/[slug]
//
// The public read for a shared link. Anyone with the slug (a lender, a family
// member, a friend) gets the buyer's STATED position + the offers that have
// arrived — on a neutral timeline (arrival order). Plot never ranks; the
// client sorts. created_by is never exposed. (memory/project_position_job_posting_architecture)

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.toLowerCase().slice(0, 32);
  if (!slug) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { data: post, error } = await supabaseAdmin
    .from('bullpen_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('bullpen get error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // PUBLIC read: we return ONLY the offer COUNT — never lender names or their
  // numbers. The full offer stack is private to the buyer (served by the
  // [slug]/offers route, buyer-gated once the portal lands). A stranger sees
  // that offers exist, never who or what. (memory/project_bullpen_offer_privacy_and_flow)
  const { count } = await supabaseAdmin
    .from('bullpen_offers')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', post.id);

  return NextResponse.json({
    post: shapePost(post as Record<string, unknown>),
    offerCount: count ?? 0,
    hasOffer: (count ?? 0) > 0,
  });
}
