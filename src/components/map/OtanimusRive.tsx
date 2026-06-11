"use client";

import { useEffect } from "react";
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
} from "@rive-app/react-canvas";
import type { CompanionState } from "@/lib/gemini-live";
import type { Facing } from "./OtanimusCharacter";
import OtanimusCharacter from "./OtanimusCharacter";

// ── Otanimus — Rive talking-head driver ──────────────────────────────
//
// The cathedral body. Replaces the static-PNG OtanimusCharacter behind
// the SAME seam (state / facing / x / size) plus `level` for the mouth.
// All "intelligence" still lives in MapCompanionLayer; this just maps
// props → Rive state-machine inputs.
//
// THE CONTRACT — the rig in public/assets/otanimus/otanimus.riv must
// expose a state machine named `OT` with these inputs. Build the rig to
// this and it slots in with zero code change:
//
//   mouthOpen   Number  0..100   jaw openness — driven by voice loudness
//   lookX       Number -100..100 eye/head horizontal aim
//   lookY       Number -100..100 eye/head vertical aim
//   browRaise   Number  0..100   eyebrow lift (emphasis / surprise)
//   emotion     Number  0..4     0 neutral 1 happy 2 curious 3 focused 4 surprised
//   talking     Boolean          true while speaking
//   listening   Boolean          true while hearing the user
//   blink       Trigger          fire on a natural cadence
//   earTwitch   Trigger          lion aliveness tick
//
// Until that .riv exists, we fall back to the PNG OtanimusCharacter so
// the whole companion keeps working — nothing is blocked on the art.

const STATE_MACHINE = "OT";
const RIV_SRC = "/assets/otanimus/otanimus.riv";

// emotion enum, matched to the contract above.
const EMOTION: Record<CompanionState, number> = {
  idle: 0,        // neutral
  listening: 2,   // curious — attentive to you
  thinking: 3,    // focused
  speaking: 1,    // happy/engaged while addressing you
};

interface Props {
  state: CompanionState;
  facing: Facing;
  x: number;
  size?: number;
  /** 0..1 voice loudness for mouthOpen. */
  level?: number;
  /** Autonomous gaze target, -1..1 each axis (room/screen aware). */
  lookX?: number;
  lookY?: number;
}

export default function OtanimusRive({
  state,
  facing,
  x,
  size = 200,
  level = 0,
  lookX = 0,
  lookY = 0,
}: Props) {
  const { rive, RiveComponent } = useRive({
    src: RIV_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
    // If the .riv is missing/unparseable, rive stays null and we render
    // the PNG fallback below.
    onLoadError: () => {
      if (process.env.NODE_ENV !== "production") {
        console.info("[otanimus] otanimus.riv not found — using PNG fallback");
      }
    },
  });

  const mouthOpen = useStateMachineInput(rive, STATE_MACHINE, "mouthOpen");
  const lookXIn = useStateMachineInput(rive, STATE_MACHINE, "lookX");
  const lookYIn = useStateMachineInput(rive, STATE_MACHINE, "lookY");
  const emotionIn = useStateMachineInput(rive, STATE_MACHINE, "emotion");
  const talkingIn = useStateMachineInput(rive, STATE_MACHINE, "talking");
  const listeningIn = useStateMachineInput(rive, STATE_MACHINE, "listening");
  const blinkIn = useStateMachineInput(rive, STATE_MACHINE, "blink");
  const earTwitchIn = useStateMachineInput(rive, STATE_MACHINE, "earTwitch");

  // mouthOpen ← live voice loudness (0..1 → 0..100).
  useEffect(() => {
    if (mouthOpen) mouthOpen.value = Math.round(level * 100);
  }, [level, mouthOpen]);

  // gaze ← autonomous look target (-1..1 → -100..100).
  useEffect(() => {
    if (lookXIn) lookXIn.value = Math.max(-100, Math.min(100, lookX * 100));
    if (lookYIn) lookYIn.value = Math.max(-100, Math.min(100, lookY * 100));
  }, [lookX, lookY, lookXIn, lookYIn]);

  // emotion + booleans ← companion state.
  useEffect(() => {
    if (emotionIn) emotionIn.value = EMOTION[state] ?? 0;
    if (talkingIn) talkingIn.value = state === "speaking";
    if (listeningIn) listeningIn.value = state === "listening";
  }, [state, emotionIn, talkingIn, listeningIn]);

  // Autonomous blink — every 3–6s, independent of conversation.
  useEffect(() => {
    if (!blinkIn) return;
    let timer: number;
    const schedule = () => {
      const next = 3000 + Math.random() * 3000;
      timer = window.setTimeout(() => {
        blinkIn.fire();
        schedule();
      }, next);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [blinkIn]);

  // Autonomous ear-twitch — lion tick, every 5–11s.
  useEffect(() => {
    if (!earTwitchIn) return;
    let timer: number;
    const schedule = () => {
      const next = 5000 + Math.random() * 6000;
      timer = window.setTimeout(() => {
        earTwitchIn.fire();
        schedule();
      }, next);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [earTwitchIn]);

  // Fallback: rig not loaded → keep the PNG companion working.
  if (!rive) {
    return <OtanimusCharacter state={state} facing={facing} x={x} size={size} />;
  }

  const w = size * 0.8;
  return (
    <div
      className="pointer-events-none absolute bottom-0 z-40 select-none"
      style={{
        width: w,
        height: size,
        left: `calc(${x * 100}% - ${w / 2}px)`,
        transition: "left 0.6s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
