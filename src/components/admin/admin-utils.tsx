'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

// ── Types ──

export interface Summary {
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

export interface UserRow {
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

export interface MarketRow {
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

export interface HotProspect {
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

export interface AdminData {
  summary: Summary;
  users: UserRow[];
  markets: MarketRow[];
  recentSignups: UserRow[];
}

export interface AnalyticsData {
  pulse: { liveVisitors: number; sessionsToday: number; totalSessions: number; conversionRate: number };
  funnel: { visitors: number; multiPage: number; signedUp: number; subscribed: number };
  hotProspects: HotProspect[];
  topLandingPages: { page: string; count: number }[];
  utmBreakdown: { source: string; visits: number; conversions: number; rate: number }[];
  dropOffPages: { page: string; bounces: number; total: number; rate: number }[];
  devices: { device: string; count: number }[];
}

// ── Utilities ──

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';

export function getPlanLabel(status: string, priceId: string): { label: string; color: string } {
  if (status !== 'active') return { label: 'Free', color: 'bg-secondary/10 text-on-surface-variant border-secondary/20' };
  if (priceId === PRO_PRICE_ID) return { label: 'Pro', color: 'bg-primary/10 text-primary border-primary/20' };
  return { label: 'Starter', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
}

export function getCoverageBadge(status: string): { color: string; dotColor: string } {
  switch (status) {
    case 'Strong': return { color: 'bg-emerald-500/10 text-emerald-400', dotColor: 'bg-emerald-500' };
    case 'Moderate': return { color: 'bg-amber-500/10 text-amber-400', dotColor: 'bg-amber-500' };
    case 'Thin': return { color: 'bg-rose-500/10 text-rose-400', dotColor: 'bg-rose-500' };
    default: return { color: 'bg-red-500/10 text-red-500', dotColor: 'bg-red-500' };
  }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function titleCase(str: string): string {
  return str.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

// ── Shared Components ──

export function SummaryCard({ label, value, sub, icon, accent, alert, large }: {
  label: string; value: string | number; sub: string; icon: string; accent?: boolean; alert?: boolean; large?: boolean;
}) {
  return (
    <div className={`p-5 rounded-xl border ${accent ? 'bg-primary/10 border-primary/30' : alert ? 'bg-card border-rose-500/30' : 'bg-card border-card-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{label}</p>
        <MaterialIcon icon={icon} className={`text-[18px] ${accent ? 'text-primary' : alert ? 'text-rose-400' : 'text-on-surface-variant'}`} />
      </div>
      <div className={`font-black text-on-surface font-headline ${large ? 'text-4xl' : 'text-2xl'}`}>{value}</div>
      <p className="text-[11px] text-secondary mt-1">{sub}</p>
    </div>
  );
}
