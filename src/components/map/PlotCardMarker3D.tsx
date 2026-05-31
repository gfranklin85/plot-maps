"use client";

// PlotCardMarker3D — mounts a React HTML element as the content of a
// <gmp-marker> at a lat/lng/altitude inside <gmp-map-3d>, with a
// rooted-rise reveal animation.
//
// Locked 2026-05-30 evening per [[project-rooted-rise-card-no-visible-base]]:
// the card is permanently rooted in the property structure. On mount,
// it rises from behind the rooftop until just enough is exposed to
// read its content. On unmount, it lowers back. The bottom edge is
// NEVER visible.
//
// Implementation:
//   1. Create a <gmp-marker> as a child of gmp-map-3d at the rooftop
//      altitude. Google projects this point to a screen pixel each
//      frame as the camera moves.
//   2. Inside the marker, mount a clipping wrapper div. The wrapper's
//      HEIGHT animates from 0 to full on mount, full to 0 on dismiss.
//      overflow: hidden masks anything beyond its bounds.
//   3. Inside the wrapper, the React children sit BOTTOM-ALIGNED at
//      their full natural size. As the wrapper grows, more of the
//      children become visible from the TOP down.
//   4. Net effect: the card emerges from the rooftop pixel and its
//      bottom edge stays anchored there throughout the animation.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PlotCardMarker3DProps {
  /** Map element ref (gmp-map-3d host). */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Meters above ground for the rooftop anchor. The card emerges from
   *  this pixel. Default 8 (typical residential 2-story rooftop). */
  altitudeM?: number;
  /** Max visible height of the card in pixels once fully raised.
   *  Wrapper animates from 0 to this value. */
  maxHeightPx?: number;
  /** Animation duration for the rise (and reverse for retract). */
  riseDurationMs?: number;
  children: ReactNode;
}

const CANDIDATE_MARKER_TAGS = [
  'gmp-marker',
  'gmp-advanced-marker',
] as const;

export default function PlotCardMarker3D({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  maxHeightPx = 320,
  riseDurationMs = 600,
  children,
}: PlotCardMarker3DProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLElement | null>(null);
  // Wrapper div is the clipping element; we animate its height via
  // CSS transition by setting style.height directly.
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Mount the marker + clipping wrapper + host div as a child of gmp-map-3d.
  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdMarker: HTMLElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const winnerTag = CANDIDATE_MARKER_TAGS.find(
        (t) => !!window.customElements?.get?.(t)
      );
      if (!winnerTag) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `[PlotCardMarker3D] No candidate marker element registered: ${CANDIDATE_MARKER_TAGS.join(', ')}`
          );
        }
        return;
      }

      const marker = document.createElement(winnerTag) as HTMLElement & {
        position?: unknown;
      };
      let positionSetVia = 'attr';
      try {
        marker.position = { lat, lng, altitude: altitudeM };
        positionSetVia = 'prop-obj';
      } catch {
        try {
          marker.setAttribute('position', `${lat},${lng},${altitudeM}`);
          positionSetVia = 'attr';
        } catch { /* ignore */ }
      }
      marker.setAttribute('plot-card-billboard', '');

      // Clipping wrapper — the height of this element controls how
      // much of the card is exposed. overflow:hidden does the masking.
      // Width is fixed to the card's max width so the wrapper sizes
      // match its content; height grows from 0 to maxHeightPx via
      // CSS transition triggered by the data-risen attribute.
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-plot-card-wrapper', '1');
      wrapper.style.position = 'relative';
      wrapper.style.width = '300px';
      wrapper.style.height = '0px';
      wrapper.style.overflow = 'hidden';
      wrapper.style.transition = `height ${riseDurationMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      wrapper.style.pointerEvents = 'auto';
      // Translate so the wrapper's bottom is at the marker's pixel,
      // i.e. the marker pixel is the "ground line" the card emerges from.
      wrapper.style.transform = 'translateX(-50%)';

      // Host element — the React children get portaled here. The host
      // is positioned absolutely at the BOTTOM of the wrapper, so as
      // the wrapper grows taller, the card stays bottom-anchored and
      // its top emerges upward through the clip.
      const div = document.createElement('div');
      div.setAttribute('data-plot-card-host', '1');
      div.style.position = 'absolute';
      div.style.bottom = '0';
      div.style.left = '0';
      div.style.right = '0';

      wrapper.appendChild(div);
      marker.appendChild(wrapper);
      mapEl.appendChild(marker);

      createdMarker = marker;
      markerRef.current = marker;
      wrapperRef.current = wrapper;
      setHost(div);

      // eslint-disable-next-line no-console
      console.log(
        `[PlotCardMarker3D] mounted <${winnerTag}> position via ${positionSetVia} at lat=${lat} lng=${lng} alt=${altitudeM}m`
      );

      // Trigger the rise after the next frame so the browser commits
      // the initial height:0 before transitioning to height:maxHeightPx.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (wrapperRef.current) {
            wrapperRef.current.style.height = `${maxHeightPx}px`;
          }
        });
      });
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      // Retract the wrapper before removing the marker. We collapse
      // height back to 0, wait for the transition to finish, then
      // remove the marker. If the component unmounts faster than the
      // transition, the marker gets ripped out mid-retract — that's
      // OK; the user sees a snap close, which is acceptable for a
      // dismiss event but not for the open event.
      const wrapper = wrapperRef.current;
      const marker = createdMarker;
      if (wrapper && marker) {
        wrapper.style.height = '0px';
        window.setTimeout(() => {
          try { marker.remove(); } catch { /* already gone */ }
        }, riseDurationMs);
      } else if (marker) {
        try { marker.remove(); } catch { /* already gone */ }
      }
      markerRef.current = null;
      wrapperRef.current = null;
      setHost(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng/altitude change without remount.
  useEffect(() => {
    const m = markerRef.current as (HTMLElement & { position?: unknown }) | null;
    if (!m) return;
    try {
      m.position = { lat, lng, altitude: altitudeM };
    } catch {
      try {
        m.setAttribute('position', `${lat},${lng},${altitudeM}`);
      } catch { /* ignore */ }
    }
  }, [lat, lng, altitudeM]);

  if (!host) return null;
  return createPortal(children, host);
}
