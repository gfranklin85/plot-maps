"use client";

// ── ReticleCalibration ────────────────────────────────────────────────
//
// INTERNAL calibration harness (Greg, 2026-06-29). We can't read Google
// Map3D's depth buffer, and synthetic clicks don't fire its ray-cast — so
// we compute the GROUND POINT under the reticle OURSELVES and verify it by
// flying.
//
// SCREEN-SPACE rendering (Greg's call): forget gmp-popover (auto-pan,
// chrome wars, frozen anchors). We render the dots as plain DOM, positioned
// by our OWN world→screen projection — exactly like the SimpleLaser draws a
// pixel-positioned beam. Fully under our control; guaranteed to move every
// frame because it's our element, not Google's.
//
// TWO projections, inverse of each other:
//   • projectReticleToGround(reticle px, cam, vFOV) → ground lat/lng
//       the "shadow" — where the reticle ray hits the ground.
//   • worldToScreen(lat/lng, cam, vFOV) → screen px
//       draws ANY ground point (shadow + the fixed truth) as a DOM dot.
//
// THE one unknown is the vertical FOV. Slider tunes it; fly the TRUTH dot
// under the reticle and adjust vFOV until the SHADOW dot sits on it (GAP→0)
// across all altitudes/pitches → the projection is correct for any path.

import { useEffect, useRef, useState } from "react";

const METERS_PER_DEG_LAT = 111_320;
const D2R = Math.PI / 180;

export interface CalibCamera {
  lat: number;
  lng: number;
  altitude: number;   // meters above ground
  heading: number;    // degrees
  pitch: number;      // degrees: 0 = horizon, negative = looking down
}

interface Props {
  cameraRef: React.MutableRefObject<CalibCamera | null>;
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  reticleXFraction: number;
  reticleYFraction: number;
}

// ── ground geometry helpers ───────────────────────────────────────────
// East/north meters from the camera to a ground point.
function eastNorth(cam: CalibCamera, lat: number, lng: number) {
  const cosLat = Math.cos(cam.lat * D2R) || 1;
  const dNorth = (lat - cam.lat) * METERS_PER_DEG_LAT;
  const dEast = (lng - cam.lng) * METERS_PER_DEG_LAT * cosLat;
  return { dEast, dNorth };
}

// ── Read the TRUE camera from the Map3D element's own params ──────────
// The FpCam (camRef) is a first-person APPROXIMATION whose lat/lng/alt is
// not the real eye and whose pitch ≠ Map3D tilt — that mismatch is why the
// projection drifted (esp. with heading). Map3D is defined by:
//   center (focal point on ground), range (eye→center dist), tilt (from
//   NADIR: 0=down, 90=horizon), heading, and fov (vertical, default 35°).
// From those, the EXACT eye position + view angles are pure geometry.
export function cameraFromElement(el: HTMLElement | null): (CalibCamera & { fov: number }) | null {
  if (!el) return null;
  const e = el as HTMLElement & {
    center?: { lat: number; lng: number; altitude?: number };
    range?: number; tilt?: number; heading?: number; roll?: number; fov?: number;
  };
  const c = e.center;
  if (!c || typeof e.range !== 'number' || typeof e.tilt !== 'number' || typeof e.heading !== 'number') return null;
  const range = e.range;
  const tiltDeg = e.tilt;            // from nadir: 0=straight down, 90=horizon
  const heading = e.heading;
  const fov = typeof e.fov === 'number' && e.fov > 0 ? e.fov : 35;
  const tiltRad = tiltDeg * D2R;
  // Eye sits `range` from the focal center, up by cos(tilt), back (opposite
  // heading) by sin(tilt) horizontally.
  const eyeAlt = (c.altitude ?? 0) + range * Math.cos(tiltRad);
  const backDist = range * Math.sin(tiltRad);   // horizontal, opposite heading
  const hRad = heading * D2R;
  const cosLat = Math.cos((c.lat) * D2R) || 1;
  // back = opposite of heading direction
  const eyeLat = c.lat - (backDist * Math.cos(hRad)) / METERS_PER_DEG_LAT;
  const eyeLng = c.lng - (backDist * Math.sin(hRad)) / (METERS_PER_DEG_LAT * cosLat);
  // View pitch in OUR convention (0=horizon, negative=down). Map3D tilt 90 =
  // horizon (pitch 0); tilt 0 = straight down (pitch −90). So pitch = tilt−90.
  const pitch = tiltDeg - 90;
  return { lat: eyeLat, lng: eyeLng, altitude: eyeAlt, heading, pitch, fov };
}

// reticle pixel → ground lat/lng (ray→plane). null if at/above horizon.
export function projectReticleToGround(
  cam: CalibCamera, reticleXFrac: number, reticleYFrac: number,
  vFovDeg: number, aspect: number,
): { lat: number; lng: number } | null {
  const vOffset = (0.5 - reticleYFrac) * vFovDeg;     // up at reticle (deg)
  const hFovDeg = vFovDeg * aspect;
  const hOffset = (reticleXFrac - 0.5) * hFovDeg;     // right at reticle (deg)
  const downDeg = -(cam.pitch + vOffset);
  if (downDeg <= 2) return null;
  const horizDist = cam.altitude / Math.tan(downDeg * D2R);
  if (!Number.isFinite(horizDist) || horizDist <= 0 || horizDist > 8000) return null;
  const headingRad = (cam.heading + hOffset) * D2R;
  const dEast = horizDist * Math.sin(headingRad);
  const dNorth = horizDist * Math.cos(headingRad);
  const cosLat = Math.cos(cam.lat * D2R) || 1;
  return {
    lat: cam.lat + dNorth / METERS_PER_DEG_LAT,
    lng: cam.lng + dEast / (METERS_PER_DEG_LAT * cosLat),
  };
}

// ground lat/lng → screen pixel (forward projection). Returns null if the
// point is behind the camera or above the horizon line (not on screen).
export function worldToScreen(
  cam: CalibCamera, lat: number, lng: number,
  vFovDeg: number, aspect: number, vw: number, vh: number,
): { x: number; y: number } | null {
  // ── Proper PINHOLE perspective projection ────────────────────────────
  // The old angle-linear mapping (azOff/halfFov) was wrong off-axis — it
  // blew up when you turned/looked away. Real cameras are TANGENT-linear.
  // We build the world→camera vector and project with tan(FOV).
  //
  // World vector from eye to the ground point, in East/North/Up meters:
  const { dEast, dNorth } = eastNorth(cam, lat, lng);
  const dUp = -cam.altitude;                 // point is on the ground, eye is up
  const horiz = Math.hypot(dEast, dNorth);
  if (horiz < 0.5) return { x: vw / 2, y: vh / 2 };

  // Rotate world (E,N,U) into CAMERA space.
  //   forward (f): the view direction — heading bearing, pitched by camDown.
  //   right   (r): 90° clockwise of heading, level.
  //   up      (u): f × r.
  const h = cam.heading * D2R;               // compass: 0=N, 90=E
  const camDown = -cam.pitch * D2R;          // radians below horizon (pitch<0=down)
  const ch = Math.cos(h), sh = Math.sin(h);
  const cd = Math.cos(camDown), sd = Math.sin(camDown);

  // forward in ENU: heading gives horizontal (E=sin h, N=cos h); pitch dips it.
  const fE = sh * cd, fN = ch * cd, fU = -sd;
  // right in ENU: heading + 90°, level (no up component).
  const rE = sh > -2 ? Math.sin(h + Math.PI / 2) : 0;
  const rN = Math.cos(h + Math.PI / 2);
  const rU = 0;
  // up = forward × right (so the basis is right-handed for our screen math).
  const uE = fN * rU - fU * rN;
  const uN = fU * rE - fE * rU;
  const uU = fE * rN - fN * rE;

  // Project the eye→point vector onto the camera axes.
  const xc = dEast * rE + dNorth * rN + dUp * rU;   // right
  const yc = dEast * uE + dNorth * uN + dUp * uU;   // up
  const zc = dEast * fE + dNorth * fN + dUp * fU;   // forward (depth)
  if (zc <= 0.5) return null;                       // behind the camera

  // Perspective divide with tan(half-FOV).
  const tanV = Math.tan((vFovDeg * D2R) / 2);
  const tanH = tanV * aspect;
  const ndcX = (xc / zc) / tanH;                    // −1..1 left..right
  const ndcY = (yc / zc) / tanV;                    // −1..1 down..up
  if (Math.abs(ndcX) > 1.6 || Math.abs(ndcY) > 1.6) {
    // still return it (lets dots sit slightly off-screen) but flag offscreen
  }
  const x = vw / 2 + ndcX * (vw / 2);
  const y = vh / 2 - ndcY * (vh / 2);               // screen y grows downward
  return { x, y };
}

export default function ReticleCalibration({
  cameraRef, mapElRef, reticleXFraction, reticleYFraction,
}: Props) {
  void mapElRef; // no longer needed (screen-space rendering)

  const [vFov, setVFov] = useState<number>(() => {
    if (typeof window === 'undefined') return 45;
    const s = window.localStorage.getItem('plot:calib:vfov');
    return s ? parseFloat(s) : 45;
  });
  const vFovRef = useRef(vFov);
  vFovRef.current = vFov;

  // Use Map3D's REAL fov (mapEl.fov) instead of the slider. On by default —
  // this is the exact value, so the projection should be drift-free.
  const [useLiveFov, setUseLiveFov] = useState(true);
  const useLiveFovRef = useRef(useLiveFov);
  useLiveFovRef.current = useLiveFov;
  const [liveFov, setLiveFov] = useState<number | null>(null);
  const lastLiveFovRef = useRef<number | null>(null);

  const [truth, setTruth] = useState<{ lat: number; lng: number }>(() => {
    if (typeof window === 'undefined') return { lat: 36.3008, lng: -119.7829 };
    const s = window.localStorage.getItem('plot:calib:truth');
    return s ? JSON.parse(s) : { lat: 36.3008, lng: -119.7829 };
  });
  const truthRef = useRef(truth);
  truthRef.current = truth;

  const [hud, setHud] = useState<{
    cam: CalibCamera | null;
    shadow: { lat: number; lng: number } | null;
    gapMeters: number | null;
  }>({ cam: null, shadow: null, gapMeters: null });

  // The two DOM dots (refs so the RAF loop moves them without re-render).
  const shadowDotRef = useRef<HTMLDivElement | null>(null);
  const truthDotRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest shadow latlng for "Set truth = current shadow".
  const lastShadowRef = useRef<{ lat: number; lng: number } | null>(null);

  // ── Rolling time-series for the diagnostic graph ──────────────────────
  // Each sample: the gap + the camera state at that moment, so we can SEE
  // how the gap correlates with pitch / altitude / heading over time (a
  // spike-vs-pose pattern reveals what the math is missing). Ring buffer.
  interface Sample { t: number; gap: number; pitch: number; alt: number; heading: number; }
  const samplesRef = useRef<Sample[]>([]);
  const [, forceGraph] = useState(0);            // re-render the graph ~6/sec
  const MAX_SAMPLES = 240;                        // ~40s at 6/sec
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // ── Training LOG (full feature vectors, captured in the background) ────
  // While recording, every throttled tick appends the COMPLETE feature set
  // so we can train a correction model offline. NOT a graph — raw numbers.
  // Each row = (inputs the projection sees) + (our formula's prediction) +
  // (the TRUTH the prediction should match). The model learns the residual.
  interface LogRow {
    t: number;
    // features (what the projection is a function of):
    reticleX: number; reticleY: number;
    camLat: number; camLng: number; camAlt: number; camPitch: number; camHeading: number;
    // our current formula's predicted ground point at the reticle:
    predLat: number | null; predLng: number | null;
    // ground TRUTH (the fixed dot's real lat/lng) — the label:
    truthLat: number; truthLng: number;
    // convenience: the error our formula makes (meters), = training signal:
    gap: number | null;
    vFov: number;
  }
  const logRef = useRef<LogRow[]>([]);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  recordingRef.current = recording;
  const [logCount, setLogCount] = useState(0);

  // Per-frame: compute shadow, position BOTH dots by world→screen.
  useEffect(() => {
    let raf = 0;
    let lastHudMs = 0;
    const tick = (nowMs: number) => {
      // Use the TRUE camera derived from Map3D's own element params (eye
      // position + tilt + fov) — NOT the FpCam approximation, which was the
      // source of the drift. Falls back to camRef only if the element params
      // aren't available yet.
      const elCam = cameraFromElement(mapElRef.current);
      // TEMP: log element params + FpCam side-by-side every ~2s so we can see
      // if the element exposes live values and whether its heading matches the
      // FpCam heading (the suspected horizontal bug). Remove once fixed.
      {
        const w = window as unknown as { __calibLast?: number };
        if (!w.__calibLast || nowMs - w.__calibLast > 2000) {
          w.__calibLast = nowMs;
          const el = mapElRef.current as (HTMLElement & { center?: { lat?: number; lng?: number; altitude?: number }; range?: number; tilt?: number; heading?: number; fov?: number }) | null;
          const fp = cameraRef.current;
          console.log('[calib] ELEM', el ? {
            tag: el.tagName,
            center: el.center ? `${el.center.lat?.toFixed(5)},${el.center.lng?.toFixed(5)} alt=${el.center.altitude}` : 'none',
            range: el.range, tilt: el.tilt, heading: el.heading?.toFixed?.(1), fov: el.fov,
          } : 'NULL', '| FPCAM', fp ? { heading: fp.heading?.toFixed?.(1), pitch: fp.pitch?.toFixed?.(1), alt: fp.altitude?.toFixed?.(0) } : 'null',
          '| elCam=', elCam ? 'OK' : 'NULL');
        }
      }
      const cam: CalibCamera | null = elCam ?? cameraRef.current;
      if (cam) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const aspect = vw / vh;
        // EXACT vertical FOV from Map3D (elCam.fov = mapEl.fov, default 35°).
        const liveFov = elCam ? elCam.fov : null;
        const vfov = useLiveFovRef.current && liveFov != null ? liveFov : vFovRef.current;
        if (liveFov != null && liveFov !== lastLiveFovRef.current) {
          lastLiveFovRef.current = liveFov;
          setLiveFov(liveFov);
        }

        const shadow = projectReticleToGround(cam, reticleXFraction, reticleYFraction, vfov, aspect);
        lastShadowRef.current = shadow;

        // place shadow dot
        const sd = shadowDotRef.current;
        if (sd) {
          const sp = shadow ? worldToScreen(cam, shadow.lat, shadow.lng, vfov, aspect, vw, vh) : null;
          if (sp) {
            sd.style.transform = `translate3d(${sp.x}px,${sp.y}px,0) translate(-50%,-50%)`;
            sd.style.opacity = '1';
          } else { sd.style.opacity = '0'; }
        }
        // place truth dot
        const td = truthDotRef.current;
        if (td) {
          const tp = worldToScreen(cam, truthRef.current.lat, truthRef.current.lng, vfov, aspect, vw, vh);
          if (tp) {
            td.style.transform = `translate3d(${tp.x}px,${tp.y}px,0) translate(-50%,-50%)`;
            td.style.opacity = '1';
          } else { td.style.opacity = '0'; }
        }

        if (nowMs - lastHudMs > 160) {
          lastHudMs = nowMs;
          let gap: number | null = null;
          if (shadow) {
            const cosLat = Math.cos(truthRef.current.lat * D2R) || 1;
            const dN = (shadow.lat - truthRef.current.lat) * METERS_PER_DEG_LAT;
            const dE = (shadow.lng - truthRef.current.lng) * METERS_PER_DEG_LAT * cosLat;
            gap = Math.hypot(dN, dE);
            setHud({ cam, shadow, gapMeters: gap });
          } else {
            setHud({ cam, shadow: null, gapMeters: null });
          }
          // push a sample to the rolling buffer (unless paused for study)
          if (!pausedRef.current && gap != null) {
            const buf = samplesRef.current;
            buf.push({ t: nowMs, gap, pitch: cam.pitch, alt: cam.altitude, heading: cam.heading });
            if (buf.length > MAX_SAMPLES) buf.shift();
            forceGraph((n) => (n + 1) & 0xffff);
          }

          // append a full feature row to the TRAINING LOG while recording
          if (recordingRef.current) {
            logRef.current.push({
              t: Math.round(nowMs),
              reticleX: reticleXFraction, reticleY: reticleYFraction,
              camLat: cam.lat, camLng: cam.lng, camAlt: cam.altitude,
              camPitch: cam.pitch, camHeading: cam.heading,
              predLat: shadow ? shadow.lat : null, predLng: shadow ? shadow.lng : null,
              truthLat: truthRef.current.lat, truthLng: truthRef.current.lng,
              gap, vFov: vFovRef.current,
            });
            setLogCount(logRef.current.length);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, reticleXFraction, reticleYFraction]);

  const setFov = (v: number) => {
    setVFov(v);
    try { window.localStorage.setItem('plot:calib:vfov', String(v)); } catch { /* noop */ }
  };
  const setTruthHere = () => {
    if (lastShadowRef.current) {
      setTruth(lastShadowRef.current);
      try { window.localStorage.setItem('plot:calib:truth', JSON.stringify(lastShadowRef.current)); } catch { /* noop */ }
    }
  };

  // Download the captured training log as JSON (feed to the offline learner).
  const exportLog = () => {
    const rows = logRef.current;
    if (!rows.length) return;
    const payload = {
      capturedAt: new Date().toISOString(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      count: rows.length,
      rows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reticle-calib-${rows.length}rows.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const toggleRecord = () => {
    setRecording((r) => {
      const next = !r;
      if (next) { logRef.current = []; setLogCount(0); } // fresh take on each REC
      return next;
    });
  };

  const dotBase: React.CSSProperties = {
    position: 'fixed', left: 0, top: 0, zIndex: 9400, pointerEvents: 'none',
    width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
    color: '#fff', font: '700 12px/1 monospace', willChange: 'transform', opacity: 0,
  };

  return (
    <>
      {/* SHADOW dot (cyan) — our live reticle ground-projection. */}
      <div ref={shadowDotRef} style={{
        ...dotBase, background: '#00f2ff', border: '3px solid #fff',
        boxShadow: '0 0 0 2px #00f2ff, 0 0 16px #00f2ff',
      }}>◎</div>
      {/* TRUTH dot (red) — fixed ground reference. */}
      <div ref={truthDotRef} style={{
        ...dotBase, background: '#ef6b6b', border: '3px solid #fff',
        boxShadow: '0 0 0 2px #ef6b6b, 0 0 16px #ef6b6b',
      }}>T</div>

      <div style={{
        position: 'fixed', top: 70, left: 12, zIndex: 9500, width: 290,
        background: 'rgba(8,11,18,0.92)', border: '1px solid rgba(0,242,255,0.4)',
        borderRadius: 10, padding: '12px 14px', color: '#cfe9ff',
        font: '12px/1.5 ui-monospace, monospace', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontWeight: 800, color: '#00f2ff', letterSpacing: 1, marginBottom: 6 }}>
          RETICLE CALIBRATION
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>vFOV <b style={{ color: '#fff' }}>{(useLiveFov && liveFov != null ? liveFov : vFov).toFixed(1)}°</b></span>
          <label style={{ fontSize: 10.5, color: useLiveFov ? '#35d07f' : '#7c93a8', cursor: 'pointer' }}>
            <input type="checkbox" checked={useLiveFov} onChange={(e) => setUseLiveFov(e.target.checked)}
              style={{ accentColor: '#35d07f', verticalAlign: 'middle', marginRight: 4 }} />
            live mapEl.fov{liveFov != null ? ` (${liveFov.toFixed(1)}°)` : ' (—)'}
          </label>
        </div>
        <input type="range" min={20} max={90} step={0.5} value={vFov} disabled={useLiveFov}
          onChange={(e) => setFov(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#00f2ff', opacity: useLiveFov ? 0.4 : 1 }} />
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 8 }}>
          <div>cam alt <b>{hud.cam ? hud.cam.altitude.toFixed(0) : '—'}m</b> · pitch <b>{hud.cam ? hud.cam.pitch.toFixed(1) : '—'}°</b></div>
          <div>heading <b>{hud.cam ? hud.cam.heading.toFixed(0) : '—'}°</b></div>
          <div>shadow <b>{hud.shadow ? `${hud.shadow.lat.toFixed(5)},${hud.shadow.lng.toFixed(5)}` : 'sky'}</b></div>
          <div>truth <b>{truth.lat.toFixed(5)},{truth.lng.toFixed(5)}</b></div>
          <div style={{ marginTop: 4 }}>GAP <b style={{
            color: hud.gapMeters == null ? '#888' : hud.gapMeters < 3 ? '#35d07f' : hud.gapMeters < 15 ? '#fbc64f' : '#ef6b6b',
            fontSize: 14,
          }}>{hud.gapMeters == null ? '—' : `${hud.gapMeters.toFixed(1)}m`}</b></div>
        </div>

        {/* ── Diagnostic time-series graph ── */}
        <GapGraph samples={samplesRef.current} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={() => setPaused((p) => !p)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6,
            background: paused ? 'rgba(251,198,79,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${paused ? '#fbc64f' : 'rgba(255,255,255,0.2)'}`,
            color: paused ? '#fbc64f' : '#cfe9ff', fontWeight: 700, cursor: 'pointer', fontSize: 11,
          }}>{paused ? '▶ resume' : '⏸ pause'}</button>
          <button onClick={() => { samplesRef.current = []; forceGraph((n) => n + 1); }} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.2)', color: '#cfe9ff', fontWeight: 700, cursor: 'pointer', fontSize: 11,
          }}>clear</button>
        </div>

        {/* ── TRAINING LOG capture (raw numbers → offline learner) ── */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <button onClick={toggleRecord} style={{
            flex: 1, padding: '6px 0', borderRadius: 6,
            background: recording ? 'rgba(239,107,107,0.22)' : 'rgba(53,208,127,0.16)',
            border: `1px solid ${recording ? '#ef6b6b' : '#35d07f'}`,
            color: recording ? '#ef6b6b' : '#35d07f', fontWeight: 800, cursor: 'pointer', fontSize: 11,
          }}>{recording ? `● REC ${logCount}` : '○ record log'}</button>
          <button onClick={exportLog} disabled={logCount === 0} style={{
            flex: 1, padding: '6px 0', borderRadius: 6, background: 'rgba(0,242,255,0.12)',
            border: '1px solid rgba(0,242,255,0.45)', color: '#00f2ff', fontWeight: 800,
            cursor: logCount ? 'pointer' : 'not-allowed', opacity: logCount ? 1 : 0.4, fontSize: 11,
          }}>export ({logCount})</button>
        </div>

        <button onClick={setTruthHere} style={{
          marginTop: 8, width: '100%', padding: '7px 0', borderRadius: 7,
          background: 'rgba(0,242,255,0.14)', border: '1px solid rgba(0,242,255,0.5)',
          color: '#00f2ff', fontWeight: 700, cursor: 'pointer',
        }}>Set truth = current shadow</button>
        <div style={{ marginTop: 6, fontSize: 10.5, color: '#7c93a8' }}>
          Graph: <span style={{ color: '#00f2ff' }}>GAP</span> ·
          <span style={{ color: '#fbc64f' }}> pitch</span> ·
          <span style={{ color: '#9b8cff' }}> heading</span>. Fly around — watch
          which camera move spikes the gap.
        </div>
      </div>
    </>
  );
}

// ── GapGraph ──────────────────────────────────────────────────────────
// Overlaid time-series: GAP (cyan, 0..maxGap auto), pitch (yellow, −90..0),
// heading (purple, 0..360). Lets us SEE how the gap correlates with the
// camera move that caused it, instead of eyeballing single points.
interface GraphSample { t: number; gap: number; pitch: number; alt: number; heading: number; }
function GapGraph({ samples }: { samples: GraphSample[] }) {
  const W = 262, H = 92, pad = 2;
  if (samples.length < 2) {
    return (
      <div style={{ marginTop: 8, height: H, borderRadius: 6, background: 'rgba(0,0,0,0.35)',
        display: 'grid', placeItems: 'center', color: '#5a6b7a', fontSize: 11 }}>
        fly to record…
      </div>
    );
  }
  const n = samples.length;
  const maxGap = Math.max(10, ...samples.map((s) => s.gap));
  const xAt = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const yGap = (g: number) => H - pad - (g / maxGap) * (H - 2 * pad);
  const yPitch = (p: number) => H - pad - ((p + 90) / 90) * (H - 2 * pad);   // −90..0
  const yHead = (h: number) => H - pad - (h / 360) * (H - 2 * pad);          // 0..360
  const line = (yf: (s: GraphSample) => number) =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yf(s).toFixed(1)}`).join(' ');

  return (
    <svg width={W} height={H} style={{ marginTop: 8, borderRadius: 6, background: 'rgba(0,0,0,0.4)', display: 'block' }}>
      {/* zero / mid gridlines */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      <path d={line((s) => yHead(s.heading))} fill="none" stroke="#9b8cff" strokeWidth={1} opacity={0.7} />
      <path d={line((s) => yPitch(s.pitch))} fill="none" stroke="#fbc64f" strokeWidth={1} opacity={0.8} />
      <path d={line((s) => yGap(s.gap))} fill="none" stroke="#00f2ff" strokeWidth={1.75} />
      {/* maxGap label */}
      <text x={W - pad - 2} y={11} textAnchor="end" fill="#00f2ff" fontSize={9} fontFamily="monospace">
        {maxGap.toFixed(0)}m
      </text>
    </svg>
  );
}
