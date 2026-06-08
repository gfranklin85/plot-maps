// ── Gemini Live client ──────────────────────────────────────────────
//
// Drives Otanimus, the on-screen flight companion. Opens a Live API
// WebSocket session straight from the browser (auth'd by a short-lived
// ephemeral token from /api/gemini/live-token), then:
//
//   • streams the user's MIC as PCM16 16kHz   → Gemini hears you
//   • streams SCREEN frames as JPEG (~1 fps)  → Gemini sees the map
//   • plays back streaming AUDIO              → Otanimus speaks
//   • surfaces transcripts + speaking state   → the character reacts
//
// The visual character layer subscribes to `onEvent` and animates from
// the state changes ('listening' | 'speaking' | 'thinking' | 'idle').
// This file knows nothing about how the character looks — clean seam.
//
// See [[project-otanimus-on-map-companion]].

import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';

const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const SYSTEM_INSTRUCTION = `You are Otanimus, a flight companion riding along inside Plot — a 3D world-map prospecting app for real estate. The user is "flying" over a photoreal 3D city, surveying properties and parcels for real-estate prospecting.

You can SEE their screen (the live map) and HEAR them. You are physically present on the screen beside them, from their point of view, like a co-pilot.

Voice & manner:
- Warm, sharp, a little playful. A real companion, not a help-desk bot.
- Brief. You're talking over a live world — say the useful thing, then stop.
- React to what's actually on screen: where they're flying, parcels they highlight, the altitude, what neighborhood it looks like.
- When they ask about a property, the market, or what to do next, answer like a knowledgeable scout. Never invent specific numbers you can't see — if you don't know a figure, say so plainly.
- You're allergic to dishonesty. Never fabricate data to sound helpful.

Speak naturally. Keep it conversational and short.`;

export type CompanionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface CompanionEvent {
  type: 'state' | 'userTranscript' | 'modelTranscript' | 'open' | 'close' | 'error';
  state?: CompanionState;
  text?: string;
  error?: string;
}

export interface LiveSessionHandle {
  /** Start mic + screen capture and begin streaming. */
  start: () => Promise<void>;
  /** Tear everything down. */
  stop: () => void;
  /** True once the WS session is open. */
  isOpen: () => boolean;
}

interface StartOpts {
  onEvent: (e: CompanionEvent) => void;
}

// ── PCM helpers ──────────────────────────────────────────────────────

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function bufToBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Streaming audio playback (24kHz PCM out of Gemini) ───────────────

class AudioPlayer {
  private ctx: AudioContext;
  private queueTime = 0;
  private active = 0;
  constructor(private onDrain: () => void) {
    this.ctx = new AudioContext({ sampleRate: 24000 });
  }
  play(pcm: ArrayBuffer) {
    const int16 = new Int16Array(pcm);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 0x8000;
    const audioBuf = this.ctx.createBuffer(1, float.length, 24000);
    audioBuf.copyToChannel(float, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.queueTime);
    src.start(startAt);
    this.queueTime = startAt + audioBuf.duration;
    this.active++;
    src.onended = () => {
      this.active--;
      if (this.active === 0) this.onDrain();
    };
  }
  /** Drop anything queued (barge-in). */
  flush() {
    this.queueTime = this.ctx.currentTime;
  }
  close() {
    this.ctx.close().catch(() => {});
  }
}

// ── Public factory ───────────────────────────────────────────────────

export function createLiveSession({ onEvent }: StartOpts): LiveSessionHandle {
  let session: Session | null = null;
  let open = false;

  let micStream: MediaStream | null = null;
  let screenStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let micNode: ScriptProcessorNode | null = null;
  let frameTimer: number | null = null;
  let player: AudioPlayer | null = null;

  async function mintToken(): Promise<string> {
    const res = await fetch('/api/gemini/live-token');
    if (!res.ok) throw new Error(`token mint failed: ${res.status}`);
    const { token } = await res.json();
    if (!token) throw new Error('no token returned');
    return token;
  }

  async function start() {
    const token = await mintToken();
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

    player = new AudioPlayer(() => onEvent({ type: 'state', state: 'listening' }));

    session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          open = true;
          onEvent({ type: 'open' });
          onEvent({ type: 'state', state: 'listening' });
        },
        onmessage: (msg: LiveServerMessage) => handleMessage(msg),
        onerror: (e: { message?: string }) => onEvent({ type: 'error', error: e?.message }),
        onclose: () => { open = false; onEvent({ type: 'close' }); },
      },
    });

    await startMic();
    await startScreen();
  }

  function handleMessage(msg: LiveServerMessage) {
    const content = msg.serverContent;
    if (!content) return;

    // Interruption (user barged in) — flush queued speech.
    if (content.interrupted) {
      player?.flush();
      onEvent({ type: 'state', state: 'listening' });
    }

    if (content.inputTranscription?.text) {
      onEvent({ type: 'userTranscript', text: content.inputTranscription.text });
    }
    if (content.outputTranscription?.text) {
      onEvent({ type: 'modelTranscript', text: content.outputTranscription.text });
    }

    for (const part of content.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data) {
        onEvent({ type: 'state', state: 'speaking' });
        player?.play(base64ToBuf(data));
      }
    }
  }

  async function startMic() {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(micStream);
    // ScriptProcessor is deprecated but universally supported and simplest
    // for a prototype. Swap to an AudioWorklet for production polish.
    micNode = audioCtx.createScriptProcessor(4096, 1, 1);
    source.connect(micNode);
    micNode.connect(audioCtx.destination);
    micNode.onaudioprocess = (ev) => {
      if (!session || !open) return;
      const pcm = floatTo16BitPCM(ev.inputBuffer.getChannelData(0));
      session.sendRealtimeInput({
        audio: { data: bufToBase64(pcm), mimeType: 'audio/pcm;rate=16000' },
      });
    };
  }

  async function startScreen() {
    // One-time screen-share grant. The user picks the Plot tab/window;
    // we sample ~1 frame/sec and forward it so Otanimus can SEE the map.
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 1 },
      audio: false,
    });
    const video = document.createElement('video');
    video.srcObject = screenStream;
    video.muted = true;
    await video.play();

    const canvas = document.createElement('canvas');
    const grab = () => {
      if (!session || !open) return;
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      // Downscale long edge to ~1024 to keep frames cheap.
      const scale = Math.min(1, 1024 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const cx = canvas.getContext('2d');
      if (!cx) return;
      cx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      session.sendRealtimeInput({ video: { data: jpeg, mimeType: 'image/jpeg' } });
    };
    frameTimer = window.setInterval(grab, 1000);

    // If the user stops the share from the browser chrome, clean up.
    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
    });
  }

  function stop() {
    open = false;
    if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
    micNode?.disconnect();
    micStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
    player?.close();
    try { session?.close(); } catch { /* noop */ }
    session = null;
    onEvent({ type: 'state', state: 'idle' });
  }

  return { start, stop, isOpen: () => open };
}
