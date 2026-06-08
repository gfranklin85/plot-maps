"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveSession, type CompanionEvent, type CompanionState, type LiveSessionHandle } from "@/lib/gemini-live";
import OtanimusCharacter, { type Facing } from "./OtanimusCharacter";
import MaterialIcon from "@/components/ui/MaterialIcon";

// ── Map Companion Layer — Otanimus's "brain" on the map ──────────────
//
// Owns the Gemini Live session and translates its events into the
// character's behavior on screen:
//
//   • speaking  → turn TOWARD you, walk to center stage, lip-sync
//   • listening → turn AWAY, drift to a corner, read the map with you
//   • thinking  → face you, eyes pulse
//
// Also renders:
//   • a single summon button (bottom-right) to start/stop the companion
//   • a slim live caption of what he's saying (his subtitle)
//
// The connection isn't started until the user taps summon, because it
// needs mic + screen-share permission (and bills tokens). See
// [[project-otanimus-on-map-companion]].

export default function MapCompanionLayer() {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [state, setState] = useState<CompanionState>("idle");
  const [facing, setFacing] = useState<Facing>("away");
  const [x, setX] = useState(0.82);              // start: bottom-right corner
  const [caption, setCaption] = useState("");
  const sessionRef = useRef<LiveSessionHandle | null>(null);
  const captionTimer = useRef<number | null>(null);

  const onEvent = useCallback((e: CompanionEvent) => {
    switch (e.type) {
      case "state":
        if (e.state) {
          setState(e.state);
          if (e.state === "speaking") {
            setFacing("toward");
            setX(0.5);            // step to center stage to address you
          } else if (e.state === "listening") {
            setFacing("away");
            setX(0.82);           // back to the corner, reading the world
          } else if (e.state === "thinking") {
            setFacing("toward");
          }
        }
        break;
      case "modelTranscript":
        // Accumulate his subtitle; clear a beat after he stops.
        setCaption((c) => (c + " " + (e.text ?? "")).trim().slice(-220));
        if (captionTimer.current) clearTimeout(captionTimer.current);
        captionTimer.current = window.setTimeout(() => setCaption(""), 4000);
        break;
      case "close":
      case "error":
        if (e.type === "error") console.warn("[companion] error", e.error);
        break;
    }
  }, []);

  const summon = useCallback(async () => {
    if (active) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setActive(false);
      setState("idle");
      setCaption("");
      return;
    }
    setConnecting(true);
    try {
      const s = createLiveSession({ onEvent });
      sessionRef.current = s;
      await s.start();
      setActive(true);
    } catch (err) {
      console.error("[companion] failed to start", err);
      sessionRef.current?.stop();
      sessionRef.current = null;
    } finally {
      setConnecting(false);
    }
  }, [active, onEvent]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      if (captionTimer.current) clearTimeout(captionTimer.current);
    };
  }, []);

  return (
    <>
      {/* The character himself — only on screen once summoned. */}
      {active && <OtanimusCharacter state={state} facing={facing} x={x} />}

      {/* Live caption (his subtitle) — sits just above center-bottom,
          legible instantly, no entrance animation (in-flight UI rule). */}
      {active && caption && (
        <div className="pointer-events-none absolute bottom-[200px] left-1/2 z-40 w-[min(620px,80vw)] -translate-x-1/2 text-center">
          <span className="rounded-2xl bg-[#0D0E10]/70 px-4 py-2 text-[15px] font-medium leading-snug text-[#E3E2E5] shadow-lg backdrop-blur-md">
            {caption}
          </span>
        </div>
      )}

      {/* Summon / dismiss button — bottom-right, clear of Google's
          native controls. Mint when active. */}
      <button
        onClick={summon}
        disabled={connecting}
        title={active ? "Dismiss Otanimus" : "Summon Otanimus"}
        className={`absolute bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg backdrop-blur-md transition-all ${
          active
            ? "bg-[#00F2FF]/90 text-[#0D0E10]"
            : "bg-[#1F2022]/55 text-[#E3E2E5] hover:bg-[#1F2022]/75"
        } ${connecting ? "opacity-60" : ""}`}
      >
        <MaterialIcon
          icon={connecting ? "more_horiz" : active ? "graphic_eq" : "smart_toy"}
          className="text-[22px]"
        />
      </button>
    </>
  );
}
