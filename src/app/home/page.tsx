import DashboardSurface from '@/components/dashboard/DashboardSurface';

// /home — the signed-in user's dashboard / workspace (the desk the map backs
// out onto). AppShell provides the app header (Home · Map · account) for this
// route, so the page renders only its surface — no header here (that was the
// double-header). memory/project_desk_surface_backout_ui
export default function HomePage() {
  return <DashboardSurface />;
}
