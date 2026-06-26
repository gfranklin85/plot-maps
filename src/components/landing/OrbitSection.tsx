'use client';

// OrbitSection — the Orbit Property tool, COMPACT, lives ON the landing page
// (not a lonely standalone page). Image + address box + result-in-place.
// Live instant preview (flyCameraAround) + free Aerial cinematic (stream-only,
// TOS-compliant). See memory/project_orbit_property_agent_magnet.

import { useState, useRef, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type Cam = {
  center: { lat: number; lng: number; altitude: number };
  range?: number; tilt?: number; heading?: number;
};
type Map3DElement = HTMLElement & {
  mode: string;
  flyCameraTo: (o: { endCamera: Cam; durationMillis: number }) => void;
  flyCameraAround: (o: { camera: Cam; durationMillis: number; repeatCount: number }) => void;
  addEventListener: HTMLElement['addEventListener'];
};

export default function OrbitSection() {
  return (
    <section id="orbit" className="fp-section">
      <div className="fp__wrap">
        <div className="fp-orbit__layout">
          {/* left — the pitch + the tool */}
          <div className="fp-orbit__left">
            <div className="fp-intent__eyebrow">Orbit Property · free</div>
            <h2 className="fp-intent__h" style={{ textAlign: 'left' }}>Every home, in motion.</h2>
            <p className="fp-intent__lede" style={{ textAlign: 'left', marginInline: 0 }}>
              Type an address and watch it fly — an instant 3D orbit on the spot,
              or the full cinematic flyover in photoreal detail. Both free.
              Listing agents: every home you list gets one.
            </p>
            <APIProvider apiKey={API_KEY} libraries={['maps3d']}>
              <OrbitTool />
            </APIProvider>
          </div>

          {/* right — the visual */}
          <div className="fp-orbit__right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/orbit-pic.svg" alt="A property seen in a cinematic 3D orbit" className="fp-orbit__hero" draggable={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

function OrbitTool() {
  const maps3d = useMapsLibrary('maps3d');
  const stageRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<Map3DElement | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'finding' | 'orbiting' | 'notfound' | 'error'>('idle');
  const [shown, setShown] = useState<string | null>(null);

  const [cine, setCine] = useState<'idle' | 'submitting' | 'rendering' | 'ready' | 'unsupported' | 'error'>('idle');
  const [cineUri, setCineUri] = useState<string | null>(null);
  const [showCine, setShowCine] = useState(false);
  const [consent, setConsent] = useState(false); // agent consent to share the listing
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureMap = useCallback((): Map3DElement | null => {
    if (!maps3d || !stageRef.current) return null;
    if (!elRef.current) {
      const el = document.createElement('gmp-map-3d') as Map3DElement;
      el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block';
      el.mode = 'SATELLITE';
      stageRef.current.appendChild(el);
      elRef.current = el;
    }
    return elRef.current;
  }, [maps3d]);

  const orbit = useCallback(async () => {
    const q = address.trim();
    if (!q) return;
    setShowCine(false);
    setStatus('finding');
    try {
      const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.hit || data.lat == null || data.lng == null) { setStatus('notfound'); return; }
      const el = ensureMap();
      if (!el) { setStatus('error'); return; }
      const camera: Cam = { center: { lat: data.lat, lng: data.lng, altitude: 0 }, range: 220, tilt: 67, heading: 0 };
      setShown(data.formatted ?? q);
      setStatus('orbiting');
      el.flyCameraTo({ endCamera: camera, durationMillis: 4000 });
      el.addEventListener('gmp-animationend',
        () => el.flyCameraAround({ camera, durationMillis: 24000, repeatCount: 1 }),
        { once: true } as AddEventListenerOptions);
    } catch { setStatus('error'); }
  }, [address, ensureMap]);

  const renderCinematic = useCallback(async () => {
    const q = address.trim();
    if (!q) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setShowCine(true);
    setCine('submitting'); setCineUri(null);
    try {
      const res = await fetch('/api/public/aerial/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q }),
      });
      const data = await res.json();
      if (data.state === 'ACTIVE' && data.uri) { setCineUri(data.uri); setCine('ready'); return; }
      if (data.state === 'UNSUPPORTED') { setCine('unsupported'); return; }
      if (data.state === 'PROCESSING' && data.videoId) {
        setCine('rendering');
        let delay = 4000;
        const poll = async (videoId: string) => {
          try {
            const r = await fetch(`/api/public/aerial/lookup?videoId=${encodeURIComponent(videoId)}`);
            const d = await r.json();
            if (d.state === 'ACTIVE' && d.uri) { setCineUri(d.uri); setCine('ready'); return; }
            if (d.state === 'ERROR') { setCine('error'); return; }
          } catch { /* keep polling */ }
          delay = Math.min(delay * 1.6, 60000);
          pollRef.current = setTimeout(() => poll(videoId), delay);
        };
        pollRef.current = setTimeout(() => poll(data.videoId), delay);
        return;
      }
      setCine('error');
    } catch { setCine('error'); }
  }, [address]);

  const hasResult = status === 'orbiting' || showCine;

  return (
    <div className="fp-orbit">
      {/* address input */}
      <div className="fp-orbit__bar">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') orbit(); }}
          placeholder="Type any address…"
          className="fp-orbit__input"
        />
        <button onClick={orbit} disabled={!maps3d || !address.trim() || status === 'finding'} className="fp-cta fp-cta--primary">
          {status === 'finding' ? 'Finding…' : 'Orbit it →'}
        </button>
        <button onClick={renderCinematic} disabled={!address.trim() || !consent} className="fp-cta fp-cta--ghost">
          Cinematic
        </button>
      </div>

      {/* consent gate for the cinematic — the agent agrees to share the
          listing with PlotMaps (the seed of the Personal Listing Launcher).
          memory/project_unownable_open_listings */}
      <label className="fp-orbit__consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I&apos;m a listing agent, and I agree to share this listing with PlotMaps.</span>
      </label>

      {/* status */}
      <div className="fp-orbit__status">
        {status === 'notfound' && 'Couldn’t find that address — try a more complete one.'}
        {status === 'error' && 'Something went wrong. Try again.'}
        {status === 'orbiting' && shown && <span style={{ color: '#1349d4', fontWeight: 600 }}>Flying around {shown}</span>}
      </div>

      {/* the result stage — only appears once you orbit/render (compact).
          At rest it's empty; the big visual is the hero image on the right. */}
      {hasResult && (
        <div className="fp-orbit__stage">
          {/* live 3D orbit target */}
          <div ref={stageRef} style={{ position: 'absolute', inset: 0, display: status === 'orbiting' && !showCine ? 'block' : 'none' }} />

          {/* cinematic video */}
          {showCine && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1322' }}>
              {cine === 'ready' && cineUri ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={cineUri} controls autoPlay loop playsInline
                  controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
                  aria-label={`Photorealistic aerial view of ${shown ?? 'the property'} provided by Google Maps`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <p style={{ color: '#cfe1f7', fontSize: 14, padding: 20, textAlign: 'center' }}>
                  {cine === 'submitting' && 'Requesting your cinematic…'}
                  {cine === 'rendering' && 'Rendering your flyover… many homes are ready in moments, some take longer.'}
                  {cine === 'unsupported' && 'No cinematic for that address yet (US only). The instant orbit still works.'}
                  {cine === 'error' && 'Couldn’t render that one. Try the instant orbit.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {cine === 'ready' && cineUri && (
        <p className="fp-orbit__credit">Photorealistic aerial view provided by Google Maps.</p>
      )}
    </div>
  );
}
