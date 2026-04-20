'use client';

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What is this?"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        className="text-on-surface-variant/70 hover:text-on-surface transition-colors"
      >
        <MaterialIcon icon="info" className="text-[14px]" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 w-56 p-2 rounded-lg bg-surface-container-highest border border-outline-variant text-xs text-on-surface shadow-lg leading-snug"
        >
          {text}
        </span>
      )}
    </span>
  );
}
