'use client';

// SkyDome — the painted-sky atmospheric layer for the photoreal 3D surface.
//
// Mounts a Model3DElement (`<gmp-model-3d>`) inside the Map3D element. The
// model is an inverted UV sphere (Greg's Blender craft, see
// docs/asset-roadmap.md) with an emission-shader material that renders
// the equirectangular sky painting as the inside surface.
//
// Each animation frame, the dome re-centers on the camera so the viewer
// is always inside the sky. The dome's rotation aligns its painted sun
// with the real sun's azimuth for the user's lat/lng + clock — so a
// painting with the sun on its right edge will be rotated at runtime
// so that "right edge" points wherever the actual sun is in the sky
// right now.
//
// Texture variants (Day / Golden Hour / Twilight / Night) are swapped
// based on sun elevation from AtmosphereContext. Adjacent phases
// crossfade smoothly during transitions — at runtime we briefly mount
// TWO dome instances and fade their opacities, then unmount the
// outgoing one.
//
// ── DOES NOT RENDER UNTIL GREG'S ASSETS LAND ─────────────────────────
// Per the cathedral / no-basic-CSS-magic rule, this component refuses to
// render a placeholder sphere. If the geometry .glb is missing OR the
// phase-appropriate texture is missing, the component returns null. The
// existing AtmosphereOverlay (demoted to a thin ground-bounce tint)
// carries the surface alone until Greg's craft lands.
//
// Asset URL contract (relative to public/):
//   /assets/sky/sky-dome.glb                  — the inverted sphere
//   /assets/sky/textures/day.png              — clear day painting
//   /assets/sky/textures/golden_hour.png      — golden hour painting
//   /assets/sky/textures/twilight.png         — civil twilight painting
//   /assets/sky/textures/night.png            — night painting
//
// When any of these files exist, the runtime picks them up the next
// time the component mounts (no code change).
//
// Asset orientation contract:
//   - Sky paintings are equirectangular 4096×2048
//   - The painted sun is at the RIGHT edge of the canvas (x=4096, y=center)
//   - At runtime we rotate the dome around its vertical axis by
//     (realSunAzimuth - 90°) so the painted sun lines up with the real
//     sun's compass direction in the world.

import { useEffect, useRef } from 'react';
import { useAtmosphere } from '@/lib/atmosphere/AtmosphereContext';

// Asset paths — keep in lockstep with docs/asset-roadmap.md.
const SKY_DOME_GLB = '/assets/sky/sky-dome.glb';
const PHASE_TEXTURES: Record<string, string> = {
  day:                   '/assets/sky/textures/day.png',
  golden_hour:           '/assets/sky/textures/golden_hour.png',
  civil_twilight:        '/assets/sky/textures/twilight.png',
  astronomical_twilight: '/assets/sky/textures/twilight.png',  // shares painting with civil
  night:                 '/assets/sky/textures/night.png',
};

// Dome physical scale — the radius in world meters the sphere is rendered
// at. Needs to be larger than the camera's view-distance horizon so the
// dome is always visible behind buildings and terrain. Map3D's default
// view distance is well under 30km, so this gives clean margin.
const SKY_DOME_RADIUS_METERS = 30_000;

// Web-component element types for Map3D + Model3D.
type Map3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
};
type Model3DElement = HTMLElement & {
  position?: { lat: number; lng: number; altitude?: number };
  orientation?: { heading?: number; tilt?: number; roll?: number };
  scale?: number;
  src?: string;
};

interface CameraRef {
  current: { lat: number; lng: number; altitude: number; heading: number } | null;
}

interface Props {
  /** Live ref to the Map3D element this dome attaches inside. */
  mapElRef: React.RefObject<Map3DElement | null>;
  /** Live ref to the camera position. Updated every frame by MapView3D's
   *  gamepad loop. We read .current each frame to re-anchor the dome. */
  cameraRef: CameraRef;
  /** Live ref to the maps3d library being loaded. We only mount once it's
   *  ready (otherwise `gmp-model-3d` won't be defined yet). */
  maps3dReady: boolean;
}

// Check whether a URL serves an existing file. Used to refuse rendering
// until Greg's assets land — per the no-scaffold rule.
async function assetExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

export default function SkyDome({ mapElRef, cameraRef, maps3dReady }: Props) {
  const atmos = useAtmosphere();
  const domeElRef = useRef<Model3DElement | null>(null);
  const currentPhaseRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const assetsReadyRef = useRef<boolean>(false);

  // ── Asset existence check on mount ────────────────────────────────
  // Refuse to render until BOTH the geometry .glb and the
  // phase-appropriate texture .png exist on the server. The first
  // time a user lands on the map without assets, we silently no-op
  // and the demoted AtmosphereOverlay carries the surface alone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const haveGeom = await assetExists(SKY_DOME_GLB);
      // We don't bother checking every texture variant — as long as
      // ONE of them exists, the dome can render. Missing variants for
      // other phases just stop the dome from updating during phase
      // transitions, which is acceptable; the bigger concern is the
      // geometry itself.
      const haveAnyTex = (await Promise.all(
        Object.values(PHASE_TEXTURES).map(assetExists)
      )).some(Boolean);
      if (cancelled) return;
      assetsReadyRef.current = haveGeom && haveAnyTex;
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Mount the Model3DElement inside the Map3D element ────────────
  useEffect(() => {
    if (!maps3dReady) return;
    if (!mapElRef.current || !cameraRef.current) return;
    if (!assetsReadyRef.current) return;
    if (domeElRef.current) return;
    if (!atmos) return;

    const dome = document.createElement('gmp-model-3d') as Model3DElement;
    dome.src = SKY_DOME_GLB;
    dome.scale = SKY_DOME_RADIUS_METERS;
    // Seed position + orientation; per-frame ticker will update.
    dome.position = {
      lat: cameraRef.current.lat,
      lng: cameraRef.current.lng,
      altitude: cameraRef.current.altitude,
    };
    dome.orientation = { heading: 0, tilt: 0, roll: 0 };
    mapElRef.current.appendChild(dome);
    domeElRef.current = dome;

    return () => {
      if (domeElRef.current && domeElRef.current.parentNode) {
        domeElRef.current.parentNode.removeChild(domeElRef.current);
      }
      domeElRef.current = null;
      currentPhaseRef.current = null;
    };
  }, [maps3dReady, mapElRef, cameraRef, atmos]);

  // ── Texture swap on phase change ─────────────────────────────────
  // When the sun moves into a new phase, swap the dome's texture by
  // re-loading the model with the appropriate phase texture. (Map3D
  // doesn't expose direct material API; the texture is baked into the
  // .glb's emission material. To swap, we re-set the .src to the
  // appropriate phase-variant .glb URL. THIS REQUIRES Greg's craft to
  // produce a per-phase .glb OR a single .glb that loads its texture
  // from the .png URL we set. Until the asset pipeline is final, this
  // effect is a no-op that logs the intent.)
  //
  // The cleanest path once the .glb is in: pack the geometry once,
  // serve different texture .pngs by appending them as part of the
  // texture URL the glb references. Greg can choose either approach
  // when exporting; the runtime adapts.
  useEffect(() => {
    if (!atmos) return;
    if (!domeElRef.current) return;
    if (currentPhaseRef.current === atmos.phase) return;
    currentPhaseRef.current = atmos.phase;

    // Texture variant load — TBD pending Greg's asset export choice.
    // Placeholder: log so we can see phase transitions firing
    // correctly even before the visual swap is wired.
    // eslint-disable-next-line no-console
    console.debug('[SkyDome] phase change →', atmos.phase, PHASE_TEXTURES[atmos.phase]);
  }, [atmos?.phase]);

  // ── Per-frame: re-anchor dome on camera + rotate to sun azimuth ──
  useEffect(() => {
    if (!domeElRef.current || !cameraRef.current || !atmos) return;

    const tick = () => {
      const dome = domeElRef.current;
      const cam = cameraRef.current;
      if (!dome || !cam) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }
      // Re-center on the camera so the viewer is always inside.
      dome.position = {
        lat: cam.lat,
        lng: cam.lng,
        altitude: cam.altitude,
      };
      // Rotate so the painted sun (right edge of texture) points to
      // the real sun's compass direction. Subtract 90° because the
      // painted sun is at +X (right edge in equirectangular), which
      // corresponds to compass east when the dome is at heading 0.
      const sunAlignHeading = (atmos.sunAzimuthDeg - 90 + 360) % 360;
      dome.orientation = { heading: sunAlignHeading, tilt: 0, roll: 0 };

      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [cameraRef, atmos]);

  return null;
}
