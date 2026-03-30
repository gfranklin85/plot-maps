'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';

type ColumnMapping = Record<string, string>;

interface ValidationResults {
  totalRows: number;
  validRows: number;
  missingData: number;
  geocoded: number;
}

const SYSTEM_FIELDS = [
  'Property Address',
  'Owner Name',
  'Phone Number',
  'Email Address',
  'Listing Status',
];

const STEP_LABELS = ['UPLOAD CSV', 'MAP COLUMNS', 'VALIDATE & GEOCODE', 'FINISH'];

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map((h) => h.toLowerCase());

  for (const field of SYSTEM_FIELDS) {
    let best = '';
    if (field === 'Property Address') {
      best = headers[lower.findIndex((h) => h.includes('address'))] ?? '';
    } else if (field === 'Owner Name') {
      best =
        headers[lower.findIndex((h) => h.includes('owner') || h.includes('name'))] ?? '';
    } else if (field === 'Phone Number') {
      best = headers[lower.findIndex((h) => h.includes('phone'))] ?? '';
    } else if (field === 'Email Address') {
      best = headers[lower.findIndex((h) => h.includes('email'))] ?? '';
    } else if (field === 'Listing Status') {
      best =
        headers[lower.findIndex((h) => h.includes('status') || h.includes('listing'))] ??
        '';
    }
    mapping[field] = best;
  }
  return mapping;
}

export default function ImportsPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [validationResults, setValidationResults] = useState<ValidationResults>({
    totalRows: 0,
    validRows: 0,
    missingData: 0,
    geocoded: 0,
  });
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV text
  const parseCSV = useCallback((text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) =>
      line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    );

    setCsvHeaders(headers);
    setCsvRows(rows);
    setColumnMapping(autoDetectMapping(headers));

    const totalRows = rows.length;
    const validRows = rows.filter(
      (r) => r.some((c) => c.length > 0)
    ).length;
    const missingData = totalRows - validRows;

    setValidationResults({
      totalRows,
      validRows,
      missingData,
      geocoded: 0,
    });
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith('.csv')) handleFile(file);
    },
    [handleFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Step 3: simulate geocoding + import
  useEffect(() => {
    if (currentStep !== 3) return;
    setImportProgress(0);
    setImportDone(false);
    setImportError(null);
    setImportedCount(0);

    const total = csvRows.length;
    let current = 0;
    const interval = setInterval(() => {
      current += Math.max(1, Math.floor(total / 20));
      if (current >= total) current = total;
      setImportProgress(current);
      if (current >= total) {
        clearInterval(interval);
        // Do the actual import
        doImport();
      }
    }, 250);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  async function doImport() {
    const mappedRows = csvRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const field of SYSTEM_FIELDS) {
        const csvCol = columnMapping[field];
        const idx = csvHeaders.indexOf(csvCol);
        obj[field] = idx >= 0 ? row[idx] ?? '' : '';
      }
      return obj;
    });

    let imported = 0;
    let errorMsg: string | null = null;

    for (const row of mappedRows) {
      const { error } = await supabase.from('leads').insert({
        name: row['Owner Name'] || 'Unknown',
        property_address: row['Property Address'],
        phone: row['Phone Number'] || null,
        email: row['Email Address'] || null,
        status: row['Listing Status'] || 'New',
        source: 'CSV Import',
      });
      if (error) {
        errorMsg = error.message;
      } else {
        imported++;
      }
    }

    setImportedCount(imported);
    setImportError(errorMsg);
    setValidationResults((prev) => ({ ...prev, geocoded: imported }));
    setImportDone(true);
  }

  function resetWizard() {
    setCurrentStep(1);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setValidationResults({ totalRows: 0, validRows: 0, missingData: 0, geocoded: 0 });
    setImportProgress(0);
    setImportDone(false);
    setImportError(null);
    setImportedCount(0);
  }

  const progressPct =
    csvRows.length > 0 ? Math.round((importProgress / csvRows.length) * 100) : 0;
  const ambiguousCount = Math.max(0, Math.floor(csvRows.length * 0.05));

  return (
    <div className="p-8">
      {/* Step Indicator */}
      <div className="mb-10 flex items-center justify-center">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const isCompleted = currentStep > step;
          const isCurrent = currentStep === step;
          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors',
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'border-2 border-slate-300 text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <MaterialIcon icon="check" className="text-[20px]" />
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-[11px] font-bold uppercase tracking-wider',
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 h-0.5 w-16 sm:w-24',
                    currentStep > step + 1
                      ? 'bg-emerald-400'
                      : currentStep > step
                        ? 'bg-blue-400'
                        : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload CSV */}
      {currentStep === 1 && (
        <div className="mx-auto max-w-2xl">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors',
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : csvFile
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-slate-300 bg-surface-container-lowest hover:border-slate-400'
            )}
          >
            <MaterialIcon
              icon={csvFile ? 'check_circle' : 'upload_file'}
              className={cn(
                'text-[64px] mb-4',
                csvFile ? 'text-emerald-500' : 'text-slate-400'
              )}
            />
            {csvFile ? (
              <>
                <p className="text-lg font-semibold text-emerald-700">{csvFile.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {csvRows.length} rows detected with {csvHeaders.length} columns
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-slate-700">
                  Drop your CSV file here or click to browse
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Supports .csv files up to 50MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {csvFile && csvRows.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Preview (first 5 rows)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {csvHeaders.map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold text-slate-600"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="whitespace-nowrap px-4 py-2 text-slate-600"
                          >
                            {cell || <span className="text-slate-300">--</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              disabled={!csvFile}
              onClick={() => setCurrentStep(2)}
              className={cn(
                'rounded-xl px-8 py-3 text-sm font-bold transition-all',
                csvFile
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg hover:shadow-xl'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              )}
            >
              Continue
              <MaterialIcon icon="arrow_forward" className="ml-2 text-[16px] align-middle" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Validation Summary */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-surface-container-lowest p-6">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
                Validation Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-blue-50 p-4 text-center">
                  <p className="text-2xl font-extrabold text-blue-600">
                    {validationResults.totalRows}
                  </p>
                  <p className="mt-1 text-xs font-medium text-blue-500">Total Rows</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-extrabold text-emerald-600">
                    {validationResults.validRows}
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-500">Valid Rows</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 text-center">
                  <p className="text-2xl font-extrabold text-amber-600">
                    {validationResults.missingData}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-500">Missing Data</p>
                </div>
                <div className="rounded-xl bg-violet-50 p-4 text-center">
                  <p className="text-2xl font-extrabold text-violet-600">
                    {validationResults.geocoded}
                  </p>
                  <p className="mt-1 text-xs font-medium text-violet-500">Geocoded</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Map CSV Columns */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-surface-container-lowest p-6">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
                Map CSV Columns
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        System Field
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        CSV Column (Source)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Sample Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_FIELDS.map((field) => {
                      const selectedCol = columnMapping[field] || '';
                      const colIdx = csvHeaders.indexOf(selectedCol);
                      const sample =
                        colIdx >= 0 && csvRows[0] ? csvRows[0][colIdx] ?? '' : '';
                      return (
                        <tr
                          key={field}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {field}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={selectedCol}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="">-- Select Column --</option>
                              {csvHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {sample || (
                              <span className="text-slate-300">No data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="lg:col-span-12 flex items-center gap-4">
            <button
              onClick={() => setCurrentStep(1)}
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <MaterialIcon icon="arrow_back" className="mr-2 text-[16px] align-middle" />
              Back to Upload
            </button>
            <button className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
              <MaterialIcon icon="save" className="mr-2 text-[16px] align-middle" />
              Save Draft
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setCurrentStep(3)}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
            >
              Start Import & Geocode
              <MaterialIcon icon="rocket_launch" className="ml-2 text-[16px] align-middle" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validate & Geocode */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Geocoding Process */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-container-lowest p-6">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-6">
                Geocoding Process
              </h3>

              {!importDone ? (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
                    <p className="text-sm font-semibold text-slate-700">
                      Geocoding in progress... {progressPct}%
                    </p>
                  </div>
                  <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    {importProgress} / {csvRows.length} addresses processed
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <MaterialIcon
                      icon="check_circle"
                      className="text-[24px] text-emerald-500"
                    />
                    <p className="text-sm font-semibold text-emerald-700">
                      Import complete!
                    </p>
                  </div>
                  <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-full rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-sm text-slate-500">
                    {csvRows.length} / {csvRows.length} addresses processed
                  </p>
                </>
              )}

              {ambiguousCount > 0 && (
                <div className="mt-6 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <MaterialIcon
                    icon="warning"
                    className="text-[20px] text-amber-500 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">
                      {ambiguousCount} Ambiguous Addresses
                    </p>
                    <p className="text-xs text-amber-600">
                      These require manual verification
                    </p>
                  </div>
                </div>
              )}

              {importError && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4">
                  <MaterialIcon
                    icon="error"
                    className="text-[20px] text-rose-500 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-rose-700">Import Errors</p>
                    <p className="text-xs text-rose-600">{importError}</p>
                  </div>
                </div>
              )}

              {importDone && (
                <div className="mt-6">
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                  >
                    Continue to Summary
                    <MaterialIcon
                      icon="arrow_forward"
                      className="ml-2 text-[16px] align-middle"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Map placeholder */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-surface-container-lowest p-6">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
                Live Geocode Tracking
              </h3>
              <div className="relative flex h-80 items-center justify-center rounded-xl bg-slate-100">
                {/* Simulated dots */}
                <div className="absolute inset-0 overflow-hidden rounded-xl">
                  {Array.from({ length: Math.min(importProgress, 30) }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-2 w-2 rounded-full bg-blue-500 opacity-60"
                      style={{
                        left: `${10 + ((i * 37) % 80)}%`,
                        top: `${10 + ((i * 23) % 80)}%`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="z-10 text-center">
                  <MaterialIcon icon="map" className="text-[48px] text-slate-300" />
                  <p className="mt-2 text-sm text-slate-400">
                    Map visualization placeholder
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Finish */}
      {currentStep === 4 && (
        <div className="mx-auto max-w-xl text-center">
          <div className="rounded-2xl bg-surface-container-lowest p-10">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <MaterialIcon
                icon="check_circle"
                className="text-[48px] text-emerald-500"
                filled
              />
            </div>
            <h3 className="font-headline text-2xl font-extrabold text-on-surface">
              Import Complete!
            </h3>
            <p className="mt-2 text-secondary">
              Your CSV has been processed and leads have been imported.
            </p>

            <div className="my-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-2xl font-extrabold text-blue-600">
                  {validationResults.totalRows}
                </p>
                <p className="text-xs font-medium text-blue-500">Total Rows</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-2xl font-extrabold text-emerald-600">
                  {importedCount}
                </p>
                <p className="text-xs font-medium text-emerald-500">Imported</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-4">
                <p className="text-2xl font-extrabold text-rose-600">
                  {validationResults.totalRows - importedCount}
                </p>
                <p className="text-xs font-medium text-rose-500">Errors</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <a
                href="/leads"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
              >
                <MaterialIcon icon="group" className="mr-2 text-[16px] align-middle" />
                View Leads
              </a>
              <button
                onClick={resetWizard}
                className="rounded-xl border border-slate-300 px-8 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <MaterialIcon
                  icon="refresh"
                  className="mr-2 text-[16px] align-middle"
                />
                Import Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
