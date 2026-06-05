"use client";

// PlotWorldPopover — anchors HTML content to a WORLD coordinate using
// Google's native gmp-popover (PopoverElement), so Google's OWN internal
// projection keeps it locked to the point as the camera flies.
//
// WHY THIS EXISTS (the long road, 2026-05-31): Map3DElement exposes NO
// world-to-screen projection method (confirmed in Google's docs). Earlier
// attempts (gmp-marker → screen corner; hand-rolled projection → drift)
// failed because they reproduced Google's projection. gmp-popover is
// Google's built-in widget for exactly this: give it a LatLngAltitude and
// it stays anchored using the SAME projection that places our glb box.
// Card + box share one projection → locked together, zero drift.
// https://developers.google.com/maps/documentation/javascript/3d/popovers
//
// SIZE: gmp-popover renders content at FIXED pixel size (no auto-shrink).
// We do NOT auto-scale from camera range — tilting the camera changed
// range and resized the card unpredictably. Greg's call 2026-05-31: the
// USER owns card size via the CARD SIZE slider in the top BuyerSettings
// panel. We read settings.cardScale and apply it as a CSS transform.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBuyerSettings } from "@/lib/buyer-settings/context";

interface Props {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Altitude (m) of the anchor — match the box's risen altitude so the
   *  card sits on/at the box. */
  altitudeM?: number;
  children: ReactNode;
}

interface PopoverElement extends HTMLElement {
  positionAnchor?: unknown;
  open?: boolean;
  altitudeMode?: string;
  lightDismissDisabled?: boolean;
}

interface Map3DCam extends HTMLElement {
  center?: { lat: number; lng: number; altitude?: number };
  heading?: number;
  tilt?: number;
  range?: number;
}

// gmp-popover auto-pans the camera to bring itself into view on open, and
// the documented disable-pan-while-open attribute is NOT honored by the JS
// web component. We defeat it by snapshotting the camera and HOLDING it
// pinned — restoring every frame — until the USER provides real input
// (pointer / wheel / key / gamepad), which is the true "release the
// camera" signal. The earlier fixed 8-frame guard was too short: the
// auto-pan tween (and re-frames as the monument rises) outlast it. The
// user's camera is sacred (feedback-no-zoom-to-ui).
function cancelAutoPan(mapEl: Map3DCam): () => void {
  const snap = {
    center: mapEl.center ? { ...mapEl.center } : null,
    heading: mapEl.heading,
    tilt: mapEl.tilt,
    range: mapEl.range,
  };
  if (!snap.center) return () => {};

  let rafId = 0;
  let released = false;
  const MAX_MS = 2000; // absolute safety cap so we never pin forever
  const start = performance.now();

  const release = () => {
    if (released) return;
    released = true;
    window.removeEventListener("pointerdown", release, true);
    window.removeEventListener("wheel", release, true);
    window.removeEventListener("keydown", release, true);
    window.removeEventListener("gamepadconnected", release, true);
  };
  // Any genuine user input ends the pin immediately so we never fight
  // a user who starts flying while a card is open.
  window.addEventListener("pointerdown", release, true);
  window.addEventListener("wheel", release, true);
  window.addEventListener("keydown", release, true);

  const tick = () => {
    if (released || performance.now() - start > MAX_MS) { rafId = 0; return; }
    try {
      if (snap.center) mapEl.center = snap.center;
      if (typeof snap.heading === "number") mapEl.heading = snap.heading;
      if (typeof snap.tilt === "number") mapEl.tilt = snap.tilt;
      if (typeof snap.range === "number") mapEl.range = snap.range;
    } catch { /* noop */ }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => { release(); if (rafId) cancelAnimationFrame(rafId); };
}

const POPOVER_TAG = "gmp-popover";

export default function PlotWorldPopover({
  mapElRef,
  lat,
  lng,
  altitudeM = 20,
  children,
}: Props) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const popoverRef = useRef<PopoverElement | null>(null);
  const stopPinRef = useRef<(() => void) | null>(null);
  const { settings } = useBuyerSettings();
  const cardScale = settings.cardScale ?? 0.7;

  // Mount the popover once (poll for map + custom-element registry).
  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    let created: PopoverElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      const def = window.customElements?.get?.(POPOVER_TAG);
      if (!mapEl || !def) {
        if (attempt < 50) retryId = window.setTimeout(tryMount, 100);
        else console.warn("[PlotWorldPopover] gmp-popover not registered after retries");
        return;
      }

      const pop = document.createElement(POPOVER_TAG) as PopoverElement;
      const anchor = { lat, lng, altitude: altitudeM };
      try { pop.altitudeMode = "RELATIVE_TO_GROUND"; } catch { /* noop */ }
      try { pop.positionAnchor = anchor; } catch {
        try { (pop as HTMLElement).setAttribute("position-anchor", `${lat},${lng},${altitudeM}`); } catch { /* noop */ }
      }
      try { pop.lightDismissDisabled = true; } catch { /* noop */ }
      try { pop.setAttribute("disable-pan-while-open", ""); } catch { /* noop */ }
      try { pop.setAttribute("plot-card-popover", ""); } catch { /* noop */ }
      // Capture the camera, THEN open. The open triggers Google's
      // auto-pan; cancelAutoPan restores the user's camera over the next
      // few frames so the flight is never yanked. (disable-pan-while-open
      // is not honored by the JS web component — this is the real fix.)
      const stopPin = cancelAutoPan(mapEl as Map3DCam);
      try { pop.open = true; } catch { /* noop */ }
      stopPinRef.current = stopPin;
      // Host-element-level chrome reset (::part rules in globals.css cover
      // the shadow parts; this covers the host element itself).
      try {
        pop.style.background = "transparent";
        pop.style.border = "none";
        pop.style.boxShadow = "none";
        pop.style.padding = "0";
        pop.style.setProperty("--gmp-popover-background", "transparent");
      } catch { /* noop */ }

      const div = document.createElement("div");
      div.setAttribute("data-plot-world-popover-host", "1");
      div.style.transformOrigin = "bottom center";
      div.style.willChange = "transform";
      pop.appendChild(div);

      mapEl.appendChild(pop);
      created = pop;
      popoverRef.current = pop;
      setHost(div);
    };

    tryMount();
    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (stopPinRef.current) { stopPinRef.current(); stopPinRef.current = null; }
      if (created) { try { created.remove(); } catch { /* gone */ } }
      popoverRef.current = null;
      setHost(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-anchor when the target coordinate changes (new parcel).
  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const anchor = { lat, lng, altitude: altitudeM };
    try { pop.positionAnchor = anchor; } catch {
      try { pop.setAttribute("position-anchor", `${lat},${lng},${altitudeM}`); } catch { /* noop */ }
    }
  }, [lat, lng, altitudeM]);

  // Apply the user-chosen card size (from the top panel slider). The
  // camera never resizes the card; the user owns its size.
  useEffect(() => {
    if (host) host.style.transform = `scale(${cardScale})`;
  }, [host, cardScale]);

  if (!host) return null;
  return createPortal(children, host);
}
