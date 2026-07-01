import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { shapePost, shapeOffer } from '@/lib/bullpen/types';

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

  const { data: offers } = await supabaseAdmin
    .from('bullpen_offers')
    .select('*')
    .eq('post_id', post.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    post: shapePost(post as Record<string, unknown>),
    offers: (offers ?? []).map((o) => shapeOffer(o as Record<string, unknown>)),
    // A market-generated trust signal: the FIRST real offer means a licensed
    // lender took this buyer seriously. We surface the FACT, never the lender
    // (memory/project_buyer_financial_capture "the first offer = trust keystone").
    hasOffer: (offers?.length ?? 0) > 0,
  });
}
