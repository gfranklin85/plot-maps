"use client";

import { motion } from "framer-motion";
import type { CompanionState } from "@/lib/gemini-live";

// ── Otanimus — the on-screen flight companion (visual layer) ─────────
//
// THE moat: a living character physically present inside the map frame,
// from the user's POV. He stands at the bottom edge with his back to
// you, reading the world alongside you; turns around to face you when
// he speaks; walks across the screen between idle spots.
// See [[project-otanimus-on-map-companion]] and [[project-otanimus]].
//
// OT is a bush-pilot LION — bomber jacket, aviator goggles. The art is
// a set of hand-generated pose PNGs (transparent) under
// public/assets/otanimus/, one per state. This component picks the pose
// for the current state and animates position / bob / speaking bloom
// around it. Props are pure presentation; all "intelligence" (when to
// turn, when to speak) is decided by MapCompanionLayer from Live API
// events. Clean seam: swap the pose art or move to a Rive rig later
// without touching MapCompanionLayer.

export type Facing = "away" | "toward";

interface Props {
  state: CompanionState;          // idle | listening | thinking | speaking
  facing: Facing;                 // away (reading map) | toward (talking to you)
  /** 0..1 horizontal position across the screen for walk choreography. */
  x: number;
  /** Pixel height of the character. */
  size?: number;
}

const MINT = "#00F2FF";

// State → pose art. `listening` is the back-turned "reading the map"
// pose, so it inherently reads as facing AWAY; the others face you.
const POSE: Record<CompanionState, string> = {
  idle: "/assets/otanimus/idle.png",
  listening: "/assets/otanimus/listening.png",
  thinking: "/assets/otanimus/thinking.png",
  speaking: "/assets/otanimus/speaking.png",
};

// Native aspect ratios of the trimmed pose PNGs (w/h), so each pose
// keeps its proportions when we size by height. Roughly tied to the
// crops produced by remove_bg.py.
const POSE_AR: Record<CompanionState, number> = {
  idle: 432 / 687,
  listening: 457 / 685,
  thinking: 433 / 687,
  speaking: 543 / 687,
};

export default function OtanimusCharacter({ state, facing, x, size = 200 }: Props) {
  const ar = POSE_AR[state] ?? 0.64;
  const w = size * ar;
  const speaking = state === "speaking";
  const pose = POSE[state] ?? POSE.idle;

  return (
    <motion.div
      // Walk: animate horizontal position. Bottom-anchored so he stands
      // on the world's "floor" at the screen edge.
      className="pointer-events-none absolute bottom-0 z-40 select-none"
      style={{ width: w, height: size }}
      animate={{ left: `calc(${x * 100}% - ${w / 2}px)` }}
      transition={{ type: "spring", stiffness: 40, damping: 14 }}
    >
      {/* Ground contact shadow — sells "standing on the floor". */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: -2,
          width: w * 0.66,
          height: 12,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.45), rgba(0,0,0,0))",
          filter: "blur(2px)",
        }}
        animate={{ scaleX: speaking ? 1.05 : 1 }}
      />

      {/* Speaking aura — soft mint bloom behind him while talking. */}
      {speaking && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: size * 0.35,
            width: w * 1.5,
            height: w * 1.5,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${MINT}2e, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.16, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* The lion himself. Cross-fade between poses on state change, with
          an idle bob + a subtle "talk" bounce while speaking so the
          static art feels alive. */}
      <motion.img
        key={state}
        src={pose}
        alt="Otanimus"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))" }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          y: speaking ? [0, -4, 0] : [0, -3, 0],
        }}
        transition={{
          opacity: { duration: 0.18 },
          y: {
            duration: speaking ? 0.5 : 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      />

      {/* `facing` is accepted for API compatibility with the old SVG rig
          but the pose art encodes direction (listening = back-turned),
          so we don't flip here — flipping a detailed illustration would
          mirror the jacket/name-tag wrong. Reading the prop keeps the
          seam stable if we later add left/right walk-facing variants. */}
      <span hidden>{facing}</span>
    </motion.div>
  );
}
