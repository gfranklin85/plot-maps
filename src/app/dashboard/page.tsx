'use client';

// /dashboard — the logged-in home.
//
// PROMOTED 2026-06-19 to the new LIGHT launcher ("Choose what you want to
// do"), consistent with the new front page theme. The previous dark
// "office room" back-out (room.png + WorkstationScreen + OtPainting +
// FrameEditor) is RETIRED but its files are parked in the repo in case the
// back-out / OT-in-painting concept returns. See:
//   memory/project_front_page_locked, memory/project_desk_surface_backout_ui.

import DashboardLauncher from '@/components/dashboard/DashboardLauncher';

export default function Dashboard() {
  return <DashboardLauncher />;
}
