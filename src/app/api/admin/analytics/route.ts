import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get('range') || '30d';
  const rangeDays = RANGE_DAYS[rangeParam] ?? 30;

  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  const priorRangeStart = new Date(now.getTime() - rangeDays * 2 * 24 * 60 * 60 * 1000).toISOString();

  // Live visitors (seen in last 5 minutes)
  const { count: liveVisitors } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen', fiveMinAgo);

  // Total sessions today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { count: sessionsToday } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen', todayStart);

  // Total sessions (all time)
  const { count: totalSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true });

  // Conversion rate (last 7 days) + prior 7d for delta
  const { count: convertedLast7d } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('converted', true)
    .gte('converted_at', sevenDaysAgo);

  const { count: totalLast7d } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('first_seen', sevenDaysAgo);

  const conversionRate = totalLast7d ? Math.round(((convertedLast7d || 0) / totalLast7d) * 100) : 0;

  // Prior period sessions for sparkline + delta on Sessions tile
  const { count: sessionsPriorPeriod } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('first_seen', priorRangeStart)
    .lt('first_seen', rangeStart);

  const { count: sessionsThisPeriod } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('first_seen', rangeStart);

  // Daily sessions timeline (for sparkline)
  const { data: timelineRows } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('first_seen')
    .gte('first_seen', rangeStart);

  const dailyBuckets = new Map<string, number>();
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyBuckets.set(key, 0);
  }
  (timelineRows || []).forEach(row => {
    const key = new Date(row.first_seen).toISOString().slice(0, 10);
    if (dailyBuckets.has(key)) dailyBuckets.set(key, (dailyBuckets.get(key) || 0) + 1);
  });
  const sessionsTimeline = Array.from(dailyBuckets.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Hot Prospects: top 20 unconverted by engagement score, active in last 7 days
  const { data: hotProspects } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id, anonymous_id, landing_page, total_pageviews, total_sessions, total_events, last_seen, engagement_score, utm_source, device_type, browser')
    .eq('converted', false)
    .gte('last_seen', sevenDaysAgo)
    .order('engagement_score', { ascending: false })
    .limit(20);

  // Top landing pages (range)
  const { data: allSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('landing_page')
    .gte('first_seen', rangeStart)
    .not('landing_page', 'is', null);

  const landingPageCounts = new Map<string, number>();
  (allSessions || []).forEach(s => {
    const page = s.landing_page || 'Unknown';
    landingPageCounts.set(page, (landingPageCounts.get(page) || 0) + 1);
  });

  // Bounce counts per page (needed for landing-pages overlay)
  const { data: bounceSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('landing_page')
    .eq('total_pageviews', 1)
    .gte('first_seen', rangeStart)
    .not('landing_page', 'is', null);

  const bounceCounts = new Map<string, number>();
  (bounceSessions || []).forEach(s => {
    const page = s.landing_page || 'Unknown';
    bounceCounts.set(page, (bounceCounts.get(page) || 0) + 1);
  });

  const topLandingPages = Array.from(landingPageCounts.entries())
    .map(([page, count]) => {
      const bounces = bounceCounts.get(page) || 0;
      return {
        page,
        count,
        bounces,
        rate: count > 0 ? Math.round((bounces / count) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // UTM breakdown (range)
  const { data: utmSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('utm_source, utm_campaign, converted')
    .gte('first_seen', rangeStart)
    .not('utm_source', 'is', null);

  const utmMap = new Map<string, { visits: number; conversions: number }>();
  (utmSessions || []).forEach(s => {
    const key = `${s.utm_source}${s.utm_campaign ? ` / ${s.utm_campaign}` : ''}`;
    const entry = utmMap.get(key) || { visits: 0, conversions: 0 };
    entry.visits++;
    if (s.converted) entry.conversions++;
    utmMap.set(key, entry);
  });
  const utmBreakdown = Array.from(utmMap.entries())
    .map(([source, data]) => ({
      source,
      visits: data.visits,
      conversions: data.conversions,
      rate: data.visits ? Math.round((data.conversions / data.visits) * 100) : 0,
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  // Conversion funnel (all time)
  const { count: totalVisitors } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true });

  const { count: multiPageVisitors } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('total_pageviews', 3);

  const { count: signedUp } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('converted', true);

  const { count: subscribed } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('subscription_status', 'active');

  // Drop-off: legacy shape kept for backwards compatibility (still consumed by the old UI)
  const dropOffPages = Array.from(bounceCounts.entries())
    .map(([page, bounces]) => {
      const totalForPage = landingPageCounts.get(page) || bounces;
      return { page, bounces, total: totalForPage, rate: Math.round((bounces / totalForPage) * 100) };
    })
    .sort((a, b) => b.bounces - a.bounces)
    .slice(0, 10);

  // Device breakdown (range)
  const { data: deviceSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('device_type')
    .gte('first_seen', rangeStart);

  const deviceCounts = new Map<string, number>();
  (deviceSessions || []).forEach(s => {
    const d = s.device_type || 'Unknown';
    deviceCounts.set(d, (deviceCounts.get(d) || 0) + 1);
  });
  const devices = Array.from(deviceCounts.entries())
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);

  // ── Platform Costs ──
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: costToday } = await supabaseAdmin
    .from('cost_events')
    .select('service, estimated_cost')
    .gte('created_at', todayStart);

  const { data: costMonth } = await supabaseAdmin
    .from('cost_events')
    .select('service, estimated_cost')
    .gte('created_at', monthStart);

  const todayBurn = (costToday || []).reduce((s, e) => s + (e.estimated_cost || 0), 0);
  const monthBurn = (costMonth || []).reduce((s, e) => s + (e.estimated_cost || 0), 0);

  const serviceBreakdown = new Map<string, number>();
  (costMonth || []).forEach(e => {
    serviceBreakdown.set(e.service, (serviceBreakdown.get(e.service) || 0) + (e.estimated_cost || 0));
  });
  const costByService = Array.from(serviceBreakdown.entries())
    .map(([service, cost]) => ({ service, cost: Math.round(cost * 100) / 100 }))
    .sort((a, b) => b.cost - a.cost);

  // ── Tracerfy balance ──
  let tracerfyBalance: number | null = null;
  try {
    const { getAnalytics } = await import('@/lib/tracerfy');
    const analytics = await getAnalytics();
    tracerfyBalance = analytics.balance;
  } catch { /* non-fatal — Tracerfy may not be configured */ }

  return NextResponse.json({
    range: rangeParam,
    pulse: {
      liveVisitors: liveVisitors || 0,
      sessionsToday: sessionsToday || 0,
      totalSessions: totalSessions || 0,
      conversionRate,
      sessionsThisPeriod: sessionsThisPeriod || 0,
      sessionsPriorPeriod: sessionsPriorPeriod || 0,
    },
    sessionsTimeline,
    funnel: {
      visitors: totalVisitors || 0,
      multiPage: multiPageVisitors || 0,
      signedUp: signedUp || 0,
      subscribed: subscribed || 0,
    },
    hotProspects: hotProspects || [],
    topLandingPages,
    utmBreakdown,
    dropOffPages,
    devices,
    costs: {
      todayBurn: Math.round(todayBurn * 100) / 100,
      monthBurn: Math.round(monthBurn * 100) / 100,
      byService: costByService,
    },
    tracerfyBalance,
  });
}
