# PlotMaps / Position

Storytelling company that moves people through real estate. "Plot" = land AND
narrative. Everything is delivered as a story, never as raw information — but we
never announce it's a story. Warmth sits ON TOP OF rigor (real, verbatim law).

---

## HARD RULES — these are not suggestions

### 1. Never sweep-stage in git
A parallel Claude chat is often working in this repo with its own uncommitted
WIP. Sweeping stages will commit someone else's half-finished work.

- **NEVER** `git add -A`, `git add .`, `git add -u`, `git commit -a`.
- Stage **only your own files, by path**: `git commit -o <path1> <path2> -m "..."`
- **Always** `git diff --cached` and read it before committing.
- For a shared file (e.g. `globals.css`), apply only your hunks — build a
  hunk-only patch and `git apply --cached`.

A PreToolUse hook (`.claude/hooks/guard-git.js`) blocks the sweeping forms. If
it fires, that is the rule working — stage by path instead.

### 2. Lint before you push
Vercel production builds fail on unused vars; local `tsc` and `next dev` do NOT
catch it. Run `next lint` before any push or the deploy silently breaks.

### 3. Greg authors ALL form and document CONTENT
Claude is the physical hands ONLY. Never write, invent, complete, or "improve"
form/legal/disclosure copy ahead of Greg. Go sentence-by-sentence, together.

- Building the UI/engine = fine.
- Authoring the content = never. If copy is missing, STOP and ask.

Voice when handling law: **describe, don't direct.** "The law treats X as
discrimination," NOT "you can't do X." Inform a peer, not a suspect.

### 4. The palette is law
Hand-made "Nightfall/Lagoon" blues, NEUTRAL-FORWARD.

- White + true black (`#000`) lead. Blues are **sparing accents**.
- Buttons are WHITE (solid) or WHITE-OUTLINE (ghost). White is never replaced by blue.
- **NO gradients.** Dark background is true black, not navy.
- Tokens live in `src/app/globals.css`. **NO per-component hex values, ever.**

### 5. Mobile-first
Base CSS = phone. Layer desktop with `min-width` queries. "Into people's hands,
not just their desks."

### 6. One viewport for single-purpose pages
Gates, heroes, and single-purpose pages fit `100svh` with no scroll. Compact the
content; don't spill it.

---

## Stack

- **Next.js 14** (App Router) · React 18 · Tailwind v3 (`tailwind.config.ts`)
- **Supabase**: PlotV3 — project ref `bjbwxjsiqtvkyllyfhrr`
- **Vercel** → auto-deploys `master` to plot.solutions
- **Email**: Resend · **Voice/SMS**: Twilio · **Maps**: Google Maps + Cesium

### Database posture
RLS is **ON** with **no policies**. Service-role API routes (`src/app/api/*`) are
the only gate. Do not add client-side table access; add a route instead.

### Env
`.env.local` is gitignored and never committed. Recreate on any machine with
`vercel env pull .env.local`.

---

## Repo hygiene

- Branch: `master` is the deploy branch — pushing deploys to production.
  For in-flight work, push a `wip/<thing>` branch instead; it's a free backup.
- `node_modules`, `.next` are rebuildable — never copy them between machines.

---

## Memory

The full law lives in the memory folder. Read `MEMORY.md` first — it indexes
everything (the thesis, the palette, the facts, the running task list). Don't
re-derive settled decisions; look them up.
