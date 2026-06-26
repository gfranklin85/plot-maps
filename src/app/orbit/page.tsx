'use client';

// /orbit — Orbit Property. Type an address → the 3D map flies in and orbits
// the property (Google Map3DElement flyCameraTo + flyCameraAround). The
// give-first agent magnet: free orbit videos of any listing.
// See memory/project_orbit_property_agent_magnet.
//
// Reuses the same stack as the main map: @vis.gl/react-google-maps APIProvider
// + useMapsLibrary('maps3d') + the <gmp-map-3d> element. Address → lat/lng via
// the public geocode route (/api/public/geocode). Standalone + lightweight —
// does NOT touch the heavy /map page.

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Minimal Map3DElement web-component type (mirrors MapView3D.tsx).
type Cam = {
  center: { lat: number; lng: number; altitude: number };
  range?: number;
  tilt?: number;
  heading?: number;
};
type Map3DElement = HTMLElement & {
  mode: string;
  flyCameraTo: (o: { endCamera: Cam; durationMillis: number }) => void;
  flyCameraAround: (o: { camera: Cam; durationMillis: number; repeatCount: number }) => void;
  stopCameraAnimation: () => void;
  addEventListener: HTMLElement['addEventListener'];
};

export default function OrbitPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/bullpen" className="hover:text-[#1349d4] transition-colors">The Bullpen</Link>
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <APIProvider apiKey={API_KEY} libraries={['maps3d']}>
          <OrbitStage />
        </APIProvider>
      </main>

      <PositionFooter />
    </div>
  );
}

function OrbitStage() {
  const maps3d = useMapsLibrary('maps3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<Map3DElement | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'finding' | 'orbiting' | 'notfound' | 'error'>('idle');
  const [shown, setShown] = useState<string | null>(null);

  // ── Aerial cinematic render (the polished "Apollo 13", free per Google) ──
  const [cine, setCine] = useState<'idle' | 'submitting' | 'rendering' | 'ready' | 'unsupported' | 'error'>('idle');
  const [cineUri, setCineUri] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure the <gmp-map-3d> element exists, return it.
  const ensureMap = useCallback((): Map3DElement | null => {
    if (!maps3d || !containerRef.current) return null;
    if (!elRef.current) {
      const el = document.createElement('gmp-map-3d') as Map3DElement;
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.display = 'block';
      el.mode = 'SATELLITE';
      containerRef.current.appendChild(el);
      elRef.current = el;
    }
    return elRef.current;
  }, [maps3d]);

  // ── the INSTANT live preview (the hook) — flyCameraAround on real tiles ──
  const orbit = useCallback(async () => {
    const q = address.trim();
    if (!q) return;
    setStatus('finding');
    try {
      const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.hit || data.lat == null || data.lng == null) {
        setStatus('notfound');
        return;
      }
      const el = ensureMap();
      if (!el) { setStatus('error'); return; }

      // Property-scale camera: low, tilted, close so it circles the building.
      const camera: Cam = {
        center: { lat: data.lat, lng: data.lng, altitude: 0 },
        range: 220,
        tilt: 67,
        heading: 0,
      };
      setShown(data.formatted ?? q);
      setStatus('orbiting');
      el.flyCameraTo({ endCamera: camera, durationMillis: 4000 });
      el.addEventListener(
        'gmp-animationend',
        () => el.flyCameraAround({ camera, durationMillis: 24000, repeatCount: 1 }),
        { once: true } as AddEventListenerOptions,
      );
    } catch {
      setStatus('error');
    }
  }, [address, ensureMap]);

  // ── request the polished cinematic (Aerial View renderVideo → poll) ──
  const renderCinematic = useCallback(async () => {
    const q = address.trim();
    if (!q) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setCine('submitting');
    setCineUri(null);
    try {
      const res = await fetch('/api/public/aerial/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q }),
      });
      const data = await res.json();

      if (data.state === 'ACTIVE' && data.uri) { setCineUri(data.uri); setCine('ready'); return; }
      if (data.state === 'UNSUPPORTED') { setCine('unsupported'); return; }
      if (data.state === 'PROCESSING' && data.videoId) {
        setCine('rendering');
        // Poll lookupVideo with exponential backoff (renders take ~hours, but
        // many addresses are pre-rendered and finish fast).
        let delay = 4000;
        const poll = async (videoId: string) => {
          try {
            const r = await fetch(`/api/public/aerial/lookup?videoId=${encodeURIComponent(videoId)}`);
            const d = await r.json();
            if (d.state === 'ACTIVE' && d.uri) { setCineUri(d.uri); setCine('ready'); return; }
            if (d.state === 'ERROR') { setCine('error'); return; }
          } catch { /* keep polling through transient errors */ }
          delay = Math.min(delay * 1.6, 60000);
          pollRef.current = setTimeout(() => poll(videoId), delay);
        };
        pollRef.current = setTimeout(() => poll(data.videoId), delay);
        return;
      }
      setCine('error');
    } catch {
      setCine('error');
    }
  }, [address]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
          Orbit Property
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-extrabold mt-3 leading-[1.05]">
          Watch any home fly.
        </h1>
        <p className="text-lg mt-4 text-[#4a5568] max-w-2xl mx-auto leading-relaxed">
          Type an address. The instant 3D preview flies in right here, on the
          spot. Want the polished cinematic? We&apos;ll pull it — ready in
          moments if it&apos;s already been filmed, or freshly rendered if not.
          Both free.
        </p>
      </div>

      {/* address input */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') orbit(); }}
          placeholder="559 Ivory Street, Lemoore CA"
          className="flex-1 px-4 py-3.5 rounded-xl text-base placeholder:text-[#aab2c0] focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)] text-[#0c1322]"
          style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.2)' }}
        />
        <button
          onClick={orbit}
          disabled={!maps3d || !address.trim() || status === 'finding'}
          className="px-7 py-3.5 rounded-xl text-base font-bold transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg,#1349d4,#122d8d)', color: '#fff', boxShadow: '0 10px 24px -10px rgba(19,73,212,0.7)' }}
        >
          {status === 'finding' ? 'Finding…' : 'Instant preview →'}
        </button>
      </div>

      {/* status line */}
      <div className="text-center mt-3 text-sm h-5 text-[#6b7689]">
        {status === 'notfound' && 'Couldn’t find that address — try a more complete one.'}
        {status === 'error' && 'Something went wrong. Try again.'}
        {status === 'orbiting' && shown && <span className="text-[#1349d4] font-semibold">Flying around {shown} — drag to look around</span>}
        {status === 'idle' && !maps3d && 'Loading the 3D engine…'}
      </div>

      {/* the 3D stage */}
      <div
        ref={containerRef}
        className="mt-6 rounded-2xl overflow-hidden"
        style={{
          width: '100%',
          aspectRatio: '16 / 10',
          background: 'linear-gradient(180deg,#cfe1f7,#eaf1fb)',
          border: '1px solid rgba(19,73,212,0.14)',
          boxShadow: '0 24px 60px -30px rgba(20,50,120,0.5)',
        }}
      />

      {/* ── the polished cinematic (Aerial View render — free, async) ── */}
      <div className="mt-6 text-center">
        {cine === 'idle' && (
          <button
            onClick={renderCinematic}
            disabled={!address.trim()}
            className="px-6 py-3 rounded-full text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: '#fff', color: '#1349d4', border: '1px solid rgba(19,73,212,0.4)' }}
          >
            🎬 Render the full cinematic flyover (free)
          </button>
        )}
        {cine === 'submitting' && <p className="text-sm text-[#6b7689]">Requesting your cinematic…</p>}
        {cine === 'rendering' && (
          <p className="text-sm text-[#1349d4] font-semibold">
            Rendering your flyover… many homes are ready in moments, some take longer. You can keep this open.
          </p>
        )}
        {cine === 'unsupported' && (
          <p className="text-sm text-[#6b7689]">No cinematic available for that address yet (US addresses only). The instant preview above still works.</p>
        )}
        {cine === 'error' && <p className="text-sm text-[#6b7689]">Couldn’t render that one. Try the instant preview above.</p>}
        {cine === 'ready' && cineUri && (
          <div className="mt-4">
            {/* Google Aerial videos are STREAM-ONLY — must not be downloaded,
                stored, or cached (Maps Platform TOS). The URI is short-lived;
                we play it live. accessibility: photoreal aerial of the address. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={cineUri}
              controls
              autoPlay
              loop
              playsInline
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`Photorealistic aerial view of ${shown ?? 'the property'} provided by Google Maps`}
              className="w-full rounded-2xl"
              style={{ border: '1px solid rgba(19,73,212,0.14)', boxShadow: '0 24px 60px -30px rgba(20,50,120,0.5)' }}
            />
            <p className="mt-2 text-xs text-[#8a93a4]">
              Photorealistic aerial view provided by Google Maps.
            </p>
          </div>
        )}
      </div>

      {/* the agent give-first offer — copy kept to what's TRUE today (no
          feed/automation promise; that's the open-listings future).
          memory/project_orbit_property_agent_magnet + project_unownable_open_listings */}
      <div
        className="mt-10 rounded-2xl p-6 md:p-8"
        style={{ background: 'linear-gradient(160deg, rgba(19,73,212,0.07), rgba(18,45,141,0.04))', border: '1px solid rgba(19,73,212,0.16)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#1349d4]">For listing agents</div>
        <h2 className="font-headline text-2xl font-bold mt-2">A cinematic flyover for every listing. Free.</h2>
        <p className="text-[15px] mt-3 text-[#27313f] leading-relaxed max-w-2xl">
          Give your buyers a photoreal 3D flyover of the homes you list — no
          render fees, no watermark, no catch. Send us a listing and we&apos;ll
          have the flyover ready to share, right from the property&apos;s page.
        </p>
        <Link
          href="/join-position"
          className="inline-block mt-5 px-6 py-3 rounded-full text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(160deg,#1349d4,#122d8d)', color: '#fff', boxShadow: '0 10px 24px -10px rgba(19,73,212,0.7)' }}
        >
          Orbit my listings →
        </Link>
      </div>
    </section>
  );
}
