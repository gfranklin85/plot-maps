'use client';

// SplatHUDLayer — renders a Gaussian-splat asset as a HUD overlay over
// whatever's underneath (map, landing, blurred arrival background).
//
// The splat sits in screen space, not world space. It does NOT live
// inside the map's 3D scene — it floats over it like a cockpit reticle.
// The user's avatar (or, before SAM 3D pipeline ships, the F-18 as a
// placeholder) is rendered as a translucent figure in the lower-center,
// drifting with subtle idle motion so it reads as alive.
//
// Why splats and not glTF meshes:
//   - SAM 3D Body's output is a .ply Gaussian-splat file. The point of
//     this layer IS to render that output as-is, no mesh conversion.
//   - Splats handle hair, clothing folds, transparency and partial
//     occlusion in ways meshes cost serious modeling time to match.
//   - At ~22k splats per asset (the F-18) we're well within real-time
//     WebGL budget on any modern GPU.
//
// Library: @mkkellogg/gaussian-splats-3d (MIT, ships its own three.js
// renderer with custom shaders for the splat math).

import { useEffect, useRef } from 'react';

interface Props {
  /** URL to the .ply splat file. */
  splatUrl: string;
  /** Opacity multiplier, 0..1. UI slider drives this live. Defaults to 0.7
   *  (translucent — the user can see through to the world behind). */
  opacity?: number;
  /** Width of the HUD render area as a fraction of viewport width.
   *  Default 0.35 (roughly the lower-center area, leaves the sides clear). */
  widthFraction?: number;
  /** Bottom offset of the HUD region as a fraction of viewport height.
   *  Default 0.04 (small gutter from the bottom edge). */
  bottomFraction?: number;
  /** Initial rotation of the splat in radians. The F-18 mesh from SAM
   *  3D needs a quarter-turn so its nose faces away from the viewer.
   *  Per-asset; future avatars will likely use different defaults. */
  initialRotationY?: number;
  /** Idle motion: subtle bob + slow rotation so the splat reads as
   *  alive. Defaults to true. */
  idleMotion?: boolean;
}

export default function SplatHUDLayer({
  splatUrl,
  opacity = 0.7,
  widthFraction = 0.35,
  bottomFraction = 0.04,
  initialRotationY = 0,
  idleMotion = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hold the live values in refs so the render loop reads current props
  // without reattaching.
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const idleMotionRef = useRef(idleMotion);
  idleMotionRef.current = idleMotion;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Dynamic import so three.js + splat lib don't bloat pages that
    // don't render a splat.
    void (async () => {
      const THREE = await import('three');
      const { Viewer } = await import('@mkkellogg/gaussian-splats-3d');

      if (cancelled || !container) return;

      // Construct a viewer scoped to our container. selfDrivenMode = true
      // lets the lib run its own RAF loop; useBuiltInControls = false
      // because we don't want mouse interaction on the HUD splat.
      type ViewerCtor = new (opts: Record<string, unknown>) => {
        addSplatScene: (
          url: string,
          opts: Record<string, unknown>,
        ) => Promise<void>;
        getSplatScene: (i: number) => {
          scenePosition?: { set: (x: number, y: number, z: number) => void };
          sceneRotation?: {
            set: (x: number, y: number, z: number, w: number) => void;
          };
          getSplatScene?: () => unknown;
          opacity?: number;
        };
        start: () => void;
        dispose: () => Promise<void>;
        threeScene?: { children: { length: number } };
        camera: { position: { set: (x: number, y: number, z: number) => void } };
        renderer: { domElement: HTMLCanvasElement };
        update?: () => void;
        render?: () => void;
      };
      const ViewerCls = Viewer as unknown as ViewerCtor;

      const viewer = new ViewerCls({
        rootElement: container,
        selfDrivenMode: true,
        useBuiltInControls: false,
        ignoreDevicePixelRatio: false,
        gpuAcceleratedSort: true,
        sharedMemoryForWorkers: false,
        // Transparent canvas so we composite over whatever's underneath.
        renderMode: 1, // continuous render
      });

      try {
        await viewer.addSplatScene(splatUrl, {
          showLoadingUI: false,
          // splatAlphaRemovalThreshold trims fully-transparent splats —
          // keeps GPU work down without losing visible detail.
          splatAlphaRemovalThreshold: 5,
        });
      } catch (err) {
        console.error('[SplatHUDLayer] load failed:', err);
        return;
      }

      if (cancelled) {
        await viewer.dispose();
        return;
      }

      viewer.start();

      // Apply initial rotation to the loaded splat scene.
      const scene = viewer.getSplatScene(0);
      if (scene?.sceneRotation && initialRotationY !== 0) {
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(0, initialRotationY, 0));
        scene.sceneRotation.set(q.x, q.y, q.z, q.w);
      }

      // The splat library renders to its own canvas inside the container.
      // We layer our opacity + idle-motion as CSS on that canvas — simpler
      // than reaching into the shader uniforms and works the same way.
      const canvas = viewer.renderer.domElement;
      canvas.style.opacity = String(opacityRef.current);
      canvas.style.transition = 'opacity 200ms ease-out';
      canvas.style.willChange = 'transform, opacity';

      // Idle motion: subtle bob + slow rotation, time-driven so it's
      // deterministic. ~6s bob period, ~24s rotation period.
      let rafId = 0;
      const t0 = performance.now();
      function tick() {
        if (cancelled) return;
        const dt = (performance.now() - t0) / 1000;
        canvas.style.opacity = String(opacityRef.current);
        if (idleMotionRef.current) {
          const bob = Math.sin(dt * ((Math.PI * 2) / 6)) * 4; // ±4px
          const yaw = Math.sin(dt * ((Math.PI * 2) / 24)) * 3; // ±3°
          canvas.style.transform = `translateY(${bob}px) rotate(${yaw}deg)`;
        } else {
          canvas.style.transform = '';
        }
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);

      // Cleanup binds onto the cancelled flag too so we don't double-free.
      return () => {
        cancelAnimationFrame(rafId);
      };
    })();

    return () => {
      cancelled = true;
      // We don't manually destroy the viewer here — the dynamic-import
      // closure handles its own teardown via the cancelled flag and the
      // async dispose call inside. If we await dispose synchronously
      // here React's effect cleanup hangs.
    };
  }, [splatUrl, initialRotationY]);

  // Container is fixed bottom-center over the viewport. pointer-events-
  // none so it doesn't eat clicks meant for the world underneath.
  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'fixed',
        left: '50%',
        bottom: `${bottomFraction * 100}%`,
        transform: 'translateX(-50%)',
        width: `${widthFraction * 100}vw`,
        aspectRatio: '1 / 1',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
