"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { generateCircleScripts, generateMarketSnapshotScripts, type ReferencePack, type ScriptVariant } from "@/lib/broadcast-scripts";

type BroadcastType = "circle_prospecting" | "market_snapshot";

const TYPES: { key: BroadcastType; label: string; desc: string; icon: string }[] = [
  { key: "circle_prospecting", label: "Circle Prospecting", desc: "Reference one nearby sale to spark neighbor interest", icon: "radar" },
  { key: "market_snapshot", label: "Market Snapshot", desc: "Summarize recent activity across multiple properties", icon: "bar_chart" },
];

export default function NewBroadcastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<BroadcastType>("circle_prospecting");
  const [ctaEnabled, setCtaEnabled] = useState(true);

  // Reference pack — pre-filled from URL params if coming from map
  const [referencePack] = useState<ReferencePack>(() => {
    const refs = searchParams.get("refs");
    if (refs) {
      // TODO: fetch lead data by IDs from refs param
    }
    return {
      id: `ref_${Date.now()}`,
      market: "Lemoore",
      properties: [{
        address: "755 Castellina St",
        street_name: "Castellina",
        status: "Sold" as const,
        price: 395000,
        dom: 12,
        status_date: "2026-03-27",
      }],
    };
  });

  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenerateVariants() {
    const scripts = type === "circle_prospecting"
      ? generateCircleScripts(referencePack, ctaEnabled)
      : generateMarketSnapshotScripts(referencePack, ctaEnabled);
    setVariants(scripts);
    if (scripts.length > 0) {
      setSelectedVariant(scripts[0].id);
      setEditedScript(scripts[0].text);
    }
    setStep(2);
  }

  function selectVariant(id: string) {
    setSelectedVariant(id);
    const v = variants.find(v => v.id === id);
    if (v) setEditedScript(v.text);
  }

  async function handleGenerateAudio() {
    if (!editedScript.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      // First save the broadcast
      const createRes = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `Broadcast ${new Date().toLocaleDateString()}`,
          type,
          reference_pack: referencePack,
          script_text: editedScript,
          cta_enabled: ctaEnabled,
        }),
      });
      const broadcast = await createRes.json();
      if (!createRes.ok) throw new Error(broadcast.error || "Failed to create broadcast");

      // Generate audio
      const audioRes = await fetch("/api/broadcast/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId: broadcast.id }),
      });
      const audioData = await audioRes.json();
      if (!audioRes.ok) throw new Error(audioData.error || "Audio generation failed");

      setAudioUrl(audioData.audio_url);
      setStep(3);

      // Store broadcast ID for the next step
      sessionStorage.setItem("broadcast_id", broadcast.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGenerating(false);
  }

  function handleFinish() {
    const broadcastId = sessionStorage.getItem("broadcast_id");
    if (broadcastId) {
      router.push(`/campaigns/broadcast/${broadcastId}`);
    } else {
      router.push("/campaigns");
    }
  }

  return (
    <div className="p-4 md:p-8 pb-24 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/campaigns" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <MaterialIcon icon="arrow_back" className="text-[20px]" />
        </Link>
        <div>
          <h1 className="font-headline text-xl md:text-2xl font-extrabold text-on-surface">New Broadcast</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Step {step} of 3</p>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
        ))}
      </div>

      {/* Step 1: Type + Name */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-bold text-on-surface block mb-2">Broadcast Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Castellina St Update"
              className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-on-surface block mb-2">Broadcast Type</label>
            <div className="grid gap-3">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    type === t.key ? 'border-primary bg-primary/5' : 'border-card-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MaterialIcon icon={t.icon} className={`text-[24px] ${type === t.key ? 'text-primary' : 'text-on-surface-variant'}`} />
                    <div>
                      <p className="font-bold text-on-surface">{t.label}</p>
                      <p className="text-xs text-on-surface-variant">{t.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-on-surface">Include CTA (press 1/2/3)</label>
            <button
              onClick={() => setCtaEnabled(!ctaEnabled)}
              className={`w-11 h-6 rounded-full transition-colors ${ctaEnabled ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${ctaEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <button
            onClick={handleGenerateVariants}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Generate Script Variants
            <MaterialIcon icon="arrow_forward" className="text-[18px]" />
          </button>
        </div>
      )}

      {/* Step 2: Pick script variant + edit */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-on-surface">Pick a Script</label>
              <button onClick={handleGenerateVariants} className="text-xs text-primary font-bold hover:underline">
                Regenerate
              </button>
            </div>
            <div className="space-y-2">
              {variants.map(v => (
                <button
                  key={v.id}
                  onClick={() => selectVariant(v.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedVariant === v.id ? 'border-primary bg-primary/5' : 'border-card-border hover:border-primary/30'
                  }`}
                >
                  <p className="text-sm text-on-surface leading-relaxed">{v.text}</p>
                  <p className="text-[10px] text-on-surface-variant mt-2">
                    {v.wordCount} words · ~{v.estimatedSeconds}s
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-on-surface block mb-2">Edit Script</label>
            <textarea
              value={editedScript}
              onChange={e => setEditedScript(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:ring-2 focus:ring-primary/30 outline-none resize-none font-mono"
            />
            <p className="text-[10px] text-on-surface-variant mt-1">
              {editedScript.split(/\s+/).filter(Boolean).length} words · ~{Math.ceil(editedScript.split(/\s+/).filter(Boolean).length / 2.5)}s estimated
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm">
              Back
            </button>
            <button
              onClick={handleGenerateAudio}
              disabled={generating || !editedScript.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {generating ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating Audio...</>
              ) : (
                <><MaterialIcon icon="mic" className="text-[18px]" /> Generate Audio</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview audio + finish */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-card-border p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <MaterialIcon icon="check" className="text-[28px] text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-2">Audio Ready</h2>
            <p className="text-sm text-on-surface-variant mb-4">Preview your broadcast before sending.</p>

            {audioUrl && (
              <audio controls className="w-full max-w-md mx-auto mb-4">
                <source src={audioUrl} type="audio/mpeg" />
                Your browser does not support audio.
              </audio>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 border border-card-border">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Script</p>
            <p className="text-sm text-on-surface leading-relaxed italic">&ldquo;{editedScript}&rdquo;</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm">
              Edit Script
            </button>
            <button
              onClick={handleFinish}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <MaterialIcon icon="send" className="text-[18px]" />
              Go to Broadcast
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
