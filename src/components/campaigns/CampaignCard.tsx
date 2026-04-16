"use client";

import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";
import type { Campaign, CampaignStatus } from "@/types/campaign";

const STATUS_STYLES: Record<CampaignStatus, { label: string; color: string; icon: string }> = {
  draft: { label: "Draft", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: "edit_note" },
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "play_circle" },
  paused: { label: "Paused", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: "pause_circle" },
  completed: { label: "Completed", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", icon: "check_circle" },
  archived: { label: "Archived", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: "archive" },
};

interface Props {
  campaign: Campaign;
}

export default function CampaignCard({ campaign }: Props) {
  const status = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;
  const answerRate =
    campaign.calls_made > 0
      ? Math.round((campaign.calls_answered / campaign.calls_made) * 100)
      : 0;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="block p-5 rounded-2xl bg-card border border-card-border hover:border-violet-500/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-extrabold text-on-surface truncate group-hover:text-violet-400 transition-colors">
            {campaign.name}
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            AI: {campaign.assistant_name} &middot; Circle Prospecting
          </p>
        </div>
        <span className={`shrink-0 ml-3 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${status.color}`}>
          <MaterialIcon icon={status.icon} className="text-[12px]" />
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Prospects</p>
          <p className="text-lg font-extrabold text-on-surface">{campaign.total_prospects}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Calls</p>
          <p className="text-lg font-extrabold text-on-surface">{campaign.calls_made}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Answer %</p>
          <p className="text-lg font-extrabold text-on-surface">
            {campaign.calls_made > 0 ? `${answerRate}%` : "—"}
          </p>
        </div>
      </div>

      {/* Reference count + date */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border/30 text-[11px] text-on-surface-variant/60">
        <span>{campaign.reference_lead_ids.length} reference{campaign.reference_lead_ids.length !== 1 ? "s" : ""}</span>
        <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
