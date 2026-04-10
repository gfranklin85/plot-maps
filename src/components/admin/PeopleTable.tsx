'use client';

import { getPlanLabel, timeAgo, titleCase, type UserRow, type HotProspect } from './admin-utils';

interface Props {
  users: UserRow[];
  hotProspects: HotProspect[];
}

function engagementBadge(score: number) {
  if (score >= 100) return 'bg-orange-500/20 text-orange-400';
  if (score >= 50) return 'bg-amber-500/20 text-amber-400';
  return 'bg-sky-500/20 text-sky-400';
}

export default function PeopleTable({ users, hotProspects }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-card-border overflow-hidden">
      <div className="p-5 border-b border-card-border">
        <h3 className="font-bold text-sm text-on-surface">
          People ({users.length} users · {hotProspects.length} anonymous)
        </h3>
      </div>
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-secondary sticky top-0">
            <tr>
              <th className="px-5 py-3">Who</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Market / Source</th>
              <th className="px-5 py-3">Activity</th>
              <th className="px-5 py-3">Landing Page</th>
              <th className="px-5 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border text-sm">
            {/* Subscribers first */}
            {users.map(u => {
              const plan = getPlanLabel(u.subscription_status, u.stripe_price_id);
              return (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-on-surface">{u.full_name || 'No name'}</div>
                    <div className="text-[11px] text-secondary">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${plan.color}`}>{plan.label}</span>
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">{titleCase(u.primary_city)}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{u.lead_count} leads</td>
                  <td className="px-5 py-3 text-secondary">—</td>
                  <td className="px-5 py-3 text-secondary text-xs">{timeAgo(u.updated_at || u.created_at)}</td>
                </tr>
              );
            })}
            {/* Anonymous visitors */}
            {hotProspects.map(p => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors bg-surface/30">
                <td className="px-5 py-3">
                  <div className="font-mono text-xs text-on-surface-variant">{p.anonymous_id.slice(0, 8)}...</div>
                  <div className="text-[10px] text-secondary">Anonymous visitor</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${engagementBadge(p.engagement_score)}`}>
                    Score {Math.round(p.engagement_score)}
                  </span>
                </td>
                <td className="px-5 py-3 text-on-surface-variant text-xs">{p.utm_source || 'direct'}</td>
                <td className="px-5 py-3 text-on-surface-variant text-xs">
                  {p.total_pageviews} pages · {p.total_sessions} sessions
                </td>
                <td className="px-5 py-3 text-on-surface-variant text-xs max-w-[180px] truncate">{p.landing_page || '—'}</td>
                <td className="px-5 py-3 text-secondary text-xs">{timeAgo(p.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
