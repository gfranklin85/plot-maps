'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Summary {
  totalUsers: number;
  activeUsers: number;
  totalLeads: number;
  totalTargets: number;
  totalContext: number;
  marketsInUse: number;
  activeSubscribers: number;
  estimatedMRR: number;
  marketsNeedingAttention: number;
  totalGeocodes: number;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  subscription_status: string;
  stripe_price_id: string;
  created_at: string;
  updated_at: string;
  lead_count: number;
  primary_city: string;
}

interface MarketRow {
  city: string;
  state: string;
  user_count: number;
  target_count: number;
  context_count: number;
  coverage_status: string;
  coverage_pct: number;
  priority_score: number;
  freshness_date: string;
}

interface AdminData {
  summary: Summary;
  users: UserRow[];
  markets: MarketRow[];
  recentSignups: UserRow[];
}

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';

function getPlanLabel(status: string, priceId: string): { label: string; color: string } {
  if (status !== 'active') return { label: 'Free', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  if (priceId === PRO_PRICE_ID) return { label: 'Pro', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
  return { label: 'Starter', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
}

function getCoverageBadge(status: string): { color: string; dotColor: string } {
  switch (status) {
    case 'Strong': return { color: 'bg-emerald-500/10 text-emerald-400', dotColor: 'bg-emerald-500' };
    case 'Moderate': return { color: 'bg-amber-500/10 text-amber-400', dotColor: 'bg-amber-500' };
    case 'Thin': return { color: 'bg-rose-500/10 text-rose-400', dotColor: 'bg-rose-500' };
    default: return { color: 'bg-red-500/10 text-red-500', dotColor: 'bg-red-500' };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function titleCase(str: string): string {
  return str.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

export default function AdminDashboard({ data }: { data: Record<string, unknown> }) {
  const { summary, users, markets, recentSignups } = data as unknown as AdminData;
  const seedingQueue = markets.filter(m => m.coverage_status === 'None' || m.coverage_status === 'Thin').slice(0, 10);

  return (
    <div className="p-8 bg-[#0c1324] min-h-[calc(100vh-4rem)] space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-headline">Market Coverage & Seeding</h1>
        <p className="text-sm text-slate-500 mt-1">Operator console — admin only</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Active Users" value={summary.activeUsers} sub={`of ${summary.totalUsers} total`} icon="group" />
        <SummaryCard label="Total Users" value={summary.totalUsers} sub={`${summary.activeSubscribers} subscribers`} icon="person" />
        <SummaryCard label="Total Leads" value={summary.totalLeads} sub={`${summary.totalTargets} targets · ${summary.totalContext} context`} icon="description" />
        <SummaryCard label="Markets in Use" value={summary.marketsInUse} sub={`${summary.marketsNeedingAttention} need attention`} icon="map" />
        <SummaryCard label="Est. MRR" value={`$${summary.estimatedMRR.toLocaleString()}`} sub={`${summary.activeSubscribers} active`} icon="payments" accent />
        <SummaryCard label="Needs Attention" value={summary.marketsNeedingAttention} sub="thin or no coverage" icon="warning" alert={summary.marketsNeedingAttention > 0} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Seeding Queue */}
        <div className="col-span-12 xl:col-span-4 bg-[#151b2d] rounded-2xl border border-white/5 flex flex-col max-h-[600px]">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2 text-slate-200">
              <MaterialIcon icon="queue" className="text-[18px] text-indigo-400" />
              Seeding Queue
            </h3>
            <span className="text-[10px] font-black px-2 py-1 bg-white/10 rounded-full text-slate-300">{seedingQueue.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {seedingQueue.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">All markets have coverage</p>
            )}
            {seedingQueue.map((m, i) => {
              const borderColor = m.coverage_status === 'None' ? 'border-rose-500' : 'border-amber-500';
              return (
                <div key={i} className={`p-4 bg-[#0c1324] rounded-xl border-l-4 ${borderColor} flex justify-between items-start`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-200">{titleCase(m.city)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${m.coverage_status === 'None' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {m.coverage_status === 'None' ? 'No Coverage' : 'Thin'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{m.state}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span><b className="text-slate-300">{m.user_count}</b> Users</span>
                      <span><b className="text-slate-300">{m.target_count}</b> Targets</span>
                      <span><b className="text-slate-300">{m.context_count}</b> Context</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Priority</div>
                    <div className={`text-lg font-black ${m.coverage_status === 'None' ? 'text-rose-400' : 'text-amber-400'}`}>{m.priority_score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Users Table */}
        <div className="col-span-12 xl:col-span-8 bg-[#151b2d] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2 text-slate-200">
              <MaterialIcon icon="group" className="text-[18px] text-indigo-400" />
              Users ({users.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0c1324]/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Market</th>
                  <th className="px-5 py-3">Leads</th>
                  <th className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {users.map(u => {
                  const plan = getPlanLabel(u.subscription_status, u.stripe_price_id);
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-200">{u.full_name || 'No name'}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${plan.color}`}>{plan.label}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{titleCase(u.primary_city)}</td>
                      <td className="px-5 py-3 text-slate-300 font-semibold">{u.lead_count}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(u.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Market Coverage Table */}
      <div className="bg-[#151b2d] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="font-bold text-sm flex items-center gap-2 text-slate-200">
            <MaterialIcon icon="layers" className="text-[18px] text-indigo-400" />
            Market Coverage ({markets.length} markets)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0c1324]/50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-5 py-3">City / State</th>
                <th className="px-5 py-3">Users</th>
                <th className="px-5 py-3">Targets</th>
                <th className="px-5 py-3">Context</th>
                <th className="px-5 py-3">Coverage</th>
                <th className="px-5 py-3">Freshness</th>
                <th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {markets.slice(0, 50).map((m, i) => {
                const badge = getCoverageBadge(m.coverage_status);
                return (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-200">{titleCase(m.city)}, {m.state}</td>
                    <td className="px-5 py-3 text-slate-400">{m.user_count}</td>
                    <td className="px-5 py-3 text-slate-300">{m.target_count}</td>
                    <td className="px-5 py-3 text-slate-300">{m.context_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${badge.dotColor}`} style={{ width: `${m.coverage_pct}%` }} />
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {m.coverage_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{timeAgo(m.freshness_date)}</td>
                    <td className="px-5 py-3 font-black text-slate-300">{m.priority_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-[#151b2d] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="font-bold text-sm flex items-center gap-2 text-slate-200">
            <MaterialIcon icon="person_add" className="text-[18px] text-indigo-400" />
            Recent Signups
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {recentSignups.map(u => {
            const plan = getPlanLabel(u.subscription_status, u.stripe_price_id);
            return (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-[#23293c] flex items-center justify-center text-xs font-bold text-slate-300">
                    {(u.full_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{u.full_name || 'No name'}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${plan.color}`}>{plan.label}</span>
                  <span className="text-xs text-slate-500">{u.lead_count} leads</span>
                  <span className="text-xs text-slate-500">{timeAgo(u.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon, accent, alert }: {
  label: string; value: string | number; sub: string; icon: string; accent?: boolean; alert?: boolean;
}) {
  return (
    <div className={`p-5 rounded-xl border ${accent ? 'bg-indigo-500/10 border-indigo-500/30' : alert ? 'bg-[#151b2d] border-rose-500/30' : 'bg-[#151b2d] border-white/5'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <MaterialIcon icon={icon} className={`text-[18px] ${accent ? 'text-indigo-400' : alert ? 'text-rose-400' : 'text-slate-600'}`} />
      </div>
      <div className="text-2xl font-black text-slate-100 font-headline">{value}</div>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}
