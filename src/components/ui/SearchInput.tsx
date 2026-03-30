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
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400"
      />
      <input
        type="text"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  );
}
