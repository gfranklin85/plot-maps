import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';
const STARTER_PRICE = 49;
const PRO_PRICE = 79;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check admin
  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all profiles
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, subscription_status, stripe_price_id, created_at, updated_at, last_active_at, is_admin')
    .order('created_at', { ascending: false });

  // Fetch all leads with relevant fields
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, user_id, city, state, record_type, created_at, last_imported_at')
    .not('city', 'is', null);

  // Fetch usage
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('geocodes_used');

  const allProfiles = profiles || [];
  const allLeads = (leads || []).filter(l => l.city && l.city.trim());

  // Summary stats
  const totalUsers = allProfiles.length;
  const activeUsers = allProfiles.filter(p => {
    const lastActive = p.last_active_at || p.updated_at;
    return lastActive && lastActive >= sevenDaysAgo;
  }).length;
  const totalLeads = allLeads.length;
  const totalTargets = allLeads.filter(l => l.record_type !== 'context').length;
  const totalContext = allLeads.filter(l => l.record_type === 'context').length;
  const activeSubscribers = allProfiles.filter(p => p.subscription_status === 'active').length;
  const totalGeocodes = (usage || []).reduce((sum, u) => sum + (u.geocodes_used || 0), 0);

  // Estimated MRR
  const estimatedMRR = allProfiles.reduce((sum, p) => {
    if (p.subscription_status !== 'active') return sum;
    return sum + (p.stripe_price_id === PRO_PRICE_ID ? PRO_PRICE : STARTER_PRICE);
  }, 0);

  // Markets
  const marketMap = new Map<string, {
    city: string; state: string; user_ids: Set<string>;
    target_count: number; context_count: number; freshness_date: string;
  }>();

  for (const lead of allLeads) {
    const city = lead.city.trim();
    const key = `${city.toLowerCase()}|${(lead.state || '').toLowerCase()}`;
    if (!marketMap.has(key)) {
      const displayCity = city.replace(/\w\S*/g, (t: string) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
      marketMap.set(key, {
        city: displayCity, state: (lead.state || '').toUpperCase(),
        user_ids: new Set(),
        target_count: 0, context_count: 0,
        freshness_date: lead.last_imported_at || lead.created_at,
      });
    }
    const m = marketMap.get(key)!;
    if (lead.user_id) m.user_ids.add(lead.user_id);
    if (lead.record_type === 'context') m.context_count++;
    else m.target_count++;
    const leadDate = lead.last_imported_at || lead.created_at;
    if (leadDate > m.freshness_date) m.freshness_date = leadDate;
  }

  const markets = Array.from(marketMap.values()).map(m => {
    const user_count = m.user_ids.size;
    const ratio = m.context_count / Math.max(m.target_count, 1);
    const coverage_pct = Math.min(Math.round(ratio * 100), 100);
    const coverage_status = m.context_count === 0 ? 'None'
      : ratio >= 0.5 ? 'Strong'
      : ratio >= 0.2 ? 'Moderate' : 'Thin';
    const priority_score = (user_count * 5)
      + (m.target_count > 100 ? 3 : m.target_count > 10 ? 2 : 1)
      + (m.context_count === 0 ? 10 : 0);

    return {
      city: m.city, state: m.state, user_count,
      target_count: m.target_count, context_count: m.context_count,
      coverage_status, coverage_pct, priority_score,
      freshness_date: m.freshness_date,
    };
  }).sort((a, b) => b.priority_score - a.priority_score);

  const marketsInUse = markets.length;
  const marketsNeedingAttention = markets.filter(m =>
    m.target_count > 0 && (m.coverage_status === 'None' || m.coverage_status === 'Thin')
  ).length;

  // Users with lead counts and primary city
  const userLeadCounts = new Map<string, { count: number; cities: Map<string, number> }>();
  for (const lead of allLeads) {
    if (!lead.user_id) continue;
    if (!userLeadCounts.has(lead.user_id)) {
      userLeadCounts.set(lead.user_id, { count: 0, cities: new Map() });
    }
    const u = userLeadCounts.get(lead.user_id)!;
    u.count++;
    if (lead.city) {
      u.cities.set(lead.city, (u.cities.get(lead.city) || 0) + 1);
    }
  }

  const users = allProfiles.filter(p => !p.is_admin).map(p => {
    const stats = userLeadCounts.get(p.id);
    let primary_city = 'Unknown';
    if (stats?.cities.size) {
      let maxCount = 0;
      stats.cities.forEach((count, city) => {
        if (count > maxCount) { maxCount = count; primary_city = city; }
      });
    }
    return {
      id: p.id, full_name: p.full_name || '', email: p.email || '',
      subscription_status: p.subscription_status || '',
      stripe_price_id: p.stripe_price_id || '',
      created_at: p.created_at, updated_at: p.updated_at,
      lead_count: stats?.count || 0, primary_city,
    };
  });

  const recentSignups = users.slice(0, 20);

  return NextResponse.json({
    summary: {
      totalUsers, activeUsers, totalLeads, totalTargets, totalContext,
      marketsInUse, activeSubscribers, estimatedMRR,
      marketsNeedingAttention, totalGeocodes,
    },
    users,
    markets,
    recentSignups,
  });
}
