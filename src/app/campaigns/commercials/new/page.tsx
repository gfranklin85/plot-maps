"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { VOICE_CATALOG, type Voice } from "@/lib/voice-catalog";

const SCRIPT_PLACEHOLDERS = [
  "Hey neighbor, this is Sam with Plot Realty. A house just sold two doors down at 755 Castellina for top dollar — curious what yours is worth today?",
  "Quick update from a local agent: three homes sold on your street this month. Press 1 to hear the prices, or press 2 to chat.",
];

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estSeconds(text: string): number {
  return Math.ceil(wordCount(text) / 2.5);
}

export default function NewCommercialPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [script, setScript] = useState(SCRIPT_PLACEHOLDERS[0]);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICE_CATALOG[0]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [samplePlayingId, setSamplePlayingId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }
  }, [previewUrl]);

  // Invalidate stale preview when the user edits script or swaps voice.
  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, selectedVoice.id]);

  const wc = wordCount(script);
  const secs = estSeconds(script);
  const lengthValid = wc >= 15 && wc <= 55 && secs <= 22;
  const lengthHint =
    wc < 15 ? `Needs ${15 - wc} more words` :
    wc > 55 ? `${wc - 55} words too long — aim for 30-45` :
    secs > 22 ? `Trim to stay under 20 seconds` :
    "Looks good";
  const lengthColor = lengthValid ? "text-emerald-400" : wc > 0 ? "text-amber-400" : "text-on-surface-variant";

  async function playSample(voice: Voice) {
    if (samplePlayingId === voice.id && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
      setSamplePlayingId(null);
      return;
    }

    setSamplePlayingId(voice.id);
    try {
      const res = await fetch("/api/commercials/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: voice.sampleText, voiceId: voice.id, skipLengthCheck: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Sample failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (sampleAudioRef.current) sampleAudioRef.current.pause();
      const audio = new Audio(url);
      sampleAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setSamplePlayingId(null); };
      audio.onerror = () => { URL.revokeObjectURL(url); setSamplePlayingId(null); };
      await audio.play();
    } catch (err) {
      setSamplePlayingId(null);
      setError(err instanceof Error ? err.message : "Sample failed");
    }
  }

  async function handlePreview() {
    if (!lengthValid) return;
    setError(null);
    setPreviewing(true);
    try {
      const res = await fetch("/api/commercials/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voiceId: selectedVoice.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !lengthValid) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/commercials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, script, voiceId: selectedVoice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push("/campaigns/commercials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/campaigns/commercials" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <MaterialIcon icon="arrow_back" className="text-[20px]" />
        </Link>
        <div>
          <h1 className="font-headline text-xl md:text-2xl font-extrabold text-on-surface">New Commercial</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Write a short spoken ad, pick a voice, save as an MP3 you can drop into broadcasts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: script editor */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-bold text-on-surface block mb-2">Commercial Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Spring Market Update"
              className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-on-surface">Script</label>
              <span className={`text-xs font-semibold ${lengthColor}`}>
                {wc} words · ~{secs}s · {lengthHint}
              </span>
            </div>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              rows={6}
              placeholder="Write the spoken script here..."
              className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:ring-2 focus:ring-primary/30 outline-none resize-none"
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              Target 30–45 words for a ~15–18 second commercial. Speak naturally — write like you would say it.
            </p>
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-on-surface">Preview in {selectedVoice.label}&apos;s voice</p>
                <p className="text-[11px] text-on-surface-variant">Uses your selected voice. Edits invalidate the preview.</p>
              </div>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || !lengthValid}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {previewing ? (
                  <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating…</>
                ) : (
                  <><MaterialIcon icon="graphic_eq" className="text-[16px]" /> Preview</>
                )}
              </button>
            </div>
            {previewUrl ? (
              <audio controls className="w-full" src={previewUrl}>Your browser does not support audio.</audio>
            ) : (
              <div className="h-12 rounded-lg bg-surface-container-lowest border border-dashed border-card-border flex items-center justify-center text-[11px] text-on-surface-variant">
                No preview yet — click Preview to hear it
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</div>
          )}

          <div className="flex gap-3">
            <Link href="/campaigns/commercials" className="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm text-center">
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !lengthValid}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {saving ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
              ) : (
                <><MaterialIcon icon="save" className="text-[18px]" /> Save Commercial</>
              )}
            </button>
          </div>
        </div>

        {/* Right: voice picker */}
        <div>
          <p className="text-sm font-bold text-on-surface mb-3">Voice</p>
          <div className="space-y-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto pr-1">
            {VOICE_CATALOG.map(v => {
              const isSelected = selectedVoice.id === v.id;
              const isPlaying = samplePlayingId === v.id;
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border-2 p-3 transition-all ${
                    isSelected ? "border-primary bg-primary/5" : "border-card-border hover:border-primary/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVoice(v)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      v.gender === "female" ? "bg-pink-500/15 text-pink-400" : "bg-sky-500/15 text-sky-400"
                    }`}>
                      <MaterialIcon icon={v.gender === "female" ? "face_3" : "face_6"} className="text-[20px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${isSelected ? "text-primary" : "text-on-surface"}`}>{v.label}</p>
                      <p className="text-[11px] text-on-surface-variant leading-snug">{v.tagline}</p>
                      <p className="text-[10px] text-on-surface-variant/70 mt-0.5">{v.accent}</p>
                    </div>
                    {isSelected && <MaterialIcon icon="check_circle" className="text-[18px] text-primary" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => playSample(v)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-container-high text-on-surface text-[11px] font-semibold hover:bg-surface-container-highest"
                  >
                    <MaterialIcon icon={isPlaying ? "stop_circle" : "play_circle"} className="text-[16px]" />
                    {isPlaying ? "Stop sample" : "Play sample"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
