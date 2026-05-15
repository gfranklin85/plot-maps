'use client';

// Shot sounds for the airplane-mode shoot action. Three short cues
// (text / mail / call), each ~150ms. The helper tries to play a real
// audio file from /public/sounds first; if the file is missing or the
// browser blocks <audio>, it falls back to a Web Audio synth so the
// game-feel works out of the box with zero asset dependencies. Drop
// designer-crafted mp3s into /public/sounds/shot-{channel}.mp3 anytime;
// the fallback retires automatically.

export type ShotChannel = 'text_invite' | 'direct_mail' | 'phone_call';

// File paths the helper will probe for. We try-load on first use and
// cache the result so we don't hammer the network. A 404 just falls
// back to synthesis silently — no console spam.
const FILE_PATHS: Record<ShotChannel, string> = {
  text_invite: '/sounds/shot-text.mp3',
  direct_mail: '/sounds/shot-mail.mp3',
  phone_call: '/sounds/shot-call.mp3',
};

// Cached HTMLAudioElement per channel, loaded lazily. Null = not yet
// probed; HTMLAudioElement = loaded & playable; false = probed and
// missing (use synth instead).
const cache: Record<ShotChannel, HTMLAudioElement | false | null> = {
  text_invite: null,
  direct_mail: null,
  phone_call: null,
};

let audioCtxRef: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtxRef) return audioCtxRef;
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtxRef = new Ctor();
  } catch {
    return null;
  }
  return audioCtxRef;
}

// ── Synth fallbacks. Each cue is its own envelope shape so the three
//    channels are clearly distinct even without real assets. ──────────

function synthText(ctx: AudioContext) {
  // Soft beep: two stacked sine partials with a quick decay.
  const t = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.setValueAtTime(880, t);   // A5
  osc2.frequency.setValueAtTime(1320, t);  // E6
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.22, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 0.18);
  osc2.stop(t + 0.18);
}

function synthMail(ctx: AudioContext) {
  // Cardboard slap: filtered noise burst with a fast attack.
  const t = ctx.currentTime;
  const duration = 0.18;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Decaying white noise — the noise IS the slap; the envelope shapes it.
    const env = Math.pow(1 - i / bufferSize, 2);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, t);
  filter.Q.setValueAtTime(2, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + duration);
}

function synthCall(ctx: AudioContext) {
  // Two-tone chirp: short up-sweep then a clean peak. Reads as "ring."
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.linearRampToValueAtTime(1100, t + 0.08);
  osc.frequency.setValueAtTime(1100, t + 0.09);
  osc.frequency.linearRampToValueAtTime(1320, t + 0.13);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.26, t + 0.015);
  gain.gain.linearRampToValueAtTime(0.26, t + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.24);
}

function playSynth(channel: ShotChannel) {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Browsers suspend AudioContexts created before a user gesture; resume
  // on first play so subsequent calls don't silently no-op.
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  switch (channel) {
    case 'text_invite': synthText(ctx); return;
    case 'direct_mail': synthMail(ctx); return;
    case 'phone_call':  synthCall(ctx); return;
  }
}

function probeFile(channel: ShotChannel): Promise<HTMLAudioElement | false> {
  return new Promise(resolve => {
    if (typeof Audio === 'undefined') {
      resolve(false);
      return;
    }
    const audio = new Audio(FILE_PATHS[channel]);
    audio.preload = 'auto';
    audio.volume = 0.55;
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onOk);
      audio.removeEventListener('error', onErr);
    };
    const onOk = () => { cleanup(); resolve(audio); };
    const onErr = () => { cleanup(); resolve(false); };
    audio.addEventListener('canplaythrough', onOk, { once: true });
    audio.addEventListener('error', onErr, { once: true });
    // Trigger the load.
    audio.load();
  });
}

/**
 * Fire the shot sound for the given channel. Prefers a real audio file
 * at /public/sounds/shot-{channel}.mp3 if present; falls back to Web
 * Audio synthesis so the gameplay feel works without any assets.
 * Safe to call from event handlers — never throws.
 */
export function playShotSound(channel: ShotChannel): void {
  if (typeof window === 'undefined') return;
  const cached = cache[channel];
  if (cached === false) {
    playSynth(channel);
    return;
  }
  if (cached) {
    // We have a working file — clone-play so rapid presses don't cut
    // each other off.
    const node = cached.cloneNode(true) as HTMLAudioElement;
    node.volume = cached.volume;
    void node.play().catch(() => playSynth(channel));
    return;
  }
  // First call for this channel — probe the file, decide once.
  void probeFile(channel).then(result => {
    cache[channel] = result;
    if (result) {
      const node = result.cloneNode(true) as HTMLAudioElement;
      node.volume = result.volume;
      void node.play().catch(() => playSynth(channel));
    } else {
      playSynth(channel);
    }
  });
  // Don't make the user wait for the probe — synth immediately on the
  // first call too. Subsequent calls use the cached decision. (Briefly
  // double-playing on the very first shot is a minor cost for "the
  // gun fires the instant you press the button.")
  playSynth(channel);
}
