"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";

interface Broadcast {
  id: string;
  name: string;
  type: string;
  script_text: string;
  audio_url: string | null;
  status: string;
  total_calls: number;
  total_answered: number;
  total_heard: number;
  total_press_1: number;
  total_press_2: number;
  total_press_3: number;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
}

interface BroadcastCall {
  id: string;
  prospect_phone: string;
  prospect_name: string | null;
  prospect_address: string | null;
  lead_id: string | null;
  status: string;
  dtmf_response: string | null;
  intent: string | null;
  actual_duration_seconds: number;
  heard_audio: boolean;
}

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  curious: { label: "Curious", color: "text-emerald-400 bg-emerald-500/10" },
  future_seller: { label: "Future Seller", color: "text-yellow-400 bg-yellow-500/10" },
  not_interested: { label: "Not Interested", color: "text-on-surface-variant bg-surface-container-high" },
};

export default function BroadcastDetailPage() {
  const params = useParams<{ id: string }>();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [calls, setCalls] = useState<BroadcastCall[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await fetch(`/api/broadcast/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcast(data.broadcast);
        setCalls(data.calls || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh while sending
  useEffect(() => {
    if (broadcast?.status !== "sending") return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [broadcast?.status, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="h-8 w-8 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-on-surface">Broadcast not found</h2>
        <Link href="/campaigns" className="text-primary mt-4 inline-block">Back to Campaigns</Link>
      </div>
    );
  }

  const answeredPct = broadcast.total_calls > 0 ? Math.round((broadcast.total_answered / broadcast.total_calls) * 100) : 0;
  const heardPct = broadcast.total_calls > 0 ? Math.round((broadcast.total_heard / broadcast.total_calls) * 100) : 0;
  const responsePct = broadcast.total_answered > 0
    ? Math.round(((broadcast.total_press_1 + broadcast.total_press_2 + broadcast.total_press_3) / broadcast.total_answered) * 100)
    : 0;

  // Sort: curious first, then future seller, then the rest
  const sortedCalls = [...calls].sort((a, b) => {
    const order = { curious: 0, future_seller: 1, not_interested: 2 };
    const aOrder = a.intent ? (order[a.intent as keyof typeof order] ?? 3) : 3;
    const bOrder = b.intent ? (order[b.intent as keyof typeof order] ?? 3) : 3;
    return aOrder - bOrder;
  });

  return (
    <div className="p-4 md:p-8 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/campaigns" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <MaterialIcon icon="arrow_back" className="text-[20px]" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline text-xl md:text-2xl font-extrabold text-on-surface truncate">{broadcast.name}</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {broadcast.status === "sending" && <span className="text-orange-400">Sending now...</span>}
            {broadcast.status === "completed" && broadcast.completed_at && `Completed ${new Date(broadcast.completed_at).toLocaleDateString()}`}
            {broadcast.status === "ready" && "Ready to send"}
            {broadcast.status === "draft" && "Draft"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-card-border p-4 text-center">
          <p className="text-2xl font-bold text-on-surface">{broadcast.total_calls}</p>
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">Total Calls</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4 text-center">
          <p className="text-2xl font-bold text-on-surface">{answeredPct}%</p>
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">Answered</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{broadcast.total_press_1}</p>
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">Curious</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{broadcast.total_press_2}</p>
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">Future Seller</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4 text-center">
          <p className="text-2xl font-bold text-on-surface-variant">{responsePct}%</p>
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">Response Rate</p>
        </div>
      </div>

      {/* Heard vs answered */}
      <div className="bg-card rounded-xl border border-card-border p-4 mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-on-surface-variant">Heard full message</span>
          <span className="font-bold text-on-surface">{broadcast.total_heard} / {broadcast.total_answered} answered ({heardPct}%)</span>
        </div>
        <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${heardPct}%` }} />
        </div>
      </div>

      {/* Script preview */}
      <details className="bg-card rounded-xl border border-card-border mb-6 group">
        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm font-bold text-on-surface">
          Script Used
          <MaterialIcon icon="expand_more" className="text-[18px] text-on-surface-variant group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-4 pb-4">
          <p className="text-sm text-on-surface-variant italic leading-relaxed">&ldquo;{broadcast.script_text}&rdquo;</p>
          {broadcast.audio_url && (
            <audio controls className="w-full mt-3">
              <source src={broadcast.audio_url} type="audio/mpeg" />
            </audio>
          )}
        </div>
      </details>

      {/* Call results table */}
      <div className="bg-card rounded-xl border border-card-border overflow-hidden">
        <div className="px-4 py-3 border-b border-card-border">
          <h3 className="text-sm font-bold text-on-surface">Call Results</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-card-border">
                <th className="px-4 py-2">Prospect</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Response</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/50">
              {sortedCalls.map(call => {
                const intentInfo = call.intent ? INTENT_LABELS[call.intent] : null;
                return (
                  <tr key={call.id} className={call.intent === 'curious' ? 'bg-emerald-500/5' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{call.prospect_name || call.prospect_phone}</p>
                      {call.prospect_address && (
                        <p className="text-[10px] text-on-surface-variant">{call.prospect_address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${call.heard_audio ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                        {call.heard_audio ? 'Heard' : call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {intentInfo ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${intentInfo.color}`}>
                          {intentInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {call.actual_duration_seconds}s
                    </td>
                    <td className="px-4 py-3">
                      {call.lead_id && call.intent === 'curious' && (
                        <Link
                          href={`/leads/${call.lead_id}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Call Now →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
