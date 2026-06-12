"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveSession, type CompanionEvent, type CompanionState, type LiveSessionHandle } from "@/lib/gemini-live";
import { type Facing } from "./OtanimusCharacter";
import OtanimusRive from "./OtanimusRive";

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
  const [level, setLevel] = useState(0);          // 0..1 voice loudness → mouthOpen
  const [look, setLook] = useState({ x: 0, y: 0 }); // autonomous gaze target
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
      case "amplitude":
        // Live voice loudness → drives OT's mouth open/closed.
        setLevel(e.level ?? 0);
        break;
      case "close":
      case "error":
        if (e.type === "error") console.warn("[companion] error", e.error);
        break;
    }
  }, []);

  // Surface OT's live-session state for the PerfHUD. The Gemini session
  // (mic PCM + 1fps screen-grab/JPEG + WS audio) is the big variable cost
  // on the map; the perf overlay reads this flag.
  const setGeminiPerfFlag = (on: boolean) => {
    const w = window as unknown as { __plotPerf?: { geminiActive?: boolean } };
    w.__plotPerf = { ...(w.__plotPerf ?? {}), geminiActive: on };
  };

  const summon = useCallback(async () => {
    if (active) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setActive(false);
      setState("idle");
      setCaption("");
      setLevel(0);
      setGeminiPerfFlag(false);
      return;
    }
    // Show OT FIRST, then start the session (which triggers the mic +
    // screen-share permission prompts). Greg 2026-06-12: the prompts used
    // to fire before OT was even visible — a cold dialog from nowhere.
    // Now the lion arrives on screen, then asks, so the permission request
    // reads as HIM wanting to see/hear, not the OS interrupting.
    setActive(true);
    setState("thinking");
    setConnecting(true);
    // Brief beat so the arrival registers before the browser dialog.
    await new Promise((r) => setTimeout(r, 450));
    try {
      const s = createLiveSession({ onEvent });
      sessionRef.current = s;
      await s.start();
      setGeminiPerfFlag(true);
    } catch (err) {
      console.error("[companion] failed to start", err);
      sessionRef.current?.stop();
      sessionRef.current = null;
      setActive(false);
      setState("idle");
    } finally {
      setConnecting(false);
    }
  }, [active, onEvent]);

  // Controller summon: the X button (and any other caller) dispatches
  // 'plot:summon-ot' on window; we toggle the companion. Kept in a ref-
  // free closure by depending on `summon`, which already closes over the
  // latest `active`.
  useEffect(() => {
    const onSummon = () => { void summon(); };
    window.addEventListener('plot:summon-ot', onSummon);
    return () => window.removeEventListener('plot:summon-ot', onSummon);
  }, [summon]);

  // Autonomous gaze — his "aware and doing something" tic. While not
  // speaking, his eyes wander the world on their own every couple
  // seconds; while speaking he looks toward you (center, slightly up).
  // This is unprovoked life, independent of the conversation.
  useEffect(() => {
    if (!active) return;
    let timer: number;
    const wander = () => {
      if (state === "speaking") {
        setLook({ x: 0, y: -0.15 });          // address you
      } else {
        // glance somewhere in the world — biased toward where he'd be
        // reading the map (down and around).
        setLook({
          x: (Math.random() * 2 - 1) * 0.7,
          y: Math.random() * 0.5,             // 0..0.5, tends to look down at the map
        });
      }
      timer = window.setTimeout(wander, 1400 + Math.random() * 2200);
    };
    wander();
    return () => clearTimeout(timer);
  }, [active, state]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      if (captionTimer.current) clearTimeout(captionTimer.current);
      const w = window as unknown as { __plotPerf?: { geminiActive?: boolean } };
      if (w.__plotPerf) w.__plotPerf.geminiActive = false;
    };
  }, []);

  return (
    <>
      {/* The character himself — only on screen once summoned. Rive rig
          when otanimus.riv is present, PNG fallback until then. */}
      {active && (
        <OtanimusRive
          state={state}
          facing={facing}
          x={x}
          level={level}
          lookX={look.x}
          lookY={look.y}
        />
      )}

      {/* Live caption (his subtitle) — sits just above center-bottom,
          legible instantly, no entrance animation (in-flight UI rule). */}
      {active && caption && (
        <div className="pointer-events-none absolute bottom-[200px] left-1/2 z-40 w-[min(620px,80vw)] -translate-x-1/2 text-center">
          <span className="rounded-2xl bg-[#0D0E10]/70 px-4 py-2 text-[15px] font-medium leading-snug text-[#E3E2E5] shadow-lg backdrop-blur-md">
            {caption}
          </span>
        </div>
      )}

      {/* Summon / dismiss OT — bottom-LEFT, genuinely clear of Google's
          bottom-right compass/zoom controls. Gradient depth, labeled "OT"
          so it reads as the lion co-pilot, not a mystery robot icon.
          Greg 2026-06-12: the old flat bottom-right button covered Google's
          controls and was "the cheapest excuse for a button ever." */}
      <button
        onClick={summon}
        disabled={connecting}
        title={active ? "Dismiss OT" : "Call OT — your flight co-pilot"}
        className="group absolute bottom-6 left-6 z-50 flex h-14 items-center gap-2.5 rounded-2xl pl-2.5 pr-4 text-[14px] font-bold text-white backdrop-blur-md transition-transform hover:scale-[1.04] active:scale-95"
        style={{
          background: active
            ? 'linear-gradient(160deg, #00e0c8, #008fb0)'
            : 'linear-gradient(160deg, rgba(58,68,92,0.94), rgba(20,27,44,0.94))',
          boxShadow: '0 10px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          opacity: connecting ? 0.7 : 1,
        }}
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          {connecting ? '…' : '🦁'}
        </span>
        <span>{connecting ? 'Waking OT' : active ? 'OT is here' : 'Call OT'}</span>
      </button>
    </>
  );
}
