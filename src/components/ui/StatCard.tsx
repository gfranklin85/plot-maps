import { cn } from "@/lib/utils";
import MaterialIcon from "./MaterialIcon";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  trendIcon?: string;
  trendPercent?: string;
  trendUp?: boolean;
  bgIcon?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  trendIcon,
  trendPercent,
  trendUp,
  bgIcon,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface-container-low p-6",
        className
      )}
    >
      {bgIcon && (
        <MaterialIcon
          icon={bgIcon}
          className="absolute -bottom-2 -right-2 text-[80px] text-slate-200/60"
        />
      )}

      <p className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-headline text-3xl font-extrabold">{value}</p>

      <div className="mt-1 flex items-center gap-1.5">
        {trendIcon && trendPercent && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-sm font-medium",
              trendUp ? "text-emerald-600" : "text-rose-600"
            )}
          >
            <MaterialIcon icon={trendIcon} className="text-[16px]" />
            {trendPercent}
          </span>
        )}

        {subtitle && <span className="text-sm text-secondary">{subtitle}</span>}
      </div>
    </div>
  );
}
