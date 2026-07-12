// ── /lobby/[id] — the Deal Room, and its front door ───────────────────
//
// A buyer's offer, delivered as one indivisible PACKAGE. The listing side
// lands here and meets the comp-acknowledgment GATE: the offer's terms stay
// sealed until they acknowledge the buyer-broker compensation that came in
// WITH the offer. Not because anything is secret — the buyer's agent proudly
// puts their name on it — but because the buyer chose to present offer + comp
// as one thing. Take the whole package or send the whole package back.
//
// This is the WEDGE (memory: project_deal_room). Copy is authored to LAND
// (memory: project_deal_room_language) — reuse those phrases verbatim.

import DealRoomGate from '@/components/deal/DealRoomGate';
import { findPackage } from '@/lib/deal/offerPackage';

export const dynamic = 'force-dynamic';

export default function LobbyPage({ params }: { params: { id: string } }) {
  const pkg = findPackage(params.id);
  return <DealRoomGate pkg={pkg} />;
}
