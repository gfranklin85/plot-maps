'use client';

// ── flyLink ───────────────────────────────────────────────────────────
//
// The transport for the phone-as-controller link, RECEIVER (big-screen)
// side. Establishes the lowest-latency link available, in this order:
//
//   1. WebRTC data channel (P2P) — near-zero latency. Same-Wi-Fi feels
//      basically wired. This is "a hardware connection when possible".
//   2. Supabase Realtime broadcast — always-works fallback when P2P is
//      blocked (locked-down NAT). Slightly more latency; never just fails.
//
// Supabase Realtime is ALSO the signaling channel: the WebRTC SDP/ICE
// handshake is exchanged as broadcast messages on the pair-code channel.
// So the same channel bootstraps P2P and serves as the fallback path.
//
// The pair code (e.g. "AB12") names the channel: `fly:AB12`. The phone
// joins the same code. PadFrames arriving by EITHER path are handed to
// onFrame (which the page wires to applyPadFrame from flyPadBridge).

import { supabase } from './supabase';
import type { PadFrame } from './flyPadBridge';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type LinkState =
  | 'idle'
  | 'waiting'      // channel joined, showing code, no phone yet
  | 'signaling'    // phone arrived, negotiating WebRTC
  | 'p2p'          // connected via WebRTC data channel (best)
  | 'relay'        // connected via Supabase broadcast (fallback)
  | 'closed';

export interface FlyLinkHandlers {
  onFrame: (f: PadFrame) => void;
  onState: (s: LinkState) => void;
}

// Public STUN for NAT traversal. (TURN fallback can be added later for the
// minority of networks where P2P can't punch through — then it degrades to
// the Supabase relay path anyway, so it never hard-fails.)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Generate a short, unambiguous pair code (no 0/O/1/I confusion). */
export function makePairCode(seed: number): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n = Math.floor(seed) >>> 0;
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[n % ALPHABET.length];
    n = Math.floor(n / ALPHABET.length) + 7919; // mix
  }
  return out;
}

export class FlyLinkReceiver {
  private code: string;
  private handlers: FlyLinkHandlers;
  private channel: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private state: LinkState = 'idle';
  private closed = false;

  constructor(code: string, handlers: FlyLinkHandlers) {
    this.code = code;
    this.handlers = handlers;
  }

  private setState(s: LinkState) {
    if (this.state === s) return;
    this.state = s;
    this.handlers.onState(s);
  }

  /** Join the pair-code channel and wait for the phone. */
  async start(): Promise<void> {
    const channel = supabase.channel(`fly:${this.code}`, {
      config: { broadcast: { ack: false } },
    });
    this.channel = channel;

    // Phone announces itself → we create the WebRTC offer.
    channel.on('broadcast', { event: 'phone-hello' }, () => {
      this.beginWebRTC().catch(() => this.setState('relay'));
    });

    // WebRTC answer from the phone.
    channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
      this.pc
        ?.setRemoteDescription(new RTCSessionDescription(payload))
        .catch(() => {});
    });

    // ICE candidates from the phone.
    channel.on('broadcast', { event: 'ice-phone' }, ({ payload }) => {
      this.pc?.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
    });

    // FALLBACK path: phone sends input frames over Supabase broadcast when
    // P2P never came up. We accept them too (whichever path delivers wins).
    channel.on('broadcast', { event: 'pad' }, ({ payload }) => {
      if (this.state !== 'p2p') {
        if (this.state !== 'relay') this.setState('relay');
        this.handlers.onFrame(payload as PadFrame);
      }
    });

    await channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') this.setState('waiting');
    });
  }

  private async beginWebRTC(): Promise<void> {
    if (this.closed) return;
    this.setState('signaling');

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    // Receiver creates the data channel; phone listens for it.
    const dc = pc.createDataChannel('pad', { ordered: false, maxRetransmits: 0 });
    this.dc = dc;
    dc.onopen = () => this.setState('p2p');
    dc.onclose = () => {
      if (!this.closed && this.state === 'p2p') this.setState('relay');
    };
    dc.onmessage = (e) => {
      try {
        this.handlers.onFrame(JSON.parse(e.data) as PadFrame);
      } catch {
        /* ignore malformed */
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.channel?.send({
          type: 'broadcast',
          event: 'ice-screen',
          payload: e.candidate.toJSON(),
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.channel?.send({
      type: 'broadcast',
      event: 'offer',
      payload: offer,
    });
  }

  close(): void {
    this.closed = true;
    try { this.dc?.close(); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    if (this.channel) supabase.removeChannel(this.channel);
    this.dc = null;
    this.pc = null;
    this.channel = null;
    this.setState('closed');
  }
}
