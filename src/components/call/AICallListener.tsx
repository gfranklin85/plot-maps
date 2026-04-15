"use client";

import { useEffect, useRef, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

interface Props {
  aiCallId: string;
  monitorListenUrl: string | null;
  firstMessage: string;
  onClose: () => void;
}

interface StatusResponse {
  id: string;
  status: string;
  duration_seconds: number;
  transcript: { raw?: string } | string | null;
  summary?: string | null;
  outcome?: string | null;
  ended_reason?: string | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AICallListener({ aiCallId, monitorListenUrl, firstMessage, onClose }: Props) {
  const [status, setStatus] = useState<string>("initiating");
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Wire up live audio stream ──
  useEffect(() => {
    if (!monitorListenUrl) return;
    // VAPI's monitor listen URL is a WebSocket that streams raw audio.
    // For now we simply open it; in production, a proper PCM→Web Audio
    // pipeline is required. This at least establishes the connection and
    // lets the agent SEE it's live even if audio doesn't immediately play.
    try {
      const ws = new WebSocket(monitorListenUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      // Audio playback via Web Audio API
      const AudioCtx = typeof window !== "undefined" && 'AudioContext' in window
        ? window.AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });

      ws.onmessage = async (event) => {
        if (muted) return;
        if (!(event.data instanceof ArrayBuffer)) return;
        try {
          // VAPI streams 16-bit PCM @ 16kHz mono. We decode manually.
          const pcm = new Int16Array(event.data);
          const float = new Float32Array(pcm.length);
          for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;
          const buffer = audioCtx.createBuffer(1, float.length, 16000);
          buffer.copyToChannel(float, 0);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start();
        } catch { /* ignore decode errors */ }
      };
      ws.onerror = () => {
        setError("Audio stream unavailable");
      };
      return () => {
        ws.close();
        audioCtx.close().catch(() => {});
      };
    } catch {
      setError("Could not connect to audio stream");
    }
  }, [monitorListenUrl, muted]);

  // ── Poll /api/ai-call/status for transcript + duration ──
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/ai-call/status?id=${aiCallId}`);
        if (!res.ok) return;
        const data: StatusResponse = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        setDuration(data.duration_seconds || 0);
        if (typeof data.transcript === "string") {
          setTranscript(data.transcript);
        } else if (data.transcript && typeof data.transcript === "object" && "raw" in data.transcript) {
          setTranscript(data.transcript.raw || "");
        }
      } catch { /* silent */ }
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [aiCallId]);

  async function sendControl(action: "hangup" | "takeover", payload?: Record<string, unknown>) {
    setActionInFlight(action);
    try {
      const res = await fetch(`/api/ai-call/${aiCallId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || data.error || "Action failed");
    } catch {
      setError("Network error");
    }
    setActionInFlight(null);
  }

  const isEnded = status === "ended" || status === "failed";
  const statusLabel = (() => {
    switch (status) {
      case "initiating": return "Dialing...";
      case "ringing": return "Ringing";
      case "in-call": return "In conversation";
      case "ended": return "Call ended";
      case "failed": return "Call failed";
      default: return status;
    }
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface/80 backdrop-blur-md" />
      <div className="relative w-full max-w-2xl bg-card rounded-2xl border border-violet-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-violet-500/20 rounded-full blur-[80px]" />

        <audio ref={audioRef} autoPlay className="hidden" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-card-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <MaterialIcon icon="smart_toy" className="text-[24px] text-violet-400" />
              </div>
              {status === "in-call" && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
                {statusLabel}
              </p>
              <p className="font-headline text-lg font-extrabold text-on-surface">
                {formatDuration(duration)}
              </p>
            </div>
          </div>
          <button onClick={() => setMuted(!muted)} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors" title={muted ? "Unmute" : "Mute"}>
            <MaterialIcon icon={muted ? "volume_off" : "volume_up"} className="text-[22px]" />
          </button>
        </div>

        {/* Transcript */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-[300px]">
          {/* First message always shows at top */}
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
              AI opened with
            </p>
            <p className="text-sm text-on-surface leading-relaxed">&ldquo;{firstMessage}&rdquo;</p>
          </div>

          {transcript ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Live transcript
              </p>
              <pre className="text-xs text-on-surface font-sans whitespace-pre-wrap leading-relaxed">
                {transcript}
              </pre>
            </div>
          ) : !isEnded ? (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant/60 italic">
              <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              Waiting for conversation...
            </div>
          ) : null}

          {error && (
            <div className="rounded-lg bg-orange-500/10 p-3 text-xs text-orange-400">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="relative z-10 border-t border-card-border p-4 flex items-center gap-2 shrink-0">
          {!isEnded ? (
            <>
              <button
                onClick={() => sendControl("takeover")}
                disabled={actionInFlight !== null}
                className="flex-1 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <MaterialIcon icon="mic" className="text-[18px]" />
                {actionInFlight === "takeover" ? "Bridging..." : "Jump In"}
              </button>
              <button
                onClick={() => sendControl("hangup")}
                disabled={actionInFlight !== null}
                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <MaterialIcon icon="call_end" className="text-[18px]" />
                {actionInFlight === "hangup" ? "Ending..." : "Hang Up"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            >
              <MaterialIcon icon="check" className="text-[18px]" />
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
