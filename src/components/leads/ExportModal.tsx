'use client';

import { useState } from 'react';
import { EXPORT_FORMATS, IMPORT_SYSTEM_FIELDS } from '@/lib/constants';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  totalFiltered: number;
  allFilteredIds: string[];
}

export default function ExportModal({
  isOpen,
  onClose,
  selectedIds,
  totalFiltered,
  allFilteredIds,
}: ExportModalProps) {
  const [scope, setScope] = useState<'selected' | 'all'>(
    selectedIds.length > 0 ? 'selected' : 'all'
  );
  const [format, setFormat] = useState('phone-list');
  const [customColumns, setCustomColumns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const idsToExport = scope === 'selected' ? selectedIds : allFilteredIds;

  const toggleColumn = (col: string) => {
    setCustomColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleExport = async () => {
    if (idsToExport.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch('/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: idsToExport,
          format,
          columns: format === 'full' && customColumns.size > 0 ? Array.from(customColumns) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-headline font-bold">Export Leads</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <MaterialIcon icon="close" className="text-[20px]" />
          </button>
        </div>

        {/* Scope selector */}
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-600 mb-2">Export scope</p>
          <div className="flex gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setScope('selected')}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  scope === 'selected'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Selected ({selectedIds.length})
              </button>
            )}
            <button
              onClick={() => setScope('all')}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                scope === 'all'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Filtered ({totalFiltered})
            </button>
          </div>
        </div>

        {/* Format selector */}
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-600 mb-2">Format</p>
          <div className="space-y-2">
            {EXPORT_FORMATS.map((f) => (
              <label
                key={f.key}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors ${
                  format === f.key
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.key}
                  checked={format === f.key}
                  onChange={() => setFormat(f.key)}
                  className="accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  {f.fields.length > 0 && (
                    <p className="text-xs text-slate-400">{f.fields.join(', ')}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom columns for full export */}
        {format === 'full' && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-600 mb-2">
              Custom fields (optional, leave empty for all)
            </p>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-3 grid grid-cols-2 gap-1">
              {IMPORT_SYSTEM_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 text-xs cursor-pointer py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={customColumns.has(field.key)}
                    onChange={() => toggleColumn(field.key)}
                    className="rounded accent-blue-600"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={loading || idsToExport.length === 0}
          className="mt-6 w-full rounded-xl action-gradient px-4 py-2.5 text-sm font-semibold text-on-primary transition-shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <MaterialIcon icon="hourglass_empty" className="text-[18px] animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <MaterialIcon icon="download" className="text-[18px]" />
              Export CSV
            </>
          )}
        </button>
      </div>
    </div>
  );
}
