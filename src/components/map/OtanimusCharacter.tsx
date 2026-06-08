"use client";

import { motion } from "framer-motion";
import type { CompanionState } from "@/lib/gemini-live";

// ── Otanimus — the on-screen flight companion (visual layer) ─────────
//
// THE moat: a living character physically present inside the map frame,
// from the user's POV. He stands at the bottom edge with his back to
// you, reading the world alongside you; turns around to face you when
// he speaks; walks across the screen between idle spots. See
// [[project-otanimus-on-map-companion]] and [[project-otanimus]].
//
// This is the PLACEHOLDER body — a stylized hooded scout rendered in
// SVG so it has real silhouette, facing, and a speaking pulse without
// any asset pipeline. It is deliberately a single self-contained
// component: when the cathedral version lands (Rive rig or a small
// three.js model with a turn-around animation + lip-sync), swap THIS
// file's internals and keep the same props. Nothing else changes.
//
// Props are pure presentation. All "intelligence" (when to turn, when
// to speak) is decided by MapCompanionLayer from Live API events and
// passed down as `state` + `facing`.

export type Facing = "away" | "toward";

interface Props {
  state: CompanionState;          // idle | listening | thinking | speaking
  facing: Facing;                 // away (reading map) | toward (talking to you)
  /** 0..1 horizontal position across the screen for walk choreography. */
  x: number;
  /** Pixel height of the character. */
  size?: number;
}

// Plot palette.
const MINT = "#00F2FF";
const MINT_DEEP = "#00DBE7";
const CLOAK = "#16171A";
const CLOAK_HI = "#26282C";
const SKIN = "#1F2330";

export default function OtanimusCharacter({ state, facing, x, size = 180 }: Props) {
  const w = size * 0.62;
  const speaking = state === "speaking";
  const thinking = state === "thinking";

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
          width: w * 0.7,
          height: 12,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0))",
          filter: "blur(2px)",
        }}
        animate={{ scaleX: speaking ? 1.05 : 1 }}
      />

      {/* Body — flips horizontally to suggest turning toward / away.
          A real rig will replace this with a proper turn animation. */}
      <motion.div
        className="absolute inset-0"
        animate={{
          rotateY: facing === "toward" ? 0 : 180,
          y: [0, -3, 0], // idle bob
        }}
        transition={{
          rotateY: { type: "spring", stiffness: 120, damping: 16 },
          y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <CharacterSVG facing={facing} speaking={speaking} thinking={thinking} />
      </motion.div>

      {/* Speaking aura — soft mint bloom that breathes while talking. */}
      {speaking && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: size * 0.45,
            width: w * 1.4,
            height: w * 1.4,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${MINT}33, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}

function CharacterSVG({
  facing,
  speaking,
  thinking,
}: {
  facing: Facing;
  speaking: boolean;
  thinking: boolean;
}) {
  const toward = facing === "toward";
  return (
    <svg
      viewBox="0 0 100 160"
      width="100%"
      height="100%"
      style={{ display: "block", filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.5))" }}
    >
      <defs>
        <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CLOAK_HI} />
          <stop offset="1" stopColor={CLOAK} />
        </linearGradient>
        <radialGradient id="hood" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor={SKIN} />
          <stop offset="1" stopColor="#0C0D10" />
        </radialGradient>
      </defs>

      {/* Cloak / body — tapered scout silhouette. */}
      <path
        d="M50 38
           C 32 38, 24 60, 22 92
           C 20 120, 26 150, 50 150
           C 74 150, 80 120, 78 92
           C 76 60, 68 38, 50 38 Z"
        fill="url(#cloak)"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
      />

      {/* Mint edge-light running down one side — Plot signature rim. */}
      <path
        d={
          toward
            ? "M30 50 C 24 78, 24 118, 34 146"
            : "M70 50 C 76 78, 76 118, 66 146"
        }
        fill="none"
        stroke={MINT_DEEP}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Head / hood. */}
      <ellipse cx="50" cy="32" rx="20" ry="22" fill="url(#hood)" />
      {/* Hood opening rim. */}
      <ellipse
        cx="50"
        cy="32"
        rx="20"
        ry="22"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1.5"
      />

      {/* Face — only visible when turned TOWARD you. Two mint eyes +
          a speaking mouth. When AWAY, the hood is just a dark void. */}
      {toward && (
        <>
          <motion.circle
            cx="42"
            cy="30"
            r="3.2"
            fill={MINT}
            animate={{ opacity: thinking ? [1, 0.3, 1] : 1 }}
            transition={{ duration: 0.9, repeat: thinking ? Infinity : 0 }}
          />
          <motion.circle
            cx="58"
            cy="30"
            r="3.2"
            fill={MINT}
            animate={{ opacity: thinking ? [1, 0.3, 1] : 1 }}
            transition={{ duration: 0.9, repeat: thinking ? Infinity : 0, delay: 0.15 }}
          />
          {/* Mouth — animates open/closed while speaking. */}
          <motion.ellipse
            cx="50"
            cy="42"
            rx="4"
            fill={MINT}
            opacity={0.85}
            animate={{ ry: speaking ? [1, 4, 1.5, 3.5, 1] : 0.8 }}
            transition={{
              duration: 0.42,
              repeat: speaking ? Infinity : 0,
              ease: "easeInOut",
            }}
          />
        </>
      )}

      {/* When turned away: a faint mint glow leaks from the hood edges,
          so you still feel him "lit" by the screen he's reading. */}
      {!toward && (
        <motion.ellipse
          cx="50"
          cy="34"
          rx="14"
          ry="10"
          fill={MINT}
          opacity={0.12}
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
