"use client";

import { cn } from "@/lib/utils";
import MaterialIcon from "./MaterialIcon";

interface Props {
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function SearchInput({ placeholder = "Search...", onChange, className }: Props) {
  return (
    <div className={cn("relative", className)}>
      <MaterialIcon
        icon="search"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
      />
      <input
        type="text"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full bg-input-bg py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
