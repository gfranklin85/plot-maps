"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "@/components/ui/MaterialIcon";
import StepType from "./steps/StepType";
import StepReferences from "./steps/StepReferences";
import StepFacts from "./steps/StepFacts";
import StepProspects from "./steps/StepProspects";
import StepPreview from "./steps/StepPreview";
import type { AllowedFact, ReferenceStrategy } from "@/types/campaign";
import type { Lead } from "@/types";

const STEPS = [
  { label: "Campaign", icon: "campaign" },
  { label: "References", icon: "home_work" },
  { label: "Facts", icon: "checklist" },
  { label: "Prospects", icon: "group" },
  { label: "Preview", icon: "visibility" },
];

export interface WizardState {
  name: string;
  assistantName: string;
  referenceStrategy: ReferenceStrategy;
  referenceLeadIds: string[];
  referenceLeads: Lead[];
  allowedFacts: AllowedFact[];
  prospectMode: "radius" | "lead_ids";
  radiusMiles: number;
  prospectLeadIds: string[];
}

export default function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: "",
    assistantName: "Morgan",
    referenceStrategy: "nearest",
    referenceLeadIds: [],
    referenceLeads: [],
    allowedFacts: ["status", "price", "timing"],
    prospectMode: "radius",
    radiusMiles: 0.5,
    prospectLeadIds: [],
  });

  const update = (partial: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!state.name.trim() && !!state.assistantName.trim();
      case 1: return state.referenceLeadIds.length > 0 && state.referenceLeadIds.length <= 3;
      case 2: return state.allowedFacts.length > 0;
      case 3: return true;
      default: return true;
    }
  };

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create campaign
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim(),
          assistant_name: state.assistantName.trim(),
          reference_lead_ids: state.referenceLeadIds,
          primary_reference_strategy: state.referenceStrategy,
          allowed_facts: state.allowedFacts,
        }),
      });

      const campaign = await res.json();
      if (!res.ok) {
        setError(campaign.error || "Failed to create campaign");
        setSubmitting(false);
        return;
      }

      // 2. Add prospects
      if (state.referenceLeads.length > 0) {
        const centroid = state.referenceLeads.reduce(
          (acc, l) => ({
            lat: acc.lat + (l.latitude || 0) / state.referenceLeads.length,
            lng: acc.lng + (l.longitude || 0) / state.referenceLeads.length,
          }),
          { lat: 0, lng: 0 },
        );

        const prospectBody =
          state.prospectMode === "lead_ids" && state.prospectLeadIds.length > 0
            ? { lead_ids: state.prospectLeadIds }
            : {
                radius_miles: state.radiusMiles,
                center_lat: centroid.lat,
                center_lng: centroid.lng,
              };

        await fetch(`/api/campaigns/${campaign.id}/prospects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prospectBody),
        });
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                i === step
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : i < step
                    ? "text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                    : "text-on-surface-variant/40"
              }`}
            >
              <MaterialIcon
                icon={i < step ? "check_circle" : s.icon}
                className="text-[16px]"
              />
              <span className="hidden md:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${i < step ? "bg-emerald-500/30" : "bg-card-border/30"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card rounded-2xl border border-card-border shadow-xl p-6 md:p-8">
        {step === 0 && <StepType state={state} update={update} />}
        {step === 1 && <StepReferences state={state} update={update} />}
        {step === 2 && <StepFacts state={state} update={update} />}
        {step === 3 && <StepProspects state={state} update={update} />}
        {step === 4 && <StepPreview state={state} />}

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-card-border/50">
          <button
            onClick={() => step === 0 ? router.push("/campaigns") : setStep(step - 1)}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <MaterialIcon icon="arrow_back" className="text-[18px]" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <MaterialIcon icon="arrow_forward" className="text-[18px]" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MaterialIcon icon="rocket_launch" className="text-[18px]" />
                  Create Campaign
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
