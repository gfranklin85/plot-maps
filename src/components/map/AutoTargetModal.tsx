"use client";

import { useState } from "react";
import { Lead, LISTING_STATUS_COLORS } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";

interface Props {
  lead: Lead;
  onClose: () => void;
  onSubmitted?: () => void;
}

const RADIUS_OPTIONS = [
  { value: 0.25, label: "0.25 mi" },
  { value: 0.5, label: "0.5 mi" },
  { value: 1, label: "1 mi" },
];

const ESTIMATES: Record<number, string> = {
  0.25: "~20-30",
  0.5: "~50-80",
  1: "~120-200",
};

type ModalState = "default" | "submitting" | "submitted" | "error";

export default function AutoTargetModal({ lead, onClose, onSubmitted }: Props) {
  const [radius, setRadius] = useState(0.25);
  const [state, setState] = useState<ModalState>("default");
  const [creditsInfo, setCreditsInfo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : "";
  const statusColor = lead.listing_status
    ? LISTING_STATUS_COLORS[lead.listing_status] || "#6b7280"
    : "#6b7280";
  const address = lead.property_address?.split(",")[0] || "Unknown";
  const cityLine = lead.property_address?.split(",").slice(1).join(",").trim() || "";

  async function handleSubmit() {
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auto-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceLeadId: lead.id, radius }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "limit_reached") {
          setErrorMsg(`You've used all ${data.limit} free prospect lists.`);
          setState("error");
          return;
        }
        if (res.status === 409) {
          setErrorMsg("You already have a pending request for this property.");
          setState("error");
          return;
        }
        setErrorMsg(data.error || "Something went wrong.");
        setState("error");
        return;
      }

      // Show credit info
      if (data.credits_remaining != null) {
        setCreditsInfo(`${data.credits_remaining} prospect lists remaining this ${data.is_free ? 'account' : 'month'}`);
      }

      setState("submitted");
      onSubmitted?.();

      // Auto-close after 2.5s
      setTimeout(() => onClose(), 2500);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-container-low rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/15 rounded-full blur-[60px]" />

        <div className="relative z-10 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg font-bold text-primary">Find Prospects</h2>
            <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-on-surface transition-colors">
              <MaterialIcon icon="close" className="text-[20px]" />
            </button>
          </div>

          {/* Reference Property Card */}
          <div className="bg-surface-container-lowest p-4 rounded-lg border border-card-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">Reference Property</p>
            <h3 className="font-headline text-lg font-extrabold text-on-surface leading-tight">{address}</h3>
            {cityLine && <p className="text-xs text-on-surface-variant mt-0.5">{cityLine}</p>}
            <div className="flex items-center gap-2 mt-2">
              {priceStr && <span className="font-bold text-on-surface text-sm">{priceStr}</span>}
              {lead.listing_status && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: statusColor + "20", color: statusColor }}
                >
                  {lead.listing_status}
                </span>
              )}
              {lead.dom != null && (
                <span className="text-[10px] text-on-surface-variant">{lead.dom}d DOM</span>
              )}
            </div>
          </div>

          {/* Default state: radius + CTA */}
          {state === "default" && (
            <>
              {/* Radius Selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">Search Radius</p>
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRadius(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        radius === opt.value
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-card-border"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-on-surface-variant/60 mt-2">
                  Estimated {ESTIMATES[radius] || "~20-30"} homes in this radius
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={handleSubmit}
                className="w-full py-4 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <MaterialIcon icon="my_location" className="text-[18px]" />
                Generate Prospect List
              </button>
            </>
          )}

          {/* Submitting state */}
          {state === "submitting" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-on-surface">Building your list...</span>
              </div>
              <p className="text-xs text-on-surface-variant">This usually takes just a few minutes</p>
            </div>
          )}

          {/* Submitted state */}
          {state === "submitted" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <MaterialIcon icon="check" className="text-[24px] text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-on-surface">Request submitted</p>
              <p className="text-xs text-on-surface-variant text-center">
                We&apos;ll notify you when your prospect list is ready.
              </p>
              {creditsInfo && (
                <p className="text-[10px] text-on-surface-variant/50">{creditsInfo}</p>
              )}
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <MaterialIcon icon="error" className="text-[20px] text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-400">{errorMsg}</p>
              <button
                onClick={() => setState("default")}
                className="text-xs text-primary hover:underline font-medium"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
