'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Pulse {
  liveVisitors: number;
  sessionsToday: number;
  totalSessions: number;
  conversionRate: number;
}

interface Funnel {
  visitors: number;
  multiPage: number;
  signedUp: number;
  subscribed: number;
}

interface HotProspect {
  id: string;
  anonymous_id: string;
  landing_page: string | null;
  total_pageviews: number;
  total_sessions: number;
  total_events: number;
  last_seen: string;
  engagement_score: number;
  utm_source: string | null;
  device_type: string | null;
  browser: string | null;
}

interface LandingPage {
  page: string;
  count: number;
}

interface UTMRow {
  source: string;
  visits: number;
  conversions: number;
  rate: number;
}

interface DropOff {
  page: string;
  bounces: number;
  total: number;
  rate: number;
}

interface Device {
  device: string;
  count: number;
}

interface WarRoomData {
  pulse: Pulse;
  funnel: Funnel;
  hotProspects: HotProspect[];
  topLandingPages: LandingPage[];
  utmBreakdown: UTMRow[];
  dropOffPages: DropOff[];
  devices: Device[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function FunnelBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-on-surface-variant text-right shrink-0">{label}</span>
      <div className="flex-1 h-7 bg-surface-container rounded-lg overflow-hidden relative">
        <div
          className="h-full bg-primary/60 rounded-lg transition-all"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-on-surface">
          {count.toLocaleString()} ({pct}%)
        </span>
      </div>
    </div>
  );
}

export default function WarRoom({ data, embedded }: { data: WarRoomData; embedded?: boolean }) {
  const { pulse, funnel, hotProspects, topLandingPages, utmBreakdown, dropOffPages, devices } = data;

  return (
    <div className={embedded ? 'space-y-8' : 'p-8 bg-surface min-h-[calc(100vh-4rem)] space-y-8'}>
      {/* Header — hidden in embedded mode */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
              <MaterialIcon icon="monitoring" className="text-primary" />
              Analytics War Room
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">Visitor intelligence and conversion tracking</p>
          </div>
          <a href="/admin" className="text-sm text-primary hover:underline flex items-center gap-1">
            <MaterialIcon icon="arrow_back" className="text-sm" /> Back to Admin
          </a>
        </div>
      )}

      {/* Live Pulse Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PulseCard
          icon="radio_button_checked"
          iconColor="text-emerald-400"
          label="Live Visitors"
          value={pulse.liveVisitors}
          pulse
        />
        <PulseCard
          icon="today"
          iconColor="text-sky-400"
          label="Sessions Today"
          value={pulse.sessionsToday}
        />
        <PulseCard
          icon="groups"
          iconColor="text-violet-400"
          label="Total Sessions"
          value={pulse.totalSessions}
        />
        <PulseCard
          icon="trending_up"
          iconColor="text-amber-400"
          label="Conversion Rate (7d)"
          value={`${pulse.conversionRate}%`}
        />
      </div>

      {/* Funnel + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon icon="filter_alt" className="text-primary text-lg" />
            Conversion Funnel
          </h2>
          <div className="space-y-3">
            <FunnelBar label="Visitors" count={funnel.visitors} max={funnel.visitors} />
            <FunnelBar label="3+ Pages" count={funnel.multiPage} max={funnel.visitors} />
            <FunnelBar label="Signed Up" count={funnel.signedUp} max={funnel.visitors} />
            <FunnelBar label="Subscribed" count={funnel.subscribed} max={funnel.visitors} />
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon icon="devices" className="text-primary text-lg" />
            Devices (30d)
          </h2>
          <div className="space-y-2">
            {devices.length === 0 && <p className="text-sm text-on-surface-variant">No data yet</p>}
            {devices.map(d => {
              const total = devices.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
              return (
                <div key={d.device} className="flex items-center justify-between text-sm">
                  <span className="text-on-surface capitalize">{d.device}</span>
                  <span className="text-on-surface-variant">{d.count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hot Prospects */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
          <MaterialIcon icon="local_fire_department" className="text-orange-400 text-lg" />
          Hot Prospects (Anonymous)
          <span className="text-xs text-on-surface-variant font-normal ml-2">Last 7 days, not signed up</span>
        </h2>
        {hotProspects.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No anonymous visitors with significant engagement yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs border-b border-outline-variant">
                  <th className="text-left py-2 font-medium">ID</th>
                  <th className="text-left py-2 font-medium">Landing Page</th>
                  <th className="text-right py-2 font-medium">Pages</th>
                  <th className="text-right py-2 font-medium">Sessions</th>
                  <th className="text-right py-2 font-medium">Events</th>
                  <th className="text-left py-2 font-medium">Source</th>
                  <th className="text-left py-2 font-medium">Device</th>
                  <th className="text-left py-2 font-medium">Last Seen</th>
                  <th className="text-right py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {hotProspects.map(p => (
                  <tr key={p.id} className="border-b border-outline-variant/50 hover:bg-surface-container">
                    <td className="py-2 text-on-surface font-mono text-xs">{p.anonymous_id.slice(0, 8)}...</td>
                    <td className="py-2 text-on-surface-variant max-w-[180px] truncate">{p.landing_page || '—'}</td>
                    <td className="py-2 text-right text-on-surface">{p.total_pageviews}</td>
                    <td className="py-2 text-right text-on-surface">{p.total_sessions}</td>
                    <td className="py-2 text-right text-on-surface">{p.total_events}</td>
                    <td className="py-2 text-on-surface-variant">{p.utm_source || 'direct'}</td>
                    <td className="py-2 text-on-surface-variant capitalize">{p.device_type || '—'}</td>
                    <td className="py-2 text-on-surface-variant">{timeAgo(p.last_seen)}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                        p.engagement_score >= 100 ? 'bg-orange-500/20 text-orange-400' :
                        p.engagement_score >= 50 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-sky-500/20 text-sky-400'
                      }`}>
                        {Math.round(p.engagement_score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Landing Pages + UTM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Landing Pages */}
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon icon="web" className="text-primary text-lg" />
            Top Landing Pages (30d)
          </h2>
          {topLandingPages.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topLandingPages.map((lp, i) => (
                <div key={lp.page} className="flex items-center justify-between text-sm">
                  <span className="text-on-surface truncate max-w-[280px]">
                    <span className="text-on-surface-variant mr-2">{i + 1}.</span>
                    {lp.page}
                  </span>
                  <span className="text-on-surface-variant font-mono">{lp.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UTM Performance */}
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon icon="campaign" className="text-primary text-lg" />
            UTM Performance (30d)
          </h2>
          {utmBreakdown.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No UTM-tagged traffic yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-on-surface-variant text-xs border-b border-outline-variant">
                    <th className="text-left py-2 font-medium">Source</th>
                    <th className="text-right py-2 font-medium">Visits</th>
                    <th className="text-right py-2 font-medium">Conv.</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {utmBreakdown.map(u => (
                    <tr key={u.source} className="border-b border-outline-variant/50">
                      <td className="py-2 text-on-surface">{u.source}</td>
                      <td className="py-2 text-right text-on-surface-variant">{u.visits}</td>
                      <td className="py-2 text-right text-on-surface-variant">{u.conversions}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-semibold ${u.rate > 0 ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                          {u.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drop-off Analysis */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
          <MaterialIcon icon="exit_to_app" className="text-rose-400 text-lg" />
          Drop-off Analysis (30d)
          <span className="text-xs text-on-surface-variant font-normal ml-2">Pages with highest single-visit bounces</span>
        </h2>
        {dropOffPages.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No bounce data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs border-b border-outline-variant">
                  <th className="text-left py-2 font-medium">Page</th>
                  <th className="text-right py-2 font-medium">Bounces</th>
                  <th className="text-right py-2 font-medium">Total Visits</th>
                  <th className="text-right py-2 font-medium">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {dropOffPages.map(d => (
                  <tr key={d.page} className="border-b border-outline-variant/50">
                    <td className="py-2 text-on-surface max-w-[300px] truncate">{d.page}</td>
                    <td className="py-2 text-right text-on-surface-variant">{d.bounces}</td>
                    <td className="py-2 text-right text-on-surface-variant">{d.total}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-semibold ${
                        d.rate > 70 ? 'text-rose-400' : d.rate > 40 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {d.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PulseCard({ icon, iconColor, label, value, pulse }: {
  icon: string;
  iconColor: string;
  label: string;
  value: number | string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
      <div className="flex items-center gap-2 mb-2">
        <MaterialIcon icon={icon} className={`text-lg ${iconColor}`} />
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
        <span className="text-xs text-on-surface-variant">{label}</span>
      </div>
      <p className="text-2xl font-bold text-on-surface">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}
