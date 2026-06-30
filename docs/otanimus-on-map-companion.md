# Otanimus — On-Screen Flight Companion (Gemini Live)

Built 2026-06-06/07 overnight. First working pass at THE moat: a living
AI character present inside the map frame, watching the screen and
hearing you, talking back in real time.

## What it does (today)

Tap the **summon button** (bottom-right of `/map`, robot icon → mint when
live). On tap:

1. Browser asks our server for a **short-lived ephemeral token** (the
   real `GEMINI_API_KEY` never leaves the server).
2. Opens a **Gemini Live API** WebSocket session
   (`gemini-2.5-flash-native-audio-preview-12-2025`, audio response mode).
3. Asks for **mic** + **screen-share** permission, then streams:
   - your mic → PCM16 16kHz (Gemini hears you)
   - your screen → ~1 JPEG/sec (Gemini sees the live map)
4. Plays back Gemini's **streaming voice**, and drives the character:
   - **speaking** → Otanimus turns toward you, steps to center, lip-syncs
   - **listening** → turns away to a corner, reads the world with you
   - **thinking** → faces you, eyes pulse
5. Shows a slim **live caption** (his subtitle) above center-bottom.

## Files

| File | Role |
|---|---|
| `src/app/api/gemini/live-token/route.ts` | Mints ephemeral Live tokens (auth-gated). Keeps the API key server-side. |
| `src/lib/gemini-live.ts` | The Live client: connect, stream mic + screen, play audio, emit `CompanionEvent`s. Knows nothing about visuals. |
| `src/components/map/OtanimusCharacter.tsx` | The visual body (SVG placeholder + framer-motion). **Swappable seam** — replace internals with a Rive rig / three.js model later, keep the props. |
| `src/components/map/MapCompanionLayer.tsx` | The brain on the map: owns the session, maps events → character state/facing/walk, renders character + caption + summon button. |
| Mount | `src/app/map/page.tsx` — `{!walkMode && <MapCompanionLayer />}` |

## Verified

- `next build` passes (exit 0).
- All four new files typecheck + lint clean.
- Character renders correctly in all three states (away / toward / speaking)
  — see `.tmp-otanimus-render.png` in repo root.

## NOT done yet / next moves

- **Live flow untested end-to-end** — needs interactive mic + screen-share
  grants (couldn't grant them unattended). First real run: tap summon, allow
  both, talk to him. Watch console for `[companion]` / `[gemini/live-token]`.
- **Walk-across choreography** is currently just corner ↔ center on
  speak/listen. Idle wandering between spots not wired yet.
- **Real character art** — current body is a stylized SVG placeholder.
  Cathedral version = Rive rig or small three.js model with a true
  turn-around + lip-sync. The seam is ready (`OtanimusCharacter.tsx`).
- **Screen capture uses `getDisplayMedia`** (user picks the tab) because the
  map is a cross-origin `<gmp-map-3d>` WebGL element that can't be reliably
  read with html2canvas. Works, but asks for screen-share each session.
  Alternative later: capture the WebGL canvas directly if Google exposes it.
- **Ephemeral-token note:** if `GEMINI_API_KEY` is a new-format key (`AQ.*`),
  `authTokens.create` may reject it — current key is legacy `AIzaSy*`, fine.

## The bigger vision this serves (from Greg, 2026-06-06)

This is piece 6 of a `/map` rethink — see memory
`project_otanimus_on_map_companion`. Other pieces still open: chrome style,
dashboard-as-pause-overlay, warm/frontloaded arrival, Gemini video + image
generation in UI surfaces, and a survey intel sidebar.
