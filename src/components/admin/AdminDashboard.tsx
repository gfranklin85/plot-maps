'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  if (status !== 'active') return { label: 'Free', color: 'bg-secondary/10 text-on-surface-variant border-secondary/20' };
  if (priceId === PRO_PRICE_ID) return { label: 'Pro', color: 'bg-primary/10 text-primary border-primary/20' };
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

function titleCase(str: string): string {
  return str.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

export default function AdminDashboard({ data }: { data: Record<string, unknown> }) {
  const { summary, users, markets, recentSignups } = data as unknown as AdminData;
  const seedingQueue = markets.filter(m => m.coverage_status === 'None' || m.coverage_status === 'Thin').slice(0, 10);

  // Auto-target request queue
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

  function timeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Seed import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [seedMarketTag, setSeedMarketTag] = useState('');
  const [seedMode, setSeedMode] = useState<'file' | 'paste'>('paste');
  const [seedPasteText, setSeedPasteText] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    inserted: number; updated: number; geocoded: number; errors: number; total: number;
    format?: string; geocodeCost?: number;
    incomplete?: { address: string; missing: string[] }[];
    incompleteCount?: number; completeCount?: number;
  } | null>(null);
  const [seedPanelOpen, setSeedPanelOpen] = useState(false);

  async function handleSeed(text: string, format?: string) {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text, marketTag: seedMarketTag || null, format }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSeedResult({
        inserted: data.inserted, updated: data.updated, geocoded: data.geocoded || 0,
        errors: data.errors, total: data.total, format: data.format, geocodeCost: data.geocodeCost || 0,
        incomplete: data.incomplete || [], incompleteCount: data.incompleteCount || 0,
        completeCount: data.completeCount || 0,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSeedFile(file: File) {
    const text = await file.text();
    await handleSeed(text);
  }

  return (
    <div className="p-8 bg-surface min-h-[calc(100vh-4rem)] space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight font-headline">Market Coverage & Seeding</h1>
          <p className="text-sm text-secondary mt-1">Operator console — admin only</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/admin/analytics"
            className="flex items-center gap-2 border border-outline-variant hover:bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold text-sm transition-all"
          >
            <MaterialIcon icon="monitoring" className="text-[18px]" />
            War Room
          </a>
          {/* Seed Toggle */}
          <button
            onClick={() => setSeedPanelOpen(!seedPanelOpen)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
          >
            <MaterialIcon icon={seedPanelOpen ? 'close' : 'cloud_upload'} className="text-[18px]" />
            {seedPanelOpen ? 'Close' : 'Seed Market Data'}
          </button>
        </div>
      </div>

      {/* Seed Panel */}
      {seedPanelOpen && (
        <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <MaterialIcon icon="cloud_upload" className="text-[18px] text-primary" />
              Seed Market Data
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeedMode('paste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${seedMode === 'paste' ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}
              >
                Paste RPR
              </button>
              <button
                onClick={() => setSeedMode('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${seedMode === 'file' ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}
              >
                Upload CSV
              </button>
            </div>
          </div>

          {/* Results Card */}
          {seedResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="check_circle" className="text-[20px] text-emerald-400" />
                <span className="font-bold text-emerald-400 text-sm">Seeding Complete</span>
                <span className="text-xs text-secondary ml-auto">{seedResult.format === 'rpr' ? 'RPR Format' : 'CSV Format'}</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-on-surface">{seedResult.total}</p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-primary">{seedResult.inserted}</p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">New</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-amber-400">{seedResult.updated}</p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Updated</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-emerald-400">{seedResult.geocoded}</p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Geocoded</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-on-surface">${seedResult.geocodeCost?.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] text-secondary uppercase tracking-wider">Cost</p>
                </div>
              </div>
              {seedResult.errors > 0 && (
                <p className="text-xs text-red-400">{seedResult.errors} records failed to process</p>
              )}

              {/* Quality Report */}
              {seedResult.incompleteCount && seedResult.incompleteCount > 0 ? (
                <div className="border-t border-card-border pt-3 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MaterialIcon icon="warning" className="text-[16px] text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">
                      {seedResult.incompleteCount} records with missing data
                    </span>
                    <span className="text-xs text-secondary ml-auto">
                      {seedResult.completeCount} complete
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {seedResult.incomplete?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-card-border/50 last:border-0">
                        <span className="text-on-surface font-medium truncate max-w-[200px]">{item.address}</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {item.missing.map(field => (
                            <span key={field} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-bold uppercase">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(seedResult.incompleteCount || 0) > 50 && (
                      <p className="text-[10px] text-secondary italic">Showing first 50 of {seedResult.incompleteCount}</p>
                    )}
                  </div>
                </div>
              ) : null}

              <button
                onClick={() => { setSeedResult(null); setSeedPasteText(''); }}
                className="text-xs text-primary font-bold hover:underline"
              >
                Seed Another Market
              </button>
            </div>
          )}

          {/* Input Area (hidden when results shown) */}
          {!seedResult && (
            <>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={seedMarketTag}
                  onChange={(e) => setSeedMarketTag(e.target.value)}
                  placeholder="Market tag (e.g. Hanford)"
                  className="bg-surface border border-card-border rounded-lg px-3 py-2 text-sm text-on-surface w-48 focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-secondary"
                />
                {seeding && (
                  <span className="text-xs text-primary font-bold flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Processing & geocoding...
                  </span>
                )}
              </div>

              {seedMode === 'paste' ? (
                <div className="space-y-3">
                  <textarea
                    value={seedPasteText}
                    onChange={(e) => setSeedPasteText(e.target.value)}
                    rows={10}
                    disabled={seeding}
                    className="w-full bg-surface border border-card-border rounded-xl p-4 font-mono text-xs text-on-surface focus:ring-1 focus:ring-primary resize-none placeholder:text-secondary disabled:opacity-50"
                    placeholder={"Paste RPR listing data here...\n\nCopy from RPR → Ctrl+A → Ctrl+C → Paste here\n\nActive  SFR  $450,000  3/15/26  123 Main St\nHanford, CA 93230  3  2  1,500  0.25 Acres  1995  $300"}
                  />
                  <button
                    onClick={() => handleSeed(seedPasteText, 'rpr')}
                    disabled={seeding || !seedPasteText.trim()}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                  >
                    <MaterialIcon icon={seeding ? 'hourglass_empty' : 'rocket_launch'} className={`text-[18px] ${seeding ? 'animate-spin' : ''}`} />
                    {seeding ? 'Seeding & Geocoding...' : 'Seed from Paste'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSeedFile(file);
                  }} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={seeding}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                  >
                    <MaterialIcon icon={seeding ? 'hourglass_empty' : 'upload_file'} className={`text-[18px] ${seeding ? 'animate-spin' : ''}`} />
                    {seeding ? 'Seeding & Geocoding...' : 'Upload CSV File'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
        <div className="col-span-12 xl:col-span-4 bg-card rounded-2xl border border-card-border flex flex-col max-h-[600px]">
          <div className="p-5 border-b border-card-border flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2 text-on-surface">
              <MaterialIcon icon="queue" className="text-[18px] text-primary" />
              Seeding Queue
            </h3>
            <span className="text-[10px] font-black px-2 py-1 bg-surface-container rounded-full text-on-surface-variant">{seedingQueue.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {seedingQueue.length === 0 && (
              <p className="text-sm text-secondary text-center py-8">All markets have coverage</p>
            )}
            {seedingQueue.map((m, i) => {
              const borderColor = m.coverage_status === 'None' ? 'border-rose-500' : 'border-amber-500';
              return (
                <div key={i} className={`p-4 bg-surface rounded-xl border-l-4 ${borderColor} flex justify-between items-start`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-on-surface">{titleCase(m.city)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${m.coverage_status === 'None' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {m.coverage_status === 'None' ? 'No Coverage' : 'Thin'}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mb-2">{m.state}</p>
                    <div className="flex items-center gap-3 text-[10px] text-secondary">
                      <span><b className="text-on-surface-variant">{m.user_count}</b> Users</span>
                      <span><b className="text-on-surface-variant">{m.target_count}</b> Targets</span>
                      <span><b className="text-on-surface-variant">{m.context_count}</b> Context</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-secondary uppercase mb-1">Priority</div>
                    <div className={`text-lg font-black ${m.coverage_status === 'None' ? 'text-rose-400' : 'text-amber-400'}`}>{m.priority_score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Users Table */}
        <div className="col-span-12 xl:col-span-8 bg-card rounded-2xl border border-card-border overflow-hidden">
          <div className="p-5 border-b border-card-border flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2 text-on-surface">
              <MaterialIcon icon="group" className="text-[18px] text-primary" />
              Users ({users.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-secondary sticky top-0">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Market</th>
                  <th className="px-5 py-3">Leads</th>
                  <th className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-sm">
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
                      <td className="px-5 py-3 text-on-surface-variant font-semibold">{u.lead_count}</td>
                      <td className="px-5 py-3 text-secondary text-xs">{timeAgo(u.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Market Coverage Table */}
      <div className="bg-card rounded-2xl border border-card-border overflow-hidden">
        <div className="p-5 border-b border-card-border">
          <h3 className="font-bold text-sm flex items-center gap-2 text-on-surface">
            <MaterialIcon icon="layers" className="text-[18px] text-primary" />
            Market Coverage ({markets.length} markets)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-secondary">
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
            <tbody className="divide-y divide-card-border text-sm">
              {markets.slice(0, 50).map((m, i) => {
                const badge = getCoverageBadge(m.coverage_status);
                return (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-semibold text-on-surface">{titleCase(m.city)}, {m.state}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{m.user_count}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{m.target_count}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{m.context_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-card-border h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${badge.dotColor}`} style={{ width: `${m.coverage_pct}%` }} />
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {m.coverage_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-secondary">{timeAgo(m.freshness_date)}</td>
                    <td className="px-5 py-3 font-black text-on-surface-variant">{m.priority_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="bg-card rounded-2xl border border-card-border overflow-hidden">
        <div className="p-5 border-b border-card-border">
          <h3 className="font-bold text-sm flex items-center gap-2 text-on-surface">
            <MaterialIcon icon="person_add" className="text-[18px] text-primary" />
            Recent Signups
          </h3>
        </div>
        <div className="divide-y divide-card-border">
          {recentSignups.map(u => {
            const plan = getPlanLabel(u.subscription_status, u.stripe_price_id);
            return (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-xs font-bold text-on-surface-variant">
                    {(u.full_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-on-surface">{u.full_name || 'No name'}</div>
                    <div className="text-[11px] text-secondary">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${plan.color}`}>{plan.label}</span>
                  <span className="text-xs text-secondary">{u.lead_count} leads</span>
                  <span className="text-xs text-secondary">{timeAgo(u.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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

                  {/* Admin notes */}
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

                  {/* Prospects created count */}
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

                  {/* Action buttons */}
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

function SummaryCard({ label, value, sub, icon, accent, alert }: {
  label: string; value: string | number; sub: string; icon: string; accent?: boolean; alert?: boolean;
}) {
  return (
    <div className={`p-5 rounded-xl border ${accent ? 'bg-primary/10 border-primary/30' : alert ? 'bg-card border-rose-500/30' : 'bg-card border-card-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{label}</p>
        <MaterialIcon icon={icon} className={`text-[18px] ${accent ? 'text-primary' : alert ? 'text-rose-400' : 'text-on-surface-variant'}`} />
      </div>
      <div className="text-2xl font-black text-on-surface font-headline">{value}</div>
      <p className="text-[11px] text-secondary mt-1">{sub}</p>
    </div>
  );
}
