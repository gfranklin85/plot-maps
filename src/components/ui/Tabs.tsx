"use client";

import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  key: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeKey, onTabChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-container-low p-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-all",
              isActive
                ? "bg-white font-bold text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs",
                  isActive
                    ? "bg-blue-100 text-blue-600"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
