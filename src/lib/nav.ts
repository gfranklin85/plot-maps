// ── The nav registry — ONE source of truth for the header IA ──────────
//
// Nav is a "who am I" problem (memory: the_platform_inventory — 3 roles
// over 4 product lines). Every header list renders FROM here; nothing is
// hardcoded in components. Decisions (Greg, 2026-07-12):
//   · "The Network" retired — same idea as Post your move. One door.
//   · Essays cut from the public spine (route still exists).
//   · Orbit STAYS — "it's a real thing on its own, it's valuable" (Greg).
//   · Logged-in spine = the buyer-shared tools; the agent deal-machine
//     lives in ONE grouped "Agent tools" menu, NOT sprayed across the bar.
//   · When profiles carry real role flags, gate `agent` items by role —
//     until then the group shows for all signed-in users.

export interface NavItem {
  label: string;
  href: string;
  /** one-line plain-language description (used in menus/tooltips) */
  note?: string;
}

/** Public (logged-out) marketing spine. */
export const NAV_PUBLIC: NavItem[] = [
  { label: 'The map',        href: '/map' },
  { label: 'Post your move', href: '/sky' },
  { label: 'Orbit',          href: '/#orbit' },
  { label: 'The Bullpen',    href: '/bullpen' },
  { label: 'Position',       href: '/position' },
];

/** Logged-in shared spine — the tools every mover uses. */
export const NAV_APP: NavItem[] = [
  { label: 'Map',         href: '/map?view=3d' },
  { label: 'Post a Move', href: '/post' },
  { label: 'Connections', href: '/connections' },
  { label: 'Documents',   href: '/documents' },
];

/** The agent deal-machine — grouped under one menu. Role-gated later. */
export const NAV_AGENT: NavItem[] = [
  { label: 'Leads',       href: '/leads',     note: 'See a house, call the owner — instant skip trace.' },
  { label: 'Farms',       href: '/farms',     note: 'Circle prospecting — work a neighborhood.' },
  { label: 'Campaigns',   href: '/campaigns', note: 'Mail, calls, and 3D property videos.' },
  { label: 'Imports',     href: '/imports',   note: 'Bring your people onto the map.' },
  { label: 'Invite',      href: '/invite',    note: 'Your branded buyer link.' },
  { label: 'Buyer board', href: '/buyers',    note: 'Browse posted buyer positions.' },
  { label: 'Tasks',       href: '/tasks',     note: 'Your working list.' },
];
