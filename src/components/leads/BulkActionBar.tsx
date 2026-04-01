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
    <div className="flex items-center gap-3 rounded-xl bg-blue-50/50 border border-blue-100/50 px-4 py-2.5 text-sm">
      <span className="font-medium text-blue-700">
        {selectedIds.size} selected
      </span>
      <div className="h-4 w-px bg-blue-200" />

      {/* Update Status */}
      <div className="relative">
        <button
          onClick={() => {
            setShowStatusDropdown(!showStatusDropdown);
            setShowTagInput(false);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
        >
          <MaterialIcon icon="sync" className="text-[16px]" />
          Update Status
        </button>
        {showStatusDropdown && (
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onStatusUpdate(s as LeadStatus);
                  setShowStatusDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 transition-colors"
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
              className="w-32 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            <button
              onClick={handleTagSubmit}
              className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              Add
            </button>
            <button
              onClick={() => setShowTagInput(false)}
              className="text-slate-400 hover:text-slate-600"
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
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            <MaterialIcon icon="label" className="text-[16px]" />
            Add Tag
          </button>
        )}
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
      >
        <MaterialIcon icon="download" className="text-[16px]" />
        Export
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 text-slate-400 hover:text-slate-600 font-medium"
      >
        <MaterialIcon icon="close" className="text-[16px]" />
        Clear Selection
      </button>
    </div>
  );
}
