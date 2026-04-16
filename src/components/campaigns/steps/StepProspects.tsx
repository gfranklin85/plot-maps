"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import type { WizardState } from "../CampaignWizard";

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

const RADIUS_OPTIONS = [
  { value: 0.25, label: "1/4 mile" },
  { value: 0.5, label: "1/2 mile" },
  { value: 1, label: "1 mile" },
];

export default function StepProspects({ state, update }: Props) {
  const centroid = state.referenceLeads.length > 0
    ? {
        lat: state.referenceLeads.reduce((s, l) => s + (l.latitude || 0), 0) / state.referenceLeads.length,
        lng: state.referenceLeads.reduce((s, l) => s + (l.longitude || 0), 0) / state.referenceLeads.length,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          Select Prospects
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Choose which homeowners your AI will call. We will find leads with phone numbers near your reference properties.
        </p>
      </div>

      {/* Radius mode */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Search Radius
        </label>
        <div className="grid grid-cols-3 gap-3">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ radiusMiles: opt.value, prospectMode: "radius" })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                state.radiusMiles === opt.value && state.prospectMode === "radius"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-card-border hover:border-violet-500/30"
              }`}
            >
              <p className="text-sm font-bold text-on-surface">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="info" className="text-[16px] text-violet-400" />
          <p className="text-xs font-bold text-on-surface">How it works</p>
        </div>
        <ul className="text-[11px] text-on-surface-variant space-y-1.5 ml-6">
          <li>We will search for your leads with phone numbers within the selected radius of your reference properties.</li>
          <li>MLS/reference records are automatically excluded from the prospect list.</li>
          <li>Leads without phone numbers are skipped. Run skip trace first to get more contacts.</li>
        </ul>
      </div>

      {centroid && (
        <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Search Center
          </p>
          <p className="text-xs text-on-surface">
            {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Based on centroid of your {state.referenceLeads.length} reference {state.referenceLeads.length === 1 ? "property" : "properties"}.
          </p>
        </div>
      )}
    </div>
  );
}
