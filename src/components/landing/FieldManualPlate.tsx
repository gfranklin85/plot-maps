'use client';

// FieldManualPlate — Plot's surveying encyclopedia, Page I.
//
// Renders the landing's parchment composition: title cartouche, figure
// grid, hand-lettered captions, page number, ornamental rule lines.
// The brass-key figure is the entry affordance — click it to trigger
// the medium-shift transition to the 3D map.
//
// Until Greg ships hand-illustrated 2D figures (and later, 3D models),
// each figure slot renders a typographic "reserved" placeholder so the
// page reads as an intentional layout-in-progress rather than a broken
// experience. Assets drop in at `public/assets/landing/figures/2d/` and
// `public/assets/landing/figures/3d/`; the slot picks them up
// automatically — no code change required.
//
// See public/assets/landing/figures/README.md and
// memory/project_landing_page_field_manual.md for the full spec.

import { useState } from 'react';
import FigureSlot from './FigureSlot';
import EntrySequence from './EntrySequence';

// ── Figure catalog ────────────────────────────────────────────────
// Each entry is declared here once. To enable a real illustration,
// flip `has2D` to true and drop the file at
//   public/assets/landing/figures/2d/<key>.svg
// To enable the 2D→3D awakening, additionally drop the model at
//   public/assets/landing/figures/3d/<key>.glb
// and flip has3D to true.

interface FigureSpec {
  key: string;
  number: string;
  label: string;
  has2D: boolean;
  has3D: boolean;
  isEntryAffordance?: boolean;
  /** Column span override. Default 1 column wide. */
  colSpan?: number;
  /** Row span override. Default 1 row tall. */
  rowSpan?: number;
}

const FIGURES: FigureSpec[] = [
  { key: 'compass',        number: 'Fig. I',    label: 'Compass',         has2D: false, has3D: false },
  { key: 'transit',        number: 'Fig. II',   label: 'Transit',         has2D: false, has3D: false },
  { key: 'chain',          number: 'Fig. III',  label: 'Chain',           has2D: false, has3D: false },
  { key: 'level',          number: 'Fig. IV',   label: 'Air Level',       has2D: false, has3D: false },
  { key: 'quadrant',       number: 'Fig. V',    label: 'Quadrant',        has2D: false, has3D: false },
  { key: 'plat',           number: 'Fig. VI',   label: 'Plat of Survey',  has2D: false, has3D: false },
  { key: 'brass-key',      number: 'Fig. VII',  label: 'Master Key',      has2D: false, has3D: false, isEntryAffordance: true },
  { key: 'ledger',         number: 'Fig. VIII', label: 'Field Ledger',    has2D: false, has3D: false },
  { key: 'lantern',        number: 'Fig. IX',   label: 'Field Lantern',   has2D: false, has3D: false },
  { key: 'theodolite',     number: 'Fig. X',    label: 'Theodolite',      has2D: false, has3D: false },
  { key: 'plotmaps-mark',  number: 'Fig. XI',   label: 'Plotmaps Mark',   has2D: false, has3D: false },
  { key: 'parcels',        number: 'Fig. XII',  label: 'Surveyed Parcels',has2D: false, has3D: false },
];

export default function FieldManualPlate() {
  const [entering, setEntering] = useState(false);

  const handleEntry = () => {
    if (entering) return;
    setEntering(true);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface">
      {/* Parchment background.
          Uses the existing Plat Book cream palette as the base color.
          Subtle textured layer (a tiled noise via CSS gradient) gives
          the surface a paper grain until Greg's authentic scanned
          parchment background ships. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(244, 234, 213, 0) 0%, rgba(155, 146, 130, 0.08) 75%, rgba(74, 66, 54, 0.12) 100%), repeating-linear-gradient(45deg, rgba(155, 146, 130, 0.015) 0px, rgba(155, 146, 130, 0.015) 1px, transparent 1px, transparent 3px)',
          animation: 'plot-parchment-breathe 14s ease-in-out infinite',
        }}
      />

      {/* Parchment plate composition. Pulls back / fades out during
          the entry sequence so the bloom can take the frame. */}
      <div
        className={`relative z-10 mx-auto max-w-6xl px-6 sm:px-10 py-10 sm:py-14 transition-all`}
        style={
          entering
            ? {
                animation: 'plot-entry-parchment-exit 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }
            : undefined
        }
      >
        {/* ── Title cartouche ───────────────────────────────────────
            Hand-lettered title, Latin/period framing.
            Will become hand-drawn typography from Greg's Affinity
            work once delivered; for now uses the headline font with
            ornamental rule lines to read as deliberate typesetting. */}
        <header className="text-center mb-10 sm:mb-14 select-none">
          <div className="flex items-center justify-center gap-4 text-on-surface-variant/60">
            <span className="h-px flex-1 max-w-[80px] bg-current" aria-hidden />
            <span className="text-[10px] font-headline font-semibold tracking-[0.4em] uppercase">
              Tab. Plotmaps
            </span>
            <span className="h-px flex-1 max-w-[80px] bg-current" aria-hidden />
          </div>
          <h1 className="mt-3 font-headline text-3xl sm:text-5xl font-extrabold tracking-tight text-on-surface italic">
            A Modern Practitioner&apos;s Manual
          </h1>
          <p className="mt-2 text-[11px] sm:text-xs font-headline tracking-[0.18em] uppercase text-on-surface-variant/70 italic">
            Volume I &middot; Page I &middot; of the Surveyor&apos;s Instruments &amp; Methods
          </p>
          {/* Soft red-ink rule (the period convention for chapter rules) */}
          <div
            className="mx-auto mt-5 h-px max-w-[260px]"
            style={{ background: 'rgba(200, 85, 61, 0.55)' }}
            aria-hidden
          />
        </header>

        {/* ── Figure grid ───────────────────────────────────────────
            12 figures on the page, laid out in a 3-column grid on
            desktop and 2-column on tablet. Each slot renders its own
            content based on what assets are shipped. The brass-key
            entry is special-cased to fire the entry handler. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 sm:gap-x-10 sm:gap-y-14">
          {FIGURES.map((fig) => (
            <FigureSlot
              key={fig.key}
              figureKey={fig.key}
              number={fig.number}
              label={fig.label}
              has2D={fig.has2D}
              has3D={fig.has3D}
              isEntryAffordance={fig.isEntryAffordance}
              onClick={fig.isEntryAffordance ? handleEntry : undefined}
            />
          ))}
        </div>

        {/* ── Page foot (printer's mark, page number) ──────────────── */}
        <footer className="mt-14 sm:mt-20 text-center text-[10px] font-headline tracking-[0.3em] uppercase text-on-surface-variant/60 select-none">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px flex-1 max-w-[140px] bg-current/40" aria-hidden />
            <span>Engraved &amp; Set by Plot Solutions</span>
            <span className="h-px flex-1 max-w-[140px] bg-current/40" aria-hidden />
          </div>
          <p className="mt-3 italic text-[10px] text-on-surface-variant/50">
            Turn the key to enter the field.
          </p>
        </footer>
      </div>

      {/* Entry sequence — only mounts during the transition. */}
      {entering && <EntrySequence />}
    </div>
  );
}
