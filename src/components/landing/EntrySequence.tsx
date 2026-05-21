'use client';

// EntrySequence — the transition from the parchment landing page into
// the photoreal 3D map.
//
// Triggered when the user clicks the brass-key figure on the field
// manual. Plays a short cinematic that handles the medium shift from
// 2D illustrated to 3D photoreal:
//
//   t=0       — key rotates 90° clockwise (turning in a lock)
//   t=350ms   — bloom layer fades in
//   t=600ms   — parchment plate scales + lifts + fades out
//   t=1200ms  — navigate to /map?from=landing
//
// The /map route detects the `?from=landing` query and plays its own
// emergence side of the transition (camera reveals from the bloom,
// location-prompt drift-card arrives shortly after).
//
// This component renders absolutely on top of the landing page during
// the sequence. It manages its own lifecycle; the page just mounts it
// when the click fires and lets it complete.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Called when the sequence finishes (just before navigation, so the
   *  parent can do cleanup if desired). */
  onComplete?: () => void;
}

const TOTAL_DURATION_MS = 1200;

export default function EntrySequence({ onComplete }: Props) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      onComplete?.();
      router.push('/map?from=landing');
    }, TOTAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [router, onComplete]);

  return (
    <>
      {/* Light bloom that fills the frame as the parchment exits. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(255, 240, 215, 0.95) 0%, rgba(245, 220, 188, 0.7) 35%, rgba(200, 85, 61, 0.0) 75%)',
          opacity: 0,
          animation: 'plot-entry-bloom 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          animationDelay: '350ms',
        }}
      />
    </>
  );
}
