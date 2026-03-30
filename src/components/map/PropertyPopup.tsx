"use client";

import Link from "next/link";
import { Lead, STATUS_BG_COLORS } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PropertyPopup({ lead }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 min-w-[280px] max-w-[320px]">
      {/* Header: status + updated */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
            STATUS_BG_COLORS[lead.status]
          )}
        >
          {lead.status}
        </span>
        <span className="text-xs text-slate-400">
          Updated {timeAgo(lead.updated_at)}
        </span>
      </div>

      {/* Address */}
      <p className="text-base font-bold text-slate-900 leading-snug mb-1">
        {lead.property_address || "No address"}
      </p>

      {/* Owner + phone */}
      <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
        <span>{lead.name}</span>
        <MaterialIcon icon="verified" filled className="text-[16px] text-blue-500" />
      </div>
      {lead.phone && (
        <p className="text-sm text-slate-500 mb-3">
          <MaterialIcon icon="phone" className="text-[14px] mr-1" />
          {lead.phone}
        </p>
      )}

      {/* Details row */}
      <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3 mb-4">
        {lead.price_range && (
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">
              Est. Value
            </span>
            <span className="font-semibold text-slate-700">{lead.price_range}</span>
          </div>
        )}
        {lead.source && (
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">
              Source
            </span>
            <span className="font-semibold text-slate-700">{lead.source}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="flex-1 text-center rounded-xl bg-blue-600 text-white text-sm font-semibold py-2 px-3 hover:bg-blue-700 transition-colors"
        >
          Open Full Record
        </Link>
        <button className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition-colors">
          <MaterialIcon icon="call" className="text-[18px] text-slate-600" />
        </button>
        <button className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition-colors">
          <MaterialIcon icon="note_add" className="text-[18px] text-slate-600" />
        </button>
      </div>
    </div>
  );
}
