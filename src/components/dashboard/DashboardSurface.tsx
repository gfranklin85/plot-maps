'use client';

// ── DashboardSurface ──────────────────────────────────────────────────
//
// The signed-in user's workspace / command center — the "desk the map sits
// on." Reached two ways: (1) after sign-in, and (2) by BACKING OUT of the map
// (the map recedes into a floating pane and reveals THIS behind it). Deeper
// than a pause menu — a pro can stay here and work: research, reach owners,
// track workflows. memory/project_desk_surface_backout_ui + dashboard mockup.
//
// One viewport: greeting + live mini-map, the 7 tool cards (ToolGrid), then
// three live panels — Continue where you left off / Recent places / Current
// workflows. Panels use realistic placeholder data for now; wire to real
// sources (route history, recent searches, active campaigns) as a follow-up.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ToolGrid from '@/components/dashboard/ToolGrid';
import QuickDestinations from '@/components/dashboard/QuickDestinations';

// The adaptive band: surface what THIS person is actually doing. If they've
// posted a move, their Move Request leads; everyone still gets the shared
// tools below. A person can be multiple roles — this is content that adapts,
// not a walled-off role dashboard. memory/the_platform_inventory (one
// adaptive dashboard).
interface MyRequest { id: string; to_label: string | null; from_label: string | null; status: string; visibility: string }

// ── Placeholder data (swap for real sources later) ──────────────────────
const CONTINUE = [
  { name: 'Silver Lake, CA', when: 'Last viewed 2h ago', pct: 60, lat: 34.0869, lng: -118.2702 },
  { name: 'Echo Park, CA', when: 'Last viewed yesterday', pct: 30, lat: 34.0782, lng: -118.2606 },
  { name: 'Long Beach, CA', when: 'Last viewed 3 days ago', pct: 10, lat: 33.7701, lng: -118.1937 },
];
const RECENT = [
  { name: 'Silver Lake, CA', county: 'Los Angeles County', when: 'Today', lat: 34.0869, lng: -118.2702 },
  { name: 'Echo Park, CA', county: 'Los Angeles County', when: 'Yesterday', lat: 34.0782, lng: -118.2606 },
  { name: 'Long Beach, CA', county: 'Los Angeles County', when: 'May 2', lat: 33.7701, lng: -118.1937 },
  { name: 'West Adams, CA', county: 'Los Angeles County', when: 'Apr 30', lat: 34.0316, lng: -118.3389 },
  { name: 'Inglewood, CA', county: 'Los Angeles County', when: 'Apr 28', lat: 33.9617, lng: -118.3531 },
];
const WORKFLOWS = [
  { kind: 'Offer', tint: 'wf--offer', addr: '1234 Sunset Blvd', city: 'Silver Lake, CA', status: 'Drafting', statusTint: '#5b34d4', href: '/documents' },
  { kind: '3D Video', tint: 'wf--video', addr: '812 N Alvarado St', city: 'Echo Park, CA', status: 'Processing', statusTint: '#1349d4', href: '/campaigns/commercials' },
  { kind: 'Mail', tint: 'wf--mail', addr: '456 Cedar Ave', city: 'Long Beach, CA', status: 'Letters queued', statusTint: '#0f8a5f', href: '/campaigns' },
  { kind: 'Call', tint: 'wf--call', addr: '789 Pine St', city: 'West Adams, CA', status: 'In progress', statusTint: '#b6791b', href: '/campaigns' },
];

export default function DashboardSurface() {
  const router = useRouter();
  const { profile } = useProfile();
  const first = (profile.fullName || '').trim().split(/\s+/)[0] || '';

  // Fetch the user's own posted move requests → the adaptive lead card.
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  useEffect(() => {
    fetch('/api/move-request?mine=1')
      .then((r) => r.json())
      .then((d) => setMyRequests(d.requests ?? []))
      .catch(() => {});
  }, []);

  const flyTo = (lat: number, lng: number) =>
    router.push(`/map?lat=${lat}&lng=${lng}&view=3d`);

  return (
    <div className="dsh">
      <div className="dsh__wrap">
        {/* ── header band: greeting + launchpad (left) | mini-map (right) ──
            Both columns share the SAME top and bottom (align-items:stretch +
            the launchpad fills the left column) so the band lines up cleanly. */}
        <div className="dsh-top">
          <div className="dsh-intro">
            <div className="dsh-intro__eyebrow">Your workspace</div>
            <h1 className="dsh-intro__h">
              Welcome back{first ? `, ${first}` : ''}.<br />Pick up where you left off.
            </h1>
            {/* the launchpad: search anywhere + saved quick-destination chips */}
            <QuickDestinations />
          </div>

          {/* mini-map preview → opens the full map */}
          <button className="dsh-map" onClick={() => router.push('/map?view=3d')} aria-label="Open full map">
            <span className="dsh-map__chip"><MaterialIcon icon="location_on" className="text-[15px]" /> Silver Lake, CA</span>
            <span className="dsh-map__open">Open full map <MaterialIcon icon="open_in_new" className="text-[14px]" /></span>
          </button>
        </div>

        {/* ── adaptive band: your move requests (only when you have any) ──
            This is what makes the dashboard role-aware — if you posted a move,
            it leads here; if you didn't, this whole band is absent and the
            tools lead. */}
        {myRequests.length > 0 && (
          <section className="dsh-mine">
            <header className="dsh-mine__head">
              <h2><MaterialIcon icon="explore" className="text-[18px]" /> Your move {myRequests.length === 1 ? 'request' : 'requests'}</h2>
              <a className="dsh-mine__new" href="/post">Post another <MaterialIcon icon="add" className="text-[15px]" /></a>
            </header>
            <div className="dsh-mine__cards">
              {myRequests.map((r) => (
                <a key={r.id} className="dsh-mine__card" href={`/my-request?id=${r.id}`}>
                  <div className="dsh-mine__route">
                    <span>{r.from_label?.split(',')[0] || 'Your place'}</span>
                    <MaterialIcon icon="arrow_forward" className="text-[15px]" />
                    <b>{r.to_label || '—'}</b>
                  </div>
                  <div className="dsh-mine__meta">
                    <em className={`dsh-mine__pill ${r.status === 'paused' ? 'is-paused' : ''}`}>{r.status === 'paused' ? 'Paused' : 'Active'}</em>
                    <span>{r.visibility === 'private' ? 'Private draft' : 'Public'}</span>
                    <span className="dsh-mine__go">Open <MaterialIcon icon="arrow_forward" className="text-[13px]" /></span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── the tool cards ── */}
        <ToolGrid />

        {/* ── three live panels ── */}
        <div className="dsh-panels">
          {/* Continue where you left off */}
          <section className="dsh-panel">
            <header className="dsh-panel__head">
              <h2>Continue where you left off</h2>
              <button className="dsh-panel__all" onClick={() => router.push('/map?view=3d')}>View all</button>
            </header>
            <ul className="dsh-panel__list">
              {CONTINUE.map((c) => (
                <li key={c.name}>
                  <button className="dsh-cont" onClick={() => flyTo(c.lat, c.lng)}>
                    <span className="dsh-cont__thumb"><MaterialIcon icon="map" className="text-[18px]" /></span>
                    <span className="dsh-cont__body">
                      <span className="dsh-cont__name">{c.name}</span>
                      <span className="dsh-cont__when">{c.when}</span>
                      <span className="dsh-cont__bar"><span style={{ width: `${c.pct}%` }} /></span>
                    </span>
                    <span className="dsh-cont__pct">{c.pct}%</span>
                    <MaterialIcon icon="arrow_forward" className="dsh-cont__go text-[16px]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Recent places */}
          <section className="dsh-panel">
            <header className="dsh-panel__head">
              <h2>Recent places</h2>
              <button className="dsh-panel__all" onClick={() => router.push('/map?view=3d')}>View all</button>
            </header>
            <ul className="dsh-panel__list">
              {RECENT.map((r) => (
                <li key={r.name}>
                  <button className="dsh-place" onClick={() => flyTo(r.lat, r.lng)}>
                    <MaterialIcon icon="location_on" className="dsh-place__pin text-[18px]" />
                    <span className="dsh-place__body">
                      <span className="dsh-place__name">{r.name}</span>
                      <span className="dsh-place__sub">{r.county}</span>
                    </span>
                    <span className="dsh-place__when">{r.when}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Current workflows */}
          <section className="dsh-panel">
            <header className="dsh-panel__head">
              <h2>Current workflows</h2>
              <button className="dsh-panel__all" onClick={() => router.push('/campaigns')}>View all</button>
            </header>
            <ul className="dsh-panel__list">
              {WORKFLOWS.map((w) => (
                <li key={w.addr}>
                  <button className="dsh-wf" onClick={() => router.push(w.href)}>
                    <span className={`dsh-wf__kind ${w.tint}`}>{w.kind}</span>
                    <span className="dsh-wf__body">
                      <span className="dsh-wf__addr">{w.addr}</span>
                      <span className="dsh-wf__city">{w.city}</span>
                    </span>
                    <span className="dsh-wf__status" style={{ color: w.statusTint }}>{w.status}</span>
                    <MaterialIcon icon="chevron_right" className="dsh-wf__go text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
