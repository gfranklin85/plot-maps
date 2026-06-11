"use client";

// PlotCardMarker3D — pins custom HTML (the property card) to a lat/lng
// in the photoreal 3D world, riding alongside that location as the
// camera moves.
//
// THE RECIPE (from Google's 3D Maps docs, confirmed 2026-06-10 — not a
// fake this time): the purpose-built tool is a PopoverElement anchored
// to a Marker3DInteractiveElement.
//
//   const { Marker3DInteractiveElement, PopoverElement } =
//       await google.maps.importLibrary('maps3d');
//   const marker  = new Marker3DInteractiveElement({ altitudeMode, position });
//   const popover = new PopoverElement({ open: true, positionAnchor: marker });
//   popover.append(domNode);          // ← custom HTML/DOM goes HERE
//   map.append(marker); map.append(popover);
//
// positionAnchor glues the popover to the marker's world position and
// Google tracks it automatically — no manual lat/lng→pixel math. The
// React card is portaled into a host node that we .append() into the
// popover.
//
// WHY THE OLD VERSION FAILED: it appended a nested <div> to the marker
// itself and expected the marker to render arbitrary HTML children. A
// 3D marker doesn't host free HTML that way — the content has to live in
// a PopoverElement. The gate fired (selectedLead + centroid both set),
// the marker mounted, but nothing displayed. Fixed by using the popover.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cancelAutoPan } from "@/lib/cancelAutoPan";

interface PlotCardMarker3DProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  altitudeM?: number;
  children: ReactNode;
}

interface Marker3DLike extends HTMLElement {
  position?: { lat: number; lng: number; altitude?: number };
  altitudeMode?: string;
}
interface PopoverLike extends HTMLElement {
  open?: boolean;
  positionAnchor?: HTMLElement;
  altitudeMode?: string;
}
interface Maps3DLib {
  Marker3DInteractiveElement: new (opts?: Record<string, unknown>) => Marker3DLike;
  PopoverElement: new (opts?: Record<string, unknown>) => PopoverLike;
}

export default function PlotCardMarker3D({
  mapElRef,
  lat,
  lng,
  altitudeM = 0,
  children,
}: PlotCardMarker3DProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<Marker3DLike | null>(null);
  const popoverRef = useRef<PopoverLike | null>(null);
  const pinStopRef = useRef<(() => void) | null>(null);
  const stripObsRef = useRef<MutationObserver | null>(null);

  // Mount marker + popover once, via the maps3d library constructors.
  useEffect(() => {
    let cancelled = false;
    let marker: Marker3DLike | null = null;
    let popover: PopoverLike | null = null;

    async function mount() {
      const g = (window as unknown as {
        google?: { maps?: { importLibrary?: (n: string) => Promise<unknown> } };
      }).google;
      const mapEl = mapElRef.current;
      if (!g?.maps?.importLibrary || !mapEl) return;

      const lib = (await g.maps.importLibrary('maps3d')) as unknown as Maps3DLib;
      if (cancelled) return;
      if (!lib?.Marker3DInteractiveElement || !lib?.PopoverElement) {
        // eslint-disable-next-line no-console
        console.warn('[card-pin] maps3d Marker3DInteractiveElement / PopoverElement unavailable');
        return;
      }

      // Anchor marker at the parcel point. RELATIVE_TO_MESH snaps the
      // altitude to the BUILDING ROOF (the 3D tile mesh), not raw terrain
      // — so the card floats above the house instead of burying itself in
      // the ground or clipping through the mesh in suburban LOD areas like
      // Lemoore. A small positive altitude keeps it clear of the roof
      // across LOD swaps. (Confirmed RELATIVE_TO_MESH is a real maps3d
      // AltitudeMode, 2026-06-10.)
      marker = new lib.Marker3DInteractiveElement({
        altitudeMode: 'RELATIVE_TO_MESH',
        position: { lat, lng, altitude: altitudeM },
      });
      marker.setAttribute('plot-card-anchor', '');

      // Host node for the React portal — appended INTO the popover.
      const div = document.createElement('div');
      div.setAttribute('data-plot-card-host', '1');
      div.style.pointerEvents = 'auto';

      popover = new lib.PopoverElement({
        open: true,
        positionAnchor: marker,
      });
      popover.setAttribute('plot-card-popover', '');
      // Strip the default bubble chrome — we want ONLY our dark card, not
      // Google's white translucent bubble + tail. The popover exposes
      // CSS ::part hooks; we hit them from globals.css ([plot-card-popover]).
      // Also flatten the host element itself.
      popover.style.setProperty('background', 'transparent', 'important');
      popover.style.setProperty('border', 'none', 'important');
      popover.style.setProperty('box-shadow', 'none', 'important');
      popover.style.setProperty('padding', '0', 'important');
      popover.append(div);

      // Pin the camera RIGHT HERE — appending the popover is the exact
      // frame Google auto-pans to frame it (the page-level cancelAutoPan
      // on select already expired by now, since this mounts after the
      // async importLibrary + ring resolve). Without this the camera
      // JERKS to center the card. The camera belongs to the user.
      // [[feedback-no-zoom-to-ui-messes-up-flight]]
      const stopPin = cancelAutoPan(mapEl);

      mapEl.append(marker);
      mapEl.append(popover);
      pinStopRef.current = stopPin;

      markerRef.current = marker;
      popoverRef.current = popover;
      if (!cancelled) setHost(div);

      // Strip the bubble chrome. Google's PopoverElement renders a white
      // translucent bubble + tail in its OWN shadow DOM, which app CSS
      // can't reach. The robust fix (per the maps3d community) is to
      // inject a <style> INTO the popover's shadowRoot once it exists.
      // Google doesn't document the internal IDs/parts, so we hit the
      // common ones (#container/#content/#bubble) AND a wildcard, and
      // kill anything arrow/tail/pointer-ish. Retried a few frames since
      // the shadow content paints async after append.
      const STRIP_CSS = `
        :host, * {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          border: none !important;
          filter: none !important;
        }
        #container, #content, #bubble, .container, .content, .bubble {
          padding: 0 !important;
        }
        #arrow, #tail, #pointer, .arrow, .tail, .pointer,
        [class*="arrow"], [class*="tail"], [class*="pointer"] {
          display: none !important;
        }
      `;
      // Ensure our strip <style> is present in the shadow root. Returns
      // true once the shadow root exists.
      const injectStrip = (): boolean => {
        const sr = (popover as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (!sr) return false;
        if (!sr.querySelector('style[data-plot-strip]')) {
          const s = document.createElement('style');
          s.setAttribute('data-plot-strip', '1');
          s.textContent = STRIP_CSS;
          sr.appendChild(s);
        }
        return true;
      };

      // The shadow content paints async AND Google may re-render it (which
      // would wipe our <style>). A fixed retry loop loses that race on
      // slower parcels — that's why the bubble showed on some and not
      // others. Instead: poll briefly until the shadowRoot exists, then
      // attach a MutationObserver that re-asserts the strip whenever
      // Google mutates the shadow DOM. No fixed timeout to lose.
      const attachObserver = () => {
        const sr = (popover as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (!sr) return;
        injectStrip();
        const obs = new MutationObserver(() => { injectStrip(); });
        obs.observe(sr, { childList: true, subtree: true });
        stripObsRef.current = obs;
      };
      let tries = 0;
      const waitForShadow = () => {
        if (cancelled) return;
        if (injectStrip()) { attachObserver(); return; }
        tries += 1;
        if (tries < 40) window.setTimeout(waitForShadow, 50);  // up to 2s
      };
      waitForShadow();
    }

    void mount();

    return () => {
      cancelled = true;
      try { pinStopRef.current?.(); } catch { /* noop */ }
      pinStopRef.current = null;
      try { stripObsRef.current?.disconnect(); } catch { /* noop */ }
      stripObsRef.current = null;
      try { popover?.remove(); } catch { /* gone */ }
      try { marker?.remove(); } catch { /* gone */ }
      markerRef.current = null;
      popoverRef.current = null;
      setHost(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker anchored as the parcel point changes.
  useEffect(() => {
    const m = markerRef.current;
    if (!m) return;
    try { m.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
  }, [lat, lng, altitudeM]);

  if (!host) return null;
  return createPortal(children, host);
}
