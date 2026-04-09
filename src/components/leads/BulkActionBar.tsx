'use client';

import { useState } from 'react';
import { LEAD_STATUSES } from '@/lib/constants';
import { LeadStatus } from '@/types';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onStatusUpdate: (status: LeadStatus) => void;
  onTagAdd: (tag: string) => void;
  onExport: () => void;
  onClear: () => void;
}

export default function BulkActionBar({
  selectedIds,
  onStatusUpdate,
  onTagAdd,
  onExport,
  onClear,
}: BulkActionBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagValue, setTagValue] = useState('');

  const handleTagSubmit = () => {
    const trimmed = tagValue.trim();
    if (trimmed) {
      onTagAdd(trimmed);
      setTagValue('');
      setShowTagInput(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 px-4 py-2.5 text-sm">
      <span className="font-medium text-primary">
        {selectedIds.size} selected
      </span>
      <div className="h-4 w-px bg-primary/20" />

      {/* Update Status */}
      <div className="relative">
        <button
          onClick={() => {
            setShowStatusDropdown(!showStatusDropdown);
            setShowTagInput(false);
          }}
          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
        >
          <MaterialIcon icon="sync" className="text-[16px]" />
          Update Status
        </button>
        {showStatusDropdown && (
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-card-border bg-card py-1 shadow-lg">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onStatusUpdate(s as LeadStatus);
                  setShowStatusDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Tag */}
      <div className="relative">
        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTagSubmit();
                if (e.key === 'Escape') setShowTagInput(false);
              }}
              placeholder="Tag name..."
              autoFocus
              className="w-32 rounded-lg border border-primary/20 bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleTagSubmit}
              className="rounded-lg bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
            >
              Add
            </button>
            <button
              onClick={() => setShowTagInput(false)}
              className="text-on-surface-variant hover:text-on-surface"
            >
              <MaterialIcon icon="close" className="text-[16px]" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowTagInput(true);
              setShowStatusDropdown(false);
            }}
            className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
          >
            <MaterialIcon icon="label" className="text-[16px]" />
            Add Tag
          </button>
        )}
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
      >
        <MaterialIcon icon="download" className="text-[16px]" />
        Export
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-medium"
      >
        <MaterialIcon icon="close" className="text-[16px]" />
        Clear Selection
      </button>
    </div>
  );
}
