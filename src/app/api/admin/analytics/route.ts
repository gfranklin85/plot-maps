import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
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

  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

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

  // Conversion rate (7 days)
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

  // Hot Prospects: top 20 unconverted by engagement score, active in last 7 days
  const { data: hotProspects } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('id, anonymous_id, landing_page, total_pageviews, total_sessions, total_events, last_seen, engagement_score, utm_source, device_type, browser')
    .eq('converted', false)
    .gte('last_seen', sevenDaysAgo)
    .order('engagement_score', { ascending: false })
    .limit(20);

  // Top landing pages (last 30 days)
  const { data: allSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('landing_page')
    .gte('first_seen', thirtyDaysAgo)
    .not('landing_page', 'is', null);

  const landingPageCounts = new Map<string, number>();
  (allSessions || []).forEach(s => {
    const page = s.landing_page || 'Unknown';
    landingPageCounts.set(page, (landingPageCounts.get(page) || 0) + 1);
  });
  const topLandingPages = Array.from(landingPageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // UTM breakdown (last 30 days)
  const { data: utmSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('utm_source, utm_campaign, converted')
    .gte('first_seen', thirtyDaysAgo)
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

  // Drop-off analysis: pages with highest single-pageview bounces
  const { data: bounceSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('landing_page')
    .eq('total_pageviews', 1)
    .gte('first_seen', thirtyDaysAgo)
    .not('landing_page', 'is', null);

  const bounceCounts = new Map<string, number>();
  (bounceSessions || []).forEach(s => {
    const page = s.landing_page || 'Unknown';
    bounceCounts.set(page, (bounceCounts.get(page) || 0) + 1);
  });
  const dropOffPages = Array.from(bounceCounts.entries())
    .map(([page, bounces]) => {
      const totalForPage = landingPageCounts.get(page) || bounces;
      return { page, bounces, total: totalForPage, rate: Math.round((bounces / totalForPage) * 100) };
    })
    .sort((a, b) => b.bounces - a.bounces)
    .slice(0, 10);

  // Device breakdown
  const { data: deviceSessions } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('device_type')
    .gte('first_seen', thirtyDaysAgo);

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

  return NextResponse.json({
    pulse: {
      liveVisitors: liveVisitors || 0,
      sessionsToday: sessionsToday || 0,
      totalSessions: totalSessions || 0,
      conversionRate,
    },
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
  });
}
