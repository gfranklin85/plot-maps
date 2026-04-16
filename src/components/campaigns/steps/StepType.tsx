"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import type { WizardState } from "../CampaignWizard";
import type { ReferenceStrategy } from "@/types/campaign";

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export default function StepType({ state, update }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          Create Voice Campaign
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Set up your AI assistant for neighborhood outreach calls.
        </p>
      </div>

      {/* Campaign type — only circle prospecting for MVP */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Campaign Type
        </label>
        <div className="mt-2 p-4 rounded-xl border-2 border-violet-500 bg-violet-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <MaterialIcon icon="location_on" className="text-[20px] text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Circle Prospecting</p>
              <p className="text-xs text-on-surface-variant">
                Call nearby homeowners referencing recent neighborhood activity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign name */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Campaign Name
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Spring 2026 — Oak Park"
          className="mt-2 w-full px-4 py-3 rounded-xl bg-input-bg border border-input-border text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Assistant name */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          AI Assistant Name
        </label>
        <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
          The name your AI will use when calling prospects.
        </p>
        <input
          type="text"
          value={state.assistantName}
          onChange={(e) => update({ assistantName: e.target.value })}
          placeholder="Morgan"
          className="mt-2 w-full px-4 py-3 rounded-xl bg-input-bg border border-input-border text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Reference strategy */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Reference Strategy
        </label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {([
            { value: "nearest" as ReferenceStrategy, label: "Nearest", desc: "Pick the closest reference for each prospect", icon: "near_me" },
            { value: "fixed" as ReferenceStrategy, label: "Fixed", desc: "Same reference property for all calls", icon: "push_pin" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ referenceStrategy: opt.value })}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                state.referenceStrategy === opt.value
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-card-border hover:border-violet-500/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon icon={opt.icon} className="text-[16px] text-violet-400" />
                <p className="text-sm font-bold text-on-surface">{opt.label}</p>
              </div>
              <p className="text-[11px] text-on-surface-variant">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
