'use client';

import { motion } from 'framer-motion';

/**
 * Plot Maps signature ambient backdrop.
 *
 * Renders the blueprint-grid SVG as a full-bleed background with a slow,
 * continuous drift — like surveyor's drafting paper sliding under the work.
 * Layers a soft cream-to-transparent vignette on top so the grid fades at
 * the edges and doesn't compete with foreground content.
 *
 * Use as a positioned ancestor inside any hero / section that should feel
 * like it's sitting on top of an engineered surface.
 *
 *   <section className="relative">
 *     <BlueprintGridBackdrop />
 *     ...your content...
 *   </section>
 */
export default function BlueprintGridBackdrop({
  opacity = 0.07,
  driftSeconds = 60,
}: {
  opacity?: number;
  driftSeconds?: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/textures/blueprint-grid.svg)',
          backgroundSize: '80px 80px',
          backgroundRepeat: 'repeat',
          opacity,
        }}
        animate={{ backgroundPositionX: ['0px', '80px'], backgroundPositionY: ['0px', '80px'] }}
        transition={{ duration: driftSeconds, repeat: Infinity, ease: 'linear' }}
      />
      {/* Radial vignette: cream-to-transparent so the grid fades out near content edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgb(var(--color-background) / 0.85) 95%)',
        }}
      />
    </div>
  );
}
