'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { timeAgo } from '../admin-utils';
import type { HotProspect } from '../admin-utils';

interface EventRow {
  id: string;
  event_name: string;
  page_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SessionDetail {
  session: Record<string, unknown> & {
    anonymous_id: string;
    landing_page: string | null;
    first_seen: string;
    last_seen: string;
    total_pageviews: number;
    total_sessions: number;
    total_events: number;
    engagement_score: number;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
  };
  events: EventRow[];
}

interface Props {
  prospect: HotProspect | null;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function eventIcon(name: string): string {
  if (name.includes('pageview')) return 'visibility';
  if (name.includes('click')) return 'mouse';
  if (name.includes('signup') || name.includes('convert')) return 'how_to_reg';
  if (name.includes('scroll')) return 'swipe_vertical';
  return 'radio_button_checked';
}

export default function ProspectDrawer({ prospect, onClose }: Props) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!prospect) {
      setDetail(null);
      setError('');
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/analytics/session/${prospect!.anonymous_id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setError('Failed to load session detail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [prospect]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (prospect) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prospect, onClose]);

  if (!prospect) return null;

  const session = detail?.session ?? null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden />
      <div className="w-full max-w-xl h-full bg-surface border-l border-outline-variant shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-1">Prospect detail</p>
            <h3 className="text-lg font-semibold text-on-surface font-mono">{prospect.anonymous_id.slice(0, 8)}…</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Last seen {timeAgo(prospect.last_seen)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
            aria-label="Close"
          >
            <MaterialIcon icon="close" className="text-lg" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pageviews" value={prospect.total_pageviews} />
            <Stat label="Sessions" value={prospect.total_sessions} />
            <Stat label="Events" value={prospect.total_events} />
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-2">Engagement score</p>
            <p className="text-3xl font-bold text-primary">{Math.round(prospect.engagement_score)}</p>
            <p className="text-xs text-on-surface-variant mt-2 leading-snug">
              {Math.min(prospect.total_pageviews, 50)} pageviews × 2 +{' '}
              {Math.min(prospect.total_events, 100)} events × 1 +{' '}
              {Math.min(prospect.total_sessions, 20)} sessions × 5
              {Date.now() - new Date(prospect.last_seen).getTime() < 24 * 60 * 60 * 1000 ? ' + 20 recency bonus' : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Landing page" value={prospect.landing_page || '—'} />
            <Field label="Device" value={prospect.device_type || '—'} cap />
            <Field label="Browser" value={prospect.browser || '—'} />
            <Field label="UTM source" value={prospect.utm_source || 'direct'} />
            {session && <Field label="OS" value={session.os || '—'} />}
            {session && <Field label="Location" value={[session.city, session.region, session.country].filter(Boolean).join(', ') || '—'} />}
            {session && <Field label="Referrer" value={session.referrer || '—'} />}
            {session && <Field label="UTM campaign" value={session.utm_campaign || '—'} />}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <MaterialIcon icon="timeline" className="text-primary text-base" />
              Session timeline
            </h4>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading events…
              </div>
            )}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            {detail && detail.events.length === 0 && (
              <p className="text-sm text-on-surface-variant py-4">No individual events recorded for this session.</p>
            )}
            {detail && detail.events.length > 0 && (
              <ol className="relative border-l border-outline-variant ml-2 space-y-3 mt-2">
                {detail.events.map(ev => (
                  <li key={ev.id} className="ml-4">
                    <span className="absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
                    <div className="flex items-center gap-2 text-sm text-on-surface">
                      <MaterialIcon icon={eventIcon(ev.event_name)} className="text-sm text-primary" />
                      <span className="font-medium">{ev.event_name}</span>
                      <span className="text-xs text-on-surface-variant">{formatTime(ev.created_at)}</span>
                    </div>
                    {ev.page_url && (
                      <p className="text-xs text-on-surface-variant mt-0.5 truncate" title={ev.page_url}>{ev.page_url}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">{label}</p>
      <p className="text-xl font-bold text-on-surface mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

function Field({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">{label}</p>
      <p className={`text-on-surface mt-0.5 truncate ${cap ? 'capitalize' : ''}`} title={value}>{value}</p>
    </div>
  );
}
