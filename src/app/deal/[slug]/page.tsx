// /deal/[slug] — the buyer's home base (hub). Make-an-Offer fork → build the
// offer with the rate-powered instrument. See memory/project_navigation_three_hubs.

import BuyerDeal from '@/components/bullpen/BuyerDeal';

export const dynamic = 'force-dynamic';

export default function DealPage({ params }: { params: { slug: string } }) {
  return <BuyerDeal slug={params.slug} />;
}
