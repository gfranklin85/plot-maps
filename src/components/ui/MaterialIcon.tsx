import { cn } from "@/lib/utils";

interface Props {
  icon: string;
  className?: string;
  filled?: boolean;
}

export default function MaterialIcon({ icon, className, filled }: Props) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {icon}
    </span>
  );
}
