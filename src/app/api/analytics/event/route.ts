import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { headers } from 'next/headers';

// Simple UA parsing — no library needed
function parseUA(ua: string) {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // Browser
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  // OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Device
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) deviceType = 'mobile';
  else if (ua.includes('iPad') || ua.includes('Tablet')) deviceType = 'tablet';

  return { browser, os, device_type: deviceType };
}

// Free IP geolocation — no API key needed, 45 req/min
async function geolocateIP(ip: string): Promise<{ country: string; region: string; city: string } | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.country) return { country: data.country, region: data.regionName || '', city: data.city || '' };
    return null;
  } catch {
    return null; // Non-blocking — skip geo if service is slow/down
  }
}

interface EventPayload {
  event_name: string;
  page_url?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { anonymous_id, events } = body as {
      anonymous_id: string;
      events: EventPayload[];
    };

    if (!anonymous_id || !events?.length) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const headerStore = await headers();
    const ua = headerStore.get('user-agent') || '';
    const referer = headerStore.get('referer') || '';
    const ip = (headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()) || headerStore.get('x-real-ip') || '';
    const { browser, os, device_type } = parseUA(ua);

    // Separate page_view events from other events
    const pageViews = events.filter(e => e.event_name === 'page_view');
    const otherEvents = events.filter(e => e.event_name !== 'page_view');

    // Upsert anonymous session
    const { data: existing } = await supabaseAdmin
      .from('anonymous_sessions')
      .select('id, total_pageviews, total_events')
      .eq('anonymous_id', anonymous_id)
      .single();

    let sessionId: string;

    if (existing) {
      const { error } = await supabaseAdmin
        .from('anonymous_sessions')
        .update({
          last_seen: new Date().toISOString(),
          total_pageviews: existing.total_pageviews + pageViews.length,
          total_events: existing.total_events + otherEvents.length,
        })
        .eq('id', existing.id);

      if (error) console.error('Session update error:', error);
      sessionId = existing.id;
    } else {
      // First visit — capture UTM, referrer, device info, geolocation
      const firstPageUrl = events[0]?.page_url || '';
      const url = firstPageUrl ? new URL(firstPageUrl, 'http://localhost') : null;

      // Non-blocking geo lookup — doesn't fail the request if slow
      const geo = await geolocateIP(ip);

      const { data: newSession, error } = await supabaseAdmin
        .from('anonymous_sessions')
        .insert({
          anonymous_id,
          landing_page: events[0]?.page_url || null,
          utm_source: url?.searchParams.get('utm_source') || null,
          utm_medium: url?.searchParams.get('utm_medium') || null,
          utm_campaign: url?.searchParams.get('utm_campaign') || null,
          utm_term: url?.searchParams.get('utm_term') || null,
          utm_content: url?.searchParams.get('utm_content') || null,
          referrer: referer || null,
          browser,
          os,
          device_type,
          country: geo?.country || null,
          region: geo?.region || null,
          city: geo?.city || null,
          total_pageviews: pageViews.length,
          total_events: otherEvents.length,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Session insert error:', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
      sessionId = newSession.id;
    }

    // Batch insert events
    const eventRows = events.map(e => ({
      session_id: sessionId,
      anonymous_id,
      event_name: e.event_name,
      page_url: e.page_url || null,
      metadata: e.metadata || {},
    }));

    const { error: eventsError } = await supabaseAdmin
      .from('analytics_events')
      .insert(eventRows);

    if (eventsError) console.error('Events insert error:', eventsError);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Analytics event error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
