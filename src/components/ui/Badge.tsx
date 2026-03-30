import { cn } from "@/lib/utils";
import { STATUS_BG_COLORS, LeadStatus } from "@/types";

interface Props {
  status: LeadStatus;
  className?: string;
}

export default function Badge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_BG_COLORS[status],
        className
      )}
    >
      {status}
    </span>
  );
}
