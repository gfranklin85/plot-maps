"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import { ALLOWED_FACTS } from "@/types/campaign";
import type { AllowedFact } from "@/types/campaign";
import type { WizardState } from "../CampaignWizard";

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export default function StepFacts({ state, update }: Props) {
  function toggle(fact: AllowedFact) {
    const has = state.allowedFacts.includes(fact);
    update({
      allowedFacts: has
        ? state.allowedFacts.filter((f) => f !== fact)
        : [...state.allowedFacts, fact],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          Allowed Talking Points
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Choose which facts your AI assistant can mention about the reference properties.
          Fewer facts = cleaner, shorter conversations.
        </p>
      </div>

      <div className="space-y-3">
        {ALLOWED_FACTS.map((fact) => {
          const checked = state.allowedFacts.includes(fact.value);
          return (
            <button
              key={fact.value}
              onClick={() => toggle(fact.value)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                checked
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-card-border hover:border-violet-500/30"
              }`}
            >
              <MaterialIcon
                icon={checked ? "check_box" : "check_box_outline_blank"}
                className={`text-[22px] mt-0.5 ${checked ? "text-violet-400" : "text-on-surface-variant/40"}`}
              />
              <div>
                <p className="text-sm font-bold text-on-surface">{fact.label}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{fact.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Hook Preview
        </p>
        <p className="text-sm text-on-surface italic leading-relaxed">
          {state.allowedFacts.length === 0
            ? "Select at least one fact to see a preview."
            : buildPreviewHook(state)}
        </p>
      </div>
    </div>
  );
}

function buildPreviewHook(state: WizardState): string {
  const ref = state.referenceLeads[0];
  if (!ref) return "Select a reference property first.";

  const street = ref.property_address?.split(",")[0]?.split(/\s+/).slice(1).join(" ") || "a nearby street";
  const parts: string[] = [];

  if (state.allowedFacts.includes("status")) {
    const status = (ref.listing_status || "sold").toLowerCase();
    parts.push(`just ${status === "sold" ? "sold" : status === "pending" ? "went pending" : "hit the market"}`);
  }

  if (state.allowedFacts.includes("timing")) {
    parts.push("earlier this week");
  }

  if (state.allowedFacts.includes("price")) {
    const p = ref.selling_price || ref.listing_price;
    if (p) parts.push(`around $${Math.round(p / 1000)}K`);
  }

  if (state.allowedFacts.includes("dom") && ref.dom != null) {
    parts.push(`in just ${ref.dom} days`);
  }

  return `"A home on ${street} ${parts.join(" ")} and we have been reaching out to a few neighbors nearby."`;
}
