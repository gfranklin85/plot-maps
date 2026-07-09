'use client';

// ── /seed — seed your target area with postcards ──────────────────────
//
// The empty-search growth action (Greg 2026-07-08): a seller whose search
// found no match routes here for their target area, picks homes, and mails
// them a "someone wants to move here — thinking of selling?" postcard via
// PostGrid. Turns a dead end into real doors knocked. Requires sign-in.
// Reuses addresses_in_bbox (real ingested addresses) + sendPostcard.

import { useEffect, useState, useCallback } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';

interface Addr {
  id: string; full_address?: string; street_number?: string; street_name?: string;
  city?: string; state?: string; zip?: string; lat?: number; lng?: number;
}

// ~1.2km box around the target point (a neighborhood-sized seed area).
function bbox(lat: number, lng: number, km = 1.2) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { west: lng - dLng, east: lng + dLng, south: lat - dLat, north: lat + dLat };
}

export default function SeedPage() {
  const { user, loading } = useAuth();
  const [params, setParams] = useState<{ want: string; lat: number | null; lng: number | null; label: string } | null>(null);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ sent: number; total: number; env: string } | null>(null);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lat = parseFloat(q.get('lat') ?? '');
    const lng = parseFloat(q.get('lng') ?? '');
    setParams({
      want: q.get('want') ?? '',
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      label: q.get('label') ?? 'your area',
    });
  }, []);

  const loadAddrs = useCallback(async (lat: number, lng: number) => {
    setFetching(true); setNoData(false);
    try {
      const b = bbox(lat, lng);
      const res = await fetch(`/api/addresses/in-bbox?west=${b.west}&south=${b.south}&east=${b.east}&north=${b.north}&limit=60`);
      const d = await res.json();
      const list = (d.addresses ?? []) as Addr[];
      setAddrs(list);
      if (list.length === 0) setNoData(true);
    } finally { setFetching(false); }
  }, []);

  useEffect(() => {
    if (params?.lat != null && params?.lng != null) loadAddrs(params.lat, params.lng);
    else if (params) setNoData(true);
  }, [params, loadAddrs]);

  const toggle = (id: string) =>
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = addrs.length > 0 && picked.size === addrs.length;
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(addrs.map((a) => a.id)));

  const send = async () => {
    if (!params || picked.size === 0) return;
    setSending(true);
    try {
      const chosen = addrs.filter((a) => picked.has(a.id)).map((a) => ({
        fullAddress: a.full_address, streetNumber: a.street_number, streetName: a.street_name,
        city: a.city, state: a.state, zip: a.zip,
      }));
      const res = await fetch('/api/seed/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wantId: params.want, areaLabel: params.label, addresses: chosen }),
      });
      const d = await res.json();
      if (res.ok) setSent({ sent: d.sent, total: d.total, env: d.environment });
    } finally { setSending(false); }
  };

  // Signed-in users get the unified AppHeader from AppShell; only the
  // signed-out gate needs this lightweight logo bar.
  const chrome = !user ? (
    <header className="mrq-chrome">
      <a href="/" className="mrq-chrome__logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" />
        <span>by{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/position-logo.svg" alt="Position" /></span>
      </a>
    </header>
  ) : null;

  if (loading) return <div className="dsh min-h-screen">{chrome}<div className="mrq-gate"><div className="mrq-gate__spin" /></div></div>;

  if (!user) {
    return (
      <div className="dsh min-h-screen">{chrome}
        <div className="mrq-gate">
          <h1 className="mrq-gate__h">Sign in to seed your area</h1>
          <p className="mrq-gate__sub">Sending postcards to real homes needs a real account — sign in and we&apos;ll take you right back here.</p>
          <button className="mrq-btn mrq-btn--primary mrq-gate__btn" onClick={() => signInWithGoogle('/seed')}>
            <MaterialIcon icon="login" className="text-[18px]" /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="dsh min-h-screen">{chrome}
        <div className="mrq-gate">
          <span className="mrq-badge is-green"><MaterialIcon icon="check_circle" className="text-[14px]" /> Postcards on the way</span>
          <h1 className="mrq-gate__h">{sent.sent} home{sent.sent === 1 ? '' : 's'} seeded.</h1>
          <p className="mrq-gate__sub">
            Your invitation to {params?.label} is printing and mailing now.
            When one of them posts their move, the map checks it against yours.
            {sent.env === 'test' && <><br /><small>(Test mode — no real mail sent yet.)</small></>}
          </p>
          <div className="sp-nav" style={{ justifyContent: 'center' }}>
            <a className="sp-next" href="/my-request">Back to my request <MaterialIcon icon="arrow_forward" className="text-[16px]" /></a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dsh min-h-screen">{chrome}
      <div className="seed">
        <div className="seed-head">
          <span className="mrq-badge"><MaterialIcon icon="mail" className="text-[14px]" /> Seed your area</span>
          <h1>Invite homes in {params?.label}</h1>
          <p>Pick the homes to reach. Each gets a postcard: &ldquo;Someone wants to move here — thinking of selling?&rdquo; It routes them to post their own move.</p>
        </div>

        {fetching ? (
          <div className="seed-loading"><div className="mrq-gate__spin" /> Finding homes in {params?.label}…</div>
        ) : noData ? (
          <div className="seed-nodata">
            <MaterialIcon icon="map" className="text-[26px]" />
            <b>We don&apos;t have addresses mapped there yet.</b>
            <p>This area isn&apos;t in our address data yet. Share your search to pull people in instead — or check back as we expand coverage.</p>
            <a className="mrq-btn mrq-btn--primary" href="/my-request">Back to my request</a>
          </div>
        ) : (
          <>
            <div className="seed-bar">
              <button className="seed-selall" onClick={toggleAll}>
                <MaterialIcon icon={allPicked ? 'check_box' : 'check_box_outline_blank'} className="text-[18px]" />
                {allPicked ? 'Deselect all' : `Select all ${addrs.length}`}
              </button>
              <span className="seed-count">{picked.size} selected</span>
            </div>
            <div className="seed-list">
              {addrs.map((a) => {
                const on = picked.has(a.id);
                const line = a.full_address || [a.street_number, a.street_name].filter(Boolean).join(' ');
                return (
                  <button key={a.id} className={`seed-row ${on ? 'is-on' : ''}`} onClick={() => toggle(a.id)}>
                    <MaterialIcon icon={on ? 'check_box' : 'check_box_outline_blank'} className="text-[20px]" />
                    <span className="seed-row__addr">{line}</span>
                    <span className="seed-row__city">{[a.city, a.state].filter(Boolean).join(', ')}</span>
                  </button>
                );
              })}
            </div>
            <div className="seed-foot">
              <button className="mrq-btn mrq-btn--primary" disabled={picked.size === 0 || sending} onClick={send}>
                {sending ? 'Sending…' : `Send ${picked.size || ''} postcard${picked.size === 1 ? '' : 's'}`} <MaterialIcon icon="send" className="text-[16px]" />
              </button>
              <a className="seed-skip" href="/my-request">Not now</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
