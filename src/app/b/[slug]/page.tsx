// /b/[slug] — the public shared-link view of a buyer's bullpen position.
// Openable by ANYONE with the link (a lender, a family member, a friend). The
// heart of the agent tool's distribution: the thing the three networks pass
// around. (memory/project_position_job_posting_architecture)

import PublicBullpen from '@/components/bullpen/PublicBullpen';

export const dynamic = 'force-dynamic';

export default function BullpenLinkPage({ params }: { params: { slug: string } }) {
  return <PublicBullpen slug={params.slug} />;
}
