'use client';

// ShotProjectile — the fire visual. Replaces the old flash-only
// ShotAnimation with a real, fast PROJECTILE that travels from a
// launch origin at the bottom of the screen to the reticle point and
// impacts there.
//
// Greg's framing 2026-06-06: "press A, and it immediately fire a shot
// from the bottom of the screen a little left of center like its
// mounted on the left side, and it fires to the reticle point. Or
// another mechanism, is that gun they fire across replenishing ships
// to get the transfer line — shot out the bottom, simulate a little
// wave slightly above the reticle and falling to the reticle point and
// hitting it. Long as our projectile hits the reticle point, that is
// the aim."
//
// Two selectable mechanisms:
//   - 'mounted'  : fires from bottom, slightly LEFT of center, in a
//                  straight line to the reticle. A mounted gun.
//   - 'highline' : fires from bottom center, ARCS up to slightly above
//                  the reticle, then falls down onto it. The line-
//                  throwing replenishment gun ships use to pass a
//                  transfer line between vessels.
//
// Whichever mechanism, the projectile LANDS EXACTLY on the reticle
// point. On impact it flashes and fires onImpact() — the page uses that
// to burst the property card out above the reticle.
//
// Screen-space only. No 3D, no Google projection. A <canvas> overlay
// in reticle-pixel space, driven by rAF. Self-prunes after the fade.

import { useEffect, useRef } from 'react';
import type { ShotChannel } from '@/lib/shotSounds';

export type ShotMechanism = 'mounted' | 'highline';

export interface Shot {
  id: number;
  channel: ShotChannel;
  /** Reticle position at fire time, as viewport fractions. */
  xFraction: number;
  yFraction: number;
  /** Which firing mechanism this shot uses. */
  mechanism: ShotMechanism;
}

interface Props {
  shot: Shot | null;
  /** Fired the frame the projectile reaches the reticle. The page gates
   *  the card-burst on a valid target; the projectile fires regardless. */
  onImpact?: (shot: Shot) => void;
}

// Channel tints — carried over from ShotAnimation. Distinct enough that
// a glance tells the user which channel just fired.
const CHANNEL_COLOR: Record<ShotChannel, string> = {
  text_invite: '#3b82f6', // blue — text
  direct_mail: '#f59e0b', // amber — mail
  phone_call: '#10b981',  // emerald — call
};

// ── Timing ──────────────────────────────────────────────────────────
// "Really fast." Travel is sub-200ms; the impact flash is a short tail.
const TRAVEL_MS = 170;       // launch → reticle
const FLASH_MS = 220;        // impact flash + ring after landing
const TOTAL_MS = TRAVEL_MS + FLASH_MS;
// Head-start so the tracer is already extended on frame 1 (no perceived
// input-to-display lag) — same trick the old FireBeam used.
const HEAD_START = 0.12;

// Highline arc apex: how many px ABOVE the reticle the lob peaks. The
// projectile rises past the reticle by this much, then falls onto it.
const ARC_APEX_PX = 90;

// quadratic Bézier point: (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
function qbez(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

export default function ShotProjectile({ shot, onImpact }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onImpactRef = useRef(onImpact);
  onImpactRef.current = onImpact;

  useEffect(() => {
    if (!shot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    // Non-null aliases so the rAF closure below doesn't re-narrow these
    // to nullable (TS can't prove the guards hold across the callback).
    const ctx = c;
    const activeShot = shot;

    let rafId = 0;
    let cancelled = false;
    let impacted = false;

    // Size the canvas backing store to the device pixels for crisp lines.
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const color = CHANNEL_COLOR[activeShot.channel];

    // Target = reticle pixel.
    const tx = activeShot.xFraction * vw;
    const ty = activeShot.yFraction * vh;

    // Launch origin at the bottom of the screen.
    const ox = activeShot.mechanism === 'mounted' ? vw * 0.42 : vw * 0.5;
    const oy = vh + 8; // just off the bottom edge

    // Highline control point: above the reticle so the lob peaks there
    // then falls onto the target. Horizontally biased toward the launch
    // so the rise reads as coming off the bottom.
    const cx = (ox + tx) / 2;
    const cy = ty - ARC_APEX_PX;

    const start = performance.now() - HEAD_START * TRAVEL_MS;

    function posAt(t: number): { x: number; y: number } {
      if (activeShot.mechanism === 'highline') {
        return { x: qbez(ox, cx, tx, t), y: qbez(oy, cy, ty, t) };
      }
      // mounted: straight lerp
      return { x: ox + (tx - ox) * t, y: oy + (ty - oy) * t };
    }

    function draw(now: number) {
      if (cancelled) return;
      const elapsed = now - start;
      ctx.clearRect(0, 0, vw, vh);

      if (elapsed < TRAVEL_MS) {
        // Travel phase. ease-out so it decelerates into the target.
        const lin = elapsed / TRAVEL_MS;
        const t = 1 - Math.pow(1 - lin, 2);
        const head = posAt(t);
        // Tracer: a short bright segment trailing the head along the
        // path, not the whole flight — reads as a fast round, not a
        // drawn line. ~14% of the path behind the head.
        const tailT = Math.max(0, t - 0.14);
        const tail = posAt(tailT);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        // outer glow stroke
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        // bright inner core
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        // glow head
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        rafId = requestAnimationFrame(draw);
        return;
      }

      // Landed — fire impact once.
      if (!impacted) {
        impacted = true;
        try { onImpactRef.current?.(activeShot); } catch { /* noop */ }
      }

      const flashElapsed = elapsed - TRAVEL_MS;
      if (flashElapsed < FLASH_MS) {
        const f = flashElapsed / FLASH_MS; // 0..1
        // Impact flash: bright core fading out.
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.globalAlpha = (1 - f) * 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tx, ty, 8 + f * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = (1 - f) * 0.95;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
        // Expanding shock ring.
        ctx.globalAlpha = 1 - f;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 8 + f * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        rafId = requestAnimationFrame(draw);
        return;
      }

      // Done — clear and stop. Parent clears `shot` state separately.
      ctx.clearRect(0, 0, vw, vh);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, vw, vh);
    };
    // Re-run for each distinct shot. shot.id changes per fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.id]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ width: '100%', height: '100%', zIndex: 40 }}
    />
  );
}

export { TOTAL_MS as SHOT_TOTAL_MS, TRAVEL_MS as SHOT_TRAVEL_MS };
