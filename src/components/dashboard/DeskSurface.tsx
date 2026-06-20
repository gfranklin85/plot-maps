'use client';

// ── DeskSurface ───────────────────────────────────────────────────────
//
// The back-out reality the flying map collapses into — a dark ROOM with a
// restrained light and a polished floor that catches it. Built on the
// light/shadow principle (memory/project_light_shadow_depth_principle):
// the light is the MOTIVATION, not the subject — it recedes so the content
// (the hero map-screen + the desk objects) and their cast shadows are what
// read. No heavy grain (that was the "Nintendo" look); just a whisper of
// dither to kill banding.
//
// Layers, back-to-front:
//   1. room — the deep base
//   2. back wall — soft light pooling upper-center, falling to shadow
//   3. wall/floor seam — faint cyan glow where the light catches the edge
//   4. floor — polished plane catching a soft vertical reflection of the
//      light, fading as it recedes toward the viewer
//   5. edge vignette — deepens the corners, focuses the room
//
// v1 = static. The light breathing / shadow sweep comes in iteration #2
// (Rive). Colors are the locked --plot-* tokens.

export default function DeskSurface() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1 — room base. Slightly translucent so the PAUSED WORLD behind
            the desk (the frozen map) glows faintly through — selling the
            "you backed out, the world is still there" pause-screen feel. */}
      <div className="absolute inset-0" style={{ background: 'rgba(7,11,20,0.82)' }} />

      {/* 2 — back wall: light pools upper-center, falls into shadow.
            The wall occupies the top ~62%, floor the bottom. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '62%',
          background:
            'radial-gradient(90% 130% at 50% 8%,' +
            ' rgba(120,150,210,0.16) 0%,' +
            ' rgba(60,90,150,0.06) 34%,' +
            ' rgba(7,11,20,0) 64%),' +
            ' linear-gradient(180deg, #0c1322 0%, #0a0f1c 70%, #080d18 100%)',
        }}
      />

      {/* 3 — wall/floor seam: a faint cyan glow line where light catches
            the edge (the screen-cast color). */}
      <div
        className="absolute inset-x-0"
        style={{
          top: '62%',
          height: '2px',
          transform: 'translateY(-1px)',
          background:
            'linear-gradient(90deg, transparent, rgba(26,178,217,0.0) 18%, rgba(26,178,217,0.35) 50%, rgba(26,178,217,0.0) 82%, transparent)',
          filter: 'blur(0.5px)',
        }}
      />

      {/* 4 — floor: polished plane, catches a soft vertical reflection of
            the light, fading as it recedes toward the viewer (bottom). */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: '62%',
          background:
            // the reflection streak (cool, centered, fading down)
            'radial-gradient(60% 120% at 50% 0%, rgba(90,130,200,0.10) 0%, rgba(26,178,217,0.05) 22%, transparent 60%),' +
            // the floor plane itself, darkening toward the viewer
            ' linear-gradient(180deg, #0a1020 0%, #080d18 40%, #060a12 100%)',
        }}
      />

      {/* 5 — edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(135% 120% at 50% 42%, transparent 52%, rgba(2,5,12,0.78) 100%)',
        }}
      />

      {/* whisper of dither to prevent 8-bit banding on the gradients —
          imperceptible, NOT the old heavy grain. */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
