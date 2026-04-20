"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";

interface Commercial {
  id: string;
  name: string;
  script_text: string;
  audio_url: string;
  audio_duration_seconds: number;
  voice_id: string;
  voice_label: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CommercialsPage() {
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/commercials");
      if (!res.ok) throw new Error("Failed to load");
      setCommercials(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this commercial? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/commercials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setCommercials(cs => cs.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="text-on-surface-variant hover:text-on-surface transition-colors">
            <MaterialIcon icon="arrow_back" className="text-[20px]" />
          </Link>
          <div>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">Commercials</h1>
            <p className="text-sm text-on-surface-variant mt-1">Reusable spoken ads you can attach to broadcasts.</p>
          </div>
        </div>
        <Link
          href="/campaigns/commercials/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm shadow hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <MaterialIcon icon="add" className="text-[18px]" />
          <span className="hidden sm:inline">New Commercial</span>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : commercials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MaterialIcon icon="mic" className="text-[32px] text-primary" />
          </div>
          <h2 className="text-lg font-bold text-on-surface">No commercials yet</h2>
          <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
            Write a short spoken ad, pick a voice, and save it once — then drop it into any broadcast campaign.
          </p>
          <Link href="/campaigns/commercials/new" className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm">
            <MaterialIcon icon="add" className="text-[18px]" />
            Build your first commercial
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {commercials.map(c => (
            <div key={c.id} className="bg-card rounded-2xl border border-card-border p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-on-surface truncate">{c.name}</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {c.voice_label} · ~{c.audio_duration_seconds}s · {timeAgo(c.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                  aria-label="Delete"
                >
                  <MaterialIcon icon="delete" className="text-[18px]" />
                </button>
              </div>
              <p className="text-sm text-on-surface/90 leading-relaxed italic line-clamp-3">&ldquo;{c.script_text}&rdquo;</p>
              <audio controls className="w-full" src={c.audio_url}>
                Your browser does not support audio.
              </audio>
              <Link
                href={`/campaigns/broadcast/new?commercial=${c.id}`}
                className="mt-auto flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs hover:bg-emerald-500/20"
              >
                <MaterialIcon icon="send" className="text-[16px]" />
                Use in Broadcast
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
