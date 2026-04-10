'use client';

import { useState, useEffect, useCallback } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { SummaryCard, timeAgo, type Summary, type UserRow, type HotProspect } from './admin-utils';
import PeopleTable from './PeopleTable';

interface AutoTargetRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reference_address: string;
  reference_lat: number;
  reference_lng: number;
  radius_miles: number;
  status: string;
  prospects_created: number;
  admin_notes: string | null;
  created_at: string;
}

interface CostData {
  todayBurn: number;
  monthBurn: number;
  byService: { service: string; cost: number }[];
}

interface Props {
  summary: Summary;
  users: UserRow[];
  hotProspects: HotProspect[];
  liveVisitors: number;
  costs?: CostData | null;
}

export default function OverviewTab({ summary, users, hotProspects, liveVisitors, costs }: Props) {
  // ── Auto-target request queue state ──
  const [atRequests, setAtRequests] = useState<AutoTargetRequest[]>([]);
  const [atSelected, setAtSelected] = useState<AutoTargetRequest | null>(null);
  const [atProspects, setAtProspects] = useState('');
  const [atNotes, setAtNotes] = useState('');
  const [atUpdating, setAtUpdating] = useState(false);

  const fetchAutoTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auto-target');
      if (res.ok) {
        const data = await res.json();
        setAtRequests(data.requests || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchAutoTargets();
  }, [fetchAutoTargets]);

  async function updateAutoTarget(requestId: string, status: string) {
    setAtUpdating(true);
    try {
      await fetch('/api/admin/auto-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status,
          prospects_created: status === 'completed' ? parseInt(atProspects) || 0 : undefined,
          admin_notes: atNotes || undefined,
        }),
      });
      await fetchAutoTargets();
      setAtSelected(null);
      setAtProspects('');
      setAtNotes('');
    } catch { /* silent */ }
    setAtUpdating(false);
  }

  return (
    <div className="space-y-8">
      {/* Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="col-span-2">
          <SummaryCard
            label="Est. MRR"
            value={`$${summary.estimatedMRR.toLocaleString()}`}
            sub={`${summary.activeSubscribers} active subscriber${summary.activeSubscribers !== 1 ? 's' : ''}`}
            icon="payments"
            accent
            large
          />
        </div>
        <SummaryCard
          label="Subscribers"
          value={summary.activeSubscribers}
          sub={`of ${summary.totalUsers} total users`}
          icon="group"
        />
        <SummaryCard
          label="Seeded Records"
          value={summary.totalContext.toLocaleString()}
          sub={`${summary.totalTargets.toLocaleString()} targets`}
          icon="layers"
        />
        <div className="relative">
          <SummaryCard
            label="Live Visitors"
            value={liveVisitors}
            sub="browsing now"
            icon="radio_button_checked"
          />
          {liveVisitors > 0 && (
            <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>
      </div>

      {/* Platform Costs */}
      {costs && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Burn Today" value={`$${costs.todayBurn.toFixed(2)}`} sub="platform API costs" icon="local_fire_department" alert={costs.todayBurn > 5} />
          <SummaryCard label="Burn This Month" value={`$${costs.monthBurn.toFixed(2)}`} sub={`$${summary.activeSubscribers > 0 ? (costs.monthBurn / summary.activeSubscribers).toFixed(2) : '0.00'}/subscriber`} icon="trending_up" />
          {costs.byService.slice(0, 2).map(s => (
            <SummaryCard key={s.service} label={s.service.replace('_', ' ')} value={`$${s.cost.toFixed(2)}`} sub="this month" icon="receipt_long" />
          ))}
        </div>
      )}

      {/* People Table */}
      <PeopleTable users={users} hotProspects={hotProspects} />

      {/* ═══ AUTO-TARGET REQUEST QUEUE ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-on-surface font-headline tracking-tight">
            <MaterialIcon icon="my_location" className="text-[18px] text-primary mr-2" />
            Prospect Requests
            {atRequests.length > 0 && (
              <span className="ml-2 text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{atRequests.length}</span>
            )}
          </h2>
          <button onClick={fetchAutoTargets} className="text-secondary hover:text-on-surface transition-colors">
            <MaterialIcon icon="refresh" className="text-[18px]" />
          </button>
        </div>

        {atRequests.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <MaterialIcon icon="check_circle" className="text-[32px] text-emerald-500 mb-2" />
            <p className="text-sm text-secondary">No pending prospect requests</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Queue Table */}
            <div className="lg:col-span-7 bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-secondary border-b border-card-border">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Reference Address</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {atRequests.map(req => (
                    <tr
                      key={req.id}
                      onClick={() => { setAtSelected(req); setAtProspects(''); setAtNotes(req.admin_notes || ''); }}
                      className={`cursor-pointer hover:bg-surface-container-high/50 transition-colors ${atSelected?.id === req.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface text-sm">{req.user_name}</div>
                        <div className="text-[10px] text-secondary">{req.user_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface">{req.reference_address?.split(',')[0]}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                          {req.status === 'processing' && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                          {req.status === 'pending' && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                          <span className={req.status === 'processing' ? 'text-orange-400' : 'text-secondary'}>{req.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary">{timeAgo(req.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-5">
              {atSelected ? (
                <div className="bg-card border border-card-border rounded-xl p-5 space-y-4 sticky top-24">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline font-bold text-on-surface">Request Detail</h3>
                    <span className="text-[10px] font-mono text-secondary">{atSelected.id.slice(0, 8)}</span>
                  </div>

                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-card-border space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Reference Property</p>
                    <p className="font-bold text-on-surface">{atSelected.reference_address}</p>
                    <p className="text-[10px] font-mono text-secondary">
                      {atSelected.reference_lat.toFixed(4)}, {atSelected.reference_lng.toFixed(4)} · {atSelected.radius_miles}mi radius
                    </p>
                  </div>

                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-card-border space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">User</p>
                    <p className="text-sm text-on-surface">{atSelected.user_name}</p>
                    <p className="text-[10px] text-secondary">{atSelected.user_email}</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-1">Admin Notes</label>
                    <textarea
                      value={atNotes}
                      onChange={(e) => setAtNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-card-border bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none"
                      placeholder="Notes about fulfillment..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-1">Prospects Created</label>
                    <input
                      type="number"
                      value={atProspects}
                      onChange={(e) => setAtProspects(e.target.value)}
                      className="w-full rounded-lg border border-card-border bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
                      placeholder="Number of leads uploaded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {atSelected.status === 'pending' && (
                      <button
                        onClick={() => updateAutoTarget(atSelected.id, 'processing')}
                        disabled={atUpdating}
                        className="py-2.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/30 transition-colors"
                      >
                        Mark Processing
                      </button>
                    )}
                    <button
                      onClick={() => updateAutoTarget(atSelected.id, 'cancelled')}
                      disabled={atUpdating}
                      className="py-2.5 rounded-lg bg-surface-container-high text-secondary text-xs font-bold hover:bg-surface-container-highest transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <button
                    onClick={() => updateAutoTarget(atSelected.id, 'completed')}
                    disabled={atUpdating}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <MaterialIcon icon="task_alt" className="text-[18px]" />
                    Mark as Fulfilled
                  </button>
                </div>
              ) : (
                <div className="bg-card border border-card-border rounded-xl p-8 text-center">
                  <MaterialIcon icon="touch_app" className="text-[28px] text-secondary mb-2" />
                  <p className="text-sm text-secondary">Select a request to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
