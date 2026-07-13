import AgentDashboard from '@/components/dashboard/AgentDashboard';

// /home — the signed-in agent's workspace. Two floating-island "verb" doors:
// PROSPECT (reach people) and TRANSACT (do the deal), expanding in place. The
// old DashboardSurface (dead map window, fake panels, 8-card wall) is retired
// but kept on disk for reference. memory: the_platform_inventory (who-am-I
// dashboard), project_pin_grammar (sky world).
export default function HomePage() {
  return <AgentDashboard />;
}
