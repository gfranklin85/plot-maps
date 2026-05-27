// Ritual audio — frame-accurate impact sound scheduling.
//
// Greg locked 2026-05-27 (confirmation-ritual design):
//   - sound is MORE important than visual for confirmation ritual
//   - vocabulary: calibration lock / magnetic coupling / electrical
//     relay / instrument confirmation / optical synchronization
//   - NOT laser gun, NOT explosion, NOT arcade zap, NOT music notes
//   - MUST be scheduled via AudioContext.currentTime, NOT <audio> tag
//
// v1 uses synthesized placeholder transients (no asset file). Once
// timing is locked, Greg sources a real recording / synth patch and
// we swap the impact() implementation. The schedule() API stays.

type ScheduledImpact = {
  /** Cancel a scheduled impact before it plays. */
  cancel: () => void;
};

let ctx: AudioContext | null = null;
let unlocked = false;

// Lazy-instantiate the AudioContext. Browsers require a user gesture
// before AudioContext.state goes from 'suspended' to 'running'; we
// hook the first click anywhere on the document and resume.
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch (err) {
      console.warn('[ritualAudio] AudioContext construction failed', err);
      return null;
    }
  }
  if (!unlocked && ctx.state === 'suspended') {
    const unlock = () => {
      ctx?.resume().catch(() => { /* ignore */ });
      unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }
  return ctx;
}

// Eager-prime the audio context on first import in the browser so the
// first ritual fire isn't gated on the suspended→running transition.
if (typeof window !== 'undefined') {
  getCtx();
}

/**
 * Schedule an impact sound to play at `delayMs` from now.
 *
 * Plays a synthesized two-layer transient:
 *  - A short metallic "click" at ~1.8kHz (the calibration-lock head)
 *  - A short low-frequency "thump" at ~80Hz (the magnetic-coupling body)
 *
 * Both decay within ~300ms. Together they read as "connection
 *  established" / "instrument confirmation" rather than "laser
 *  weapon." Placeholder until real audio asset is sourced.
 *
 * @param delayMs ms from now when the impact peak should hit. Pair
 *   this with the tether's totalMs so sound + visual + illumination
 *   peak on the same frame.
 */
export function scheduleImpact(delayMs: number): ScheduledImpact {
  const c = getCtx();
  if (!c) return { cancel: () => { /* noop */ } };
  if (c.state === 'suspended') {
    // First-fire before unlock gesture — try to resume, but if the
    // browser blocks it, skip silently.
    c.resume().catch(() => { /* ignore */ });
  }
  const startAt = c.currentTime + Math.max(0, delayMs / 1000);

  // High-frequency click — the "calibration lock head."
  const click = c.createOscillator();
  const clickGain = c.createGain();
  click.type = 'triangle';
  click.frequency.setValueAtTime(1850, startAt);
  click.frequency.exponentialRampToValueAtTime(900, startAt + 0.05);
  clickGain.gain.setValueAtTime(0.0001, startAt);
  clickGain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.005);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
  click.connect(clickGain);

  // Low-frequency thump — the "magnetic-coupling body."
  const thump = c.createOscillator();
  const thumpGain = c.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(120, startAt);
  thump.frequency.exponentialRampToValueAtTime(55, startAt + 0.12);
  thumpGain.gain.setValueAtTime(0.0001, startAt);
  thumpGain.gain.exponentialRampToValueAtTime(0.30, startAt + 0.012);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.32);
  thump.connect(thumpGain);

  // Mild lowpass to take the harshness off the click.
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4200, startAt);

  // Master gain at modest level — restrained, not punchy.
  const master = c.createGain();
  master.gain.value = 0.6;

  clickGain.connect(filter);
  thumpGain.connect(filter);
  filter.connect(master);
  master.connect(c.destination);

  click.start(startAt);
  click.stop(startAt + 0.20);
  thump.start(startAt);
  thump.stop(startAt + 0.36);

  return {
    cancel: () => {
      try { click.stop(); } catch { /* already stopped */ }
      try { thump.stop(); } catch { /* already stopped */ }
    },
  };
}

/**
 * Probe whether audio is available + unlocked. Useful for diagnostics
 * but the ritual works either way (silent if blocked, sounds if not).
 */
export function isAudioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}
