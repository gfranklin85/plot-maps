// /buyers — the public board of buyer positions. The visibility platform:
// anyone browses, nobody excluded, lenders answer for free (NMLS-gated).
// See memory/project_bullpen_board_design.

import BuyerBoard from '@/components/bullpen/BuyerBoard';

export const dynamic = 'force-dynamic';

export default function BuyersBoardPage() {
  return <BuyerBoard />;
}
