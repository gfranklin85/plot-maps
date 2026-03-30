import { cn } from "@/lib/utils";

interface Props {
  label: string;
  className?: string;
}

export default function Tag({ label, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600",
        className
      )}
    >
      {label}
    </span>
  );
}
