// ── PlotMark — the PlotMaps glyph ─────────────────────────────────────
//
// The brand mark distilled: a pin whose head FLOATS free of its point,
// standing on a plot. Circle over triangle over ellipse. Everything in the
// PlotMaps world floats — the pin's head too: a want hovers until the move
// lands. Replaces stock icons (hub, place, …) anywhere the brand speaks.
// memory: project_pin_grammar (the "balloon" variant is the mark).
//
// Inherits color from CSS `currentColor`; pass `size` in px.

export default function PlotMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* the plot */}
      <ellipse cx="12" cy="19.4" rx="7.2" ry="2.9" fillOpacity="0.35" />
      {/* the point — apex down, floating just above the plot */}
      <polygon points="9.5,10.8 14.5,10.8 12,16.2" />
      {/* the head — floats free above the point */}
      <circle cx="12" cy="6.4" r="3.7" />
    </svg>
  );
}
