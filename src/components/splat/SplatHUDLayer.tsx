'use client';

// SplatHUDLayer — Gaussian-splat HUD over the viewport.
//
// Architecture: we own the three.js scene + camera + renderer. The splat
// library's DropInViewer is just a THREE.Group we add to our scene.
// This avoids the library's auto-root-element behavior (which races with
// React mount/unmount and creates the WebGL-context cascade we saw on
// the first cut).
//
// Why: the bare Viewer constructor + rootElement pattern doesn't survive
// strict-mode double-invoke. It spins up its own canvas inside our div,
// can't tear it down cleanly when React unmounts before its async load
// finishes, and the failed teardowns leak WebGL contexts — once we cross
// the browser's per-tab WebGL context limit (~16 in Chrome), every new
// context fails with "precision is null" and the splat lib retries
// internally, hammering the .ply endpoint.
//
// With DropInViewer, we control the lifecycle: one renderer, one canvas,
// one dispose() path. The Group just hangs off our scene root.

import { useEffect, useRef } from 'react';

interface Props {
  splatUrl: string;
  opacity?: number;
  widthFraction?: number;
  bottomFraction?: number;
  /** Rotation around the Y axis in radians, applied to the splat group. */
  initialRotationY?: number;
  /** Initial position relative to scene origin. The splat coordinate
   *  space depends on what trained it; tune by eye. */
  position?: [number, number, number];
  /** Uniform scale. SAM 3D Body splats often come out ~1-2 units tall;
   *  scale to fit the HUD frame. */
  scale?: number;
  idleMotion?: boolean;
}

export default function SplatHUDLayer({
  splatUrl,
  opacity = 0.7,
  widthFraction = 0.35,
  bottomFraction = 0.04,
  initialRotationY = 0,
  position = [0, 0, 0],
  scale = 1,
  idleMotion = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const idleMotionRef = useRef(idleMotion);
  idleMotionRef.current = idleMotion;
  // Transforms held in refs so a parent re-render that changes the
  // rotation slider doesn't tear the viewer down. The render loop reads
  // current values each frame.
  const rotationYRef = useRef(initialRotationY);
  rotationYRef.current = initialRotationY;
  const positionRef = useRef(position);
  positionRef.current = position;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    console.log('[SplatHUDLayer] effect mounted', { splatUrl });
    const container = containerRef.current;
    if (!container) {
      console.warn('[SplatHUDLayer] container ref is null at effect time');
      return;
    }
    console.log('[SplatHUDLayer] container ready', {
      width: container.clientWidth,
      height: container.clientHeight,
    });
    let cancelled = false;

    // We hold every disposable in closure-scope refs so the cleanup
    // function has access to them after the async setup resolves.
    let renderer: import('three').WebGLRenderer | null = null;
    let rafId = 0;
    let resizeObs: ResizeObserver | null = null;
    let dropIn: { dispose?: () => void } | null = null;

    void (async () => {
      let THREE: typeof import('three');
      let GS: typeof import('@mkkellogg/gaussian-splats-3d');
      try {
        console.log('[SplatHUDLayer] importing three + splat lib');
        THREE = await import('three');
        GS = await import('@mkkellogg/gaussian-splats-3d');
        console.log('[SplatHUDLayer] imports done', {
          threeVersion: THREE.REVISION,
          gsKeys: Object.keys(GS),
        });
      } catch (err) {
        console.error('[SplatHUDLayer] dynamic import failed:', err);
        return;
      }
      if (cancelled || !container) {
        console.warn('[SplatHUDLayer] cancelled or container null after import');
        return;
      }

      // Scene + camera + renderer that we own.
      const scene = new THREE.Scene();
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 320;
      // Wide FOV so we don't crop a model whose coordinate space we
      // don't yet know. Camera positioned back +5 along Z so anything
      // near origin is in frame.
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0); // fully transparent

      const canvas = renderer.domElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.transition = 'opacity 200ms ease-out';
      canvas.style.willChange = 'transform, opacity';
      container.appendChild(canvas);

      // Construct DropInViewer (a THREE.Group). We pass selfDrivenMode false
      // so it doesn't spawn its own raf loop; we drive everything ourselves.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DropInViewerCtor = (GS as any).DropInViewer as new (
        opts: Record<string, unknown>,
      ) => unknown;
      let dropInViewer: unknown;
      try {
        dropInViewer = new DropInViewerCtor({
          gpuAcceleratedSort: true,
          sharedMemoryForWorkers: false,
        });
      } catch (err) {
        console.error('[SplatHUDLayer] DropInViewer construction failed:', err);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const div = dropInViewer as any;
      dropIn = div;

      // Add to scene immediately so the splat appears as soon as the
      // download finishes (the lib mutates this Group's children).
      scene.add(div as import('three').Object3D);

      // Apply initial transform from refs (so a live slider change
      // is picked up before the first render).
      const obj = div as import('three').Object3D;
      obj.position.set(positionRef.current[0], positionRef.current[1], positionRef.current[2]);
      obj.scale.setScalar(scaleRef.current);
      obj.rotation.y = rotationYRef.current;

      // Kick off the .ply load.
      try {
        console.log('[SplatHUDLayer] addSplatScene start', { splatUrl });
        await div.addSplatScene(splatUrl, {
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
        });
        console.log('[SplatHUDLayer] addSplatScene success');
      } catch (err) {
        console.error('[SplatHUDLayer] addSplatScene failed:', err);
        return;
      }
      if (cancelled) return;

      // Resize handling — keep the renderer + camera in sync with the
      // container as the viewport changes (orientation, window resize).
      resizeObs = new ResizeObserver(() => {
        if (!container || !renderer) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if (newW > 0 && newH > 0) {
          renderer.setSize(newW, newH, false);
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
        }
      });
      resizeObs.observe(container);

      // Render loop.
      const t0 = performance.now();
      const tick = () => {
        if (cancelled || !renderer) return;
        const dt = (performance.now() - t0) / 1000;

        // Read current transform from refs so slider changes apply live.
        const r = rotationYRef.current;
        const p = positionRef.current;
        const s = scaleRef.current;
        obj.scale.setScalar(s);
        if (idleMotionRef.current) {
          obj.rotation.y = r + Math.sin(dt * ((Math.PI * 2) / 24)) * 0.08;
          obj.position.y = p[1] + Math.sin(dt * ((Math.PI * 2) / 6)) * 0.05;
        } else {
          obj.rotation.y = r;
          obj.position.y = p[1];
        }
        obj.position.x = p[0];
        obj.position.z = p[2];

        // Live-bound opacity.
        canvas.style.opacity = String(opacityRef.current);

        try {
          renderer.render(scene, camera);
        } catch (err) {
          console.error('[SplatHUDLayer] render error:', err);
          cancelled = true;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObs) {
        try {
          resizeObs.disconnect();
        } catch {
          /* swallow */
        }
      }
      // Tear down in reverse order. Wrapped in try/catches because
      // strict-mode double-invoke can race with the async load.
      try {
        if (dropIn?.dispose) dropIn.dispose();
      } catch {
        /* swallow */
      }
      if (renderer) {
        try {
          renderer.dispose();
          renderer.forceContextLoss();
        } catch {
          /* swallow */
        }
        if (renderer.domElement.parentNode === container && container) {
          try {
            container.removeChild(renderer.domElement);
          } catch {
            /* swallow */
          }
        }
      }
    };
    // Only the URL re-mounts the viewer. Rotation/position/scale flow
    // through refs and update each frame inside the render loop, so
    // sliders don't trigger a destroy+rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splatUrl]);

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
