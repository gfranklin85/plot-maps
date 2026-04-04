'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { IMPORT_SYSTEM_FIELDS, LEAD_STATUSES } from '@/lib/constants';
import type { ImportTemplate } from '@/types';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ImportProgress from '@/components/ui/ImportProgress';

/* ---------- local types ---------- */
type Tab = 'ai' | 'csv' | 'mls';
type CsvStep = 'upload' | 'mapping' | 'preview' | 'import';
type RowAction = 'create' | 'update' | 'skip';

type ColumnMapping = Record<string, string>; // system field key -> csv header

interface ParsedRecord {
  [key: string]: string;
}

interface DedupRow {
  mapped: Record<string, string>;
  existingId: string | null;
  action: RowAction;
}

/* ---------- helpers ---------- */

const AI_PREVIEW_COLS = [
  'property_address',
  'owner_name',
  'phone',
  'email',
  'city',
  'state',
  'zip',
  'mailing_address',
  'price_range',
  'notes',
];

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map((h) => h.toLowerCase());

  for (const field of IMPORT_SYSTEM_FIELDS) {
    let bestIdx = -1;

    switch (field.key) {
      case 'property_address':
        bestIdx = lower.findIndex(
          (h) =>
            (h.includes('property') && h.includes('address')) ||
            (h.includes('address') && !h.includes('mail'))
        );
        if (bestIdx < 0) bestIdx = lower.findIndex((h) => h.includes('address'));
        break;
      case 'owner_name':
        bestIdx = lower.findIndex((h) => h.includes('owner'));
        break;
      case 'name':
        bestIdx = lower.findIndex(
          (h) => h === 'name' || h === 'contact name' || h === 'contact'
        );
        break;
      case 'phone':
        bestIdx = lower.findIndex(
          (h) => h.includes('phone') && !h.includes('2') && !h.includes('3')
        );
        break;
      case 'phone_2':
        bestIdx = lower.findIndex((h) => h.includes('phone') && h.includes('2'));
        break;
      case 'phone_3':
        bestIdx = lower.findIndex((h) => h.includes('phone') && h.includes('3'));
        break;
      case 'email':
        bestIdx = lower.findIndex((h) => h.includes('email'));
        break;
      case 'mailing_address':
        bestIdx = lower.findIndex((h) => h.includes('mail') && h.includes('address'));
        break;
      case 'mailing_city':
        bestIdx = lower.findIndex((h) => h.includes('mail') && h.includes('city'));
        break;
      case 'mailing_state':
        bestIdx = lower.findIndex((h) => h.includes('mail') && h.includes('state'));
        break;
      case 'mailing_zip':
        bestIdx = lower.findIndex((h) => h.includes('mail') && h.includes('zip'));
        break;
      case 'city':
        bestIdx = lower.findIndex(
          (h) => h.includes('city') && !h.includes('mail')
        );
        break;
      case 'state':
        bestIdx = lower.findIndex(
          (h) => h.includes('state') && !h.includes('mail')
        );
        break;
      case 'zip':
        bestIdx = lower.findIndex(
          (h) => (h.includes('zip') || h.includes('postal')) && !h.includes('mail')
        );
        break;
      case 'status':
        bestIdx = lower.findIndex((h) => h.includes('status'));
        break;
      case 'source':
        bestIdx = lower.findIndex((h) => h.includes('source'));
        break;
      case 'tags':
        bestIdx = lower.findIndex((h) => h.includes('tag'));
        break;
      case 'price_range':
        bestIdx = lower.findIndex(
          (h) => h.includes('price') || h.includes('value')
        );
        break;
      case 'property_condition':
        bestIdx = lower.findIndex((h) => h.includes('condition'));
        break;
      case 'notes':
        bestIdx = lower.findIndex((h) => h.includes('note'));
        break;
      case 'latitude':
        bestIdx = lower.findIndex((h) => h.includes('lat'));
        break;
      case 'longitude':
        bestIdx = lower.findIndex((h) => h.includes('lng') || h.includes('lon'));
        break;
    }

    mapping[field.key] = bestIdx >= 0 ? headers[bestIdx] : '';
  }

  return mapping;
}

function detectNameCombine(headers: string[]): { first: string; last: string } | null {
  const lower = headers.map((h) => h.toLowerCase());
  const firstIdx = lower.findIndex(
    (h) => h.includes('first') && h.includes('name')
  );
  const lastIdx = lower.findIndex(
    (h) => h.includes('last') && h.includes('name')
  );
  if (firstIdx >= 0 && lastIdx >= 0) {
    return { first: headers[firstIdx], last: headers[lastIdx] };
  }
  return null;
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
}

/* ================================================================ */
/*  PAGE COMPONENT                                                  */
/* ================================================================ */

export default function ImportsPage() {
  /* --- shared state --- */
  const [activeTab, setActiveTab] = useState<Tab>('ai');

  /* ==================== AI TAB STATE ==================== */
  const [aiText, setAiText] = useState('');
  const [aiSource, setAiSource] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecords, setAiRecords] = useState<ParsedRecord[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiImporting, setAiImporting] = useState(false);
  const [aiImportProgress, setAiImportProgress] = useState(0);
  const [aiImportTotal, setAiImportTotal] = useState(0);
  const [aiGeocodeProgress, setAiGeocodeProgress] = useState(0);
  const [aiGeocodeTotal, setAiGeocodeTotal] = useState(0);
  const [aiResult, setAiResult] = useState<{
    imported: number;
    geocoded: number;
    errors: number;
  } | null>(null);

  /* ==================== CSV TAB STATE ==================== */
  const [csvStep, setCsvStep] = useState<CsvStep>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [nameCombine, setNameCombine] = useState<{
    first: string;
    last: string;
  } | null>(null);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSource, setTemplateSource] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  // dedup
  const [dedupRows, setDedupRows] = useState<DedupRow[]>([]);
  const [dedupLoading, setDedupLoading] = useState(false);

  // import
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportProgress, setCsvImportProgress] = useState(0);
  const [csvImportTotal, setCsvImportTotal] = useState(0);
  const [csvGeocodeProgress, setCsvGeocodeProgress] = useState(0);
  const [csvGeocodeTotal, setCsvGeocodeTotal] = useState(0);
  const [csvResult, setCsvResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    geocoded: number;
    errors: number;
  } | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- load templates ---------- */
  useEffect(() => {
    supabase
      .from('import_templates')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setTemplates(data as ImportTemplate[]);
      });
  }, []);

  /* ==================== AI TAB LOGIC ==================== */

  async function handleAiParse() {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiError(null);
    setAiRecords([]);
    setAiSelected(new Set());
    setAiResult(null);

    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, source: aiSource || undefined }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Parse failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const records: ParsedRecord[] = Array.isArray(data) ? data : data.records ?? [];
      setAiRecords(records);
      setAiSelected(new Set(records.map((_, i) => i)));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAiParsing(false);
    }
  }

  function handleAiCellEdit(rowIdx: number, key: string, value: string) {
    setAiRecords((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }

  function toggleAiRow(idx: number) {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAiAll() {
    if (aiSelected.size === aiRecords.length) {
      setAiSelected(new Set());
    } else {
      setAiSelected(new Set(aiRecords.map((_, i) => i)));
    }
  }

  async function handleAiImport() {
    const selectedRecords = aiRecords.filter((_, i) => aiSelected.has(i));
    if (selectedRecords.length === 0) return;

    setAiImporting(true);
    setAiResult(null);
    setAiImportProgress(0);
    setAiImportTotal(selectedRecords.length);

    let imported = 0;
    let errors = 0;

    for (let i = 0; i < selectedRecords.length; i++) {
      const rec = selectedRecords[i];
      const row: Record<string, unknown> = {
        property_address: rec.property_address || null,
        owner_name: rec.owner_name || null,
        name: rec.owner_name || rec.name || 'Unknown',
        phone: rec.phone || null,
        email: rec.email || null,
        city: rec.city || null,
        state: rec.state || null,
        zip: rec.zip || null,
        mailing_address: rec.mailing_address || null,
        price_range: rec.price_range || null,
        notes: rec.notes || null,
        status: 'New',
        source: 'AI Parse',
      };

      const { error } = await supabase.from('leads').insert(row);
      if (error) errors++;
      else imported++;

      setAiImportProgress(i + 1);
    }

    // geocode addresses missing lat/lng
    const addressesToGeocode = selectedRecords
      .filter((r) => r.property_address && !r.latitude && !r.longitude)
      .map((r) =>
        [r.property_address, r.city, r.state, r.zip].filter(Boolean).join(', ')
      );

    let geocoded = 0;
    setAiGeocodeTotal(addressesToGeocode.length);
    setAiGeocodeProgress(0);

    if (addressesToGeocode.length > 0) {
      // batch geocode in chunks of 25
      const chunkSize = 25;
      for (let i = 0; i < addressesToGeocode.length; i += chunkSize) {
        const chunk = addressesToGeocode.slice(i, i + chunkSize);
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: chunk }),
          });
          if (res.ok) {
            const results = await res.json();
            const geoArr = Array.isArray(results) ? results : results.results ?? [];
            for (const geo of geoArr) {
              if (geo.lat && geo.lng && geo.address) {
                await supabase
                  .from('leads')
                  .update({
                    latitude: geo.lat,
                    longitude: geo.lng,
                    geocoded_at: new Date().toISOString(),
                  })
                  .ilike('property_address', `%${geo.address.split(',')[0]}%`);
                geocoded++;
              }
            }
          }
        } catch {
          /* geocode failures are non-fatal */
        }
        setAiGeocodeProgress(Math.min(i + chunkSize, addressesToGeocode.length));
      }
    }

    setAiResult({ imported, geocoded, errors });
    setAiImporting(false);
  }

  /* ==================== CSV TAB LOGIC ==================== */

  const handleFile = useCallback((file: File) => {
    setCsvFile(file);
    setCsvStep('upload');
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSVText(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      const mapping = autoDetectMapping(headers);
      setColumnMapping(mapping);
      setNameCombine(detectNameCombine(headers));
    };
    reader.readAsText(file);
  }, []);

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

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setColumnMapping(tmpl.column_mapping);
    }
  }

  async function saveTemplate() {
    if (!templateName.trim()) return;
    setTemplateSaving(true);
    const { data, error } = await supabase
      .from('import_templates')
      .insert({
        name: templateName.trim(),
        source: templateSource.trim() || 'CSV',
        column_mapping: columnMapping,
      })
      .select()
      .single();

    if (!error && data) {
      setTemplates((prev) => [...prev, data as ImportTemplate]);
      setSelectedTemplateId((data as ImportTemplate).id);
    }
    setShowSaveTemplate(false);
    setTemplateName('');
    setTemplateSource('');
    setTemplateSaving(false);
  }

  function getMappedValue(row: string[], fieldKey: string): string {
    const csvCol = columnMapping[fieldKey] || '';
    const idx = csvHeaders.indexOf(csvCol);
    let val = idx >= 0 ? row[idx] ?? '' : '';

    // handle name combine
    if (fieldKey === 'owner_name' && !val && nameCombine) {
      const firstIdx = csvHeaders.indexOf(nameCombine.first);
      const lastIdx = csvHeaders.indexOf(nameCombine.last);
      const first = firstIdx >= 0 ? row[firstIdx] ?? '' : '';
      const last = lastIdx >= 0 ? row[lastIdx] ?? '' : '';
      val = [first, last].filter(Boolean).join(' ');
    }

    return val;
  }

  function getValidationSummary() {
    const totalRows = csvRows.length;
    const validRows = csvRows.filter(
      (row) => getMappedValue(row, 'property_address').trim().length > 0
    ).length;
    const missingData = totalRows - validRows;
    return { totalRows, validRows, missingData, readyToImport: validRows };
  }

  async function runDedup() {
    setDedupLoading(true);
    const mapped: DedupRow[] = [];

    for (const row of csvRows) {
      const obj: Record<string, string> = {};
      for (const field of IMPORT_SYSTEM_FIELDS) {
        obj[field.key] = getMappedValue(row, field.key);
      }

      const addr = obj.property_address?.trim();
      let existingId: string | null = null;

      if (addr) {
        const { data } = await supabase
          .from('leads')
          .select('id')
          .ilike('property_address', addr)
          .limit(1);
        if (data && data.length > 0) {
          existingId = data[0].id;
        }
      }

      mapped.push({
        mapped: obj,
        existingId,
        action: existingId ? 'update' : 'create',
      });
    }

    setDedupRows(mapped);
    setDedupLoading(false);
  }

  function setRowAction(idx: number, action: RowAction) {
    setDedupRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], action };
      return next;
    });
  }

  async function runCsvImport() {
    setCsvImporting(true);
    setCsvResult(null);

    const toProcess = dedupRows.filter((r) => r.action !== 'skip');
    setCsvImportTotal(toProcess.length);
    setCsvImportProgress(0);

    let imported = 0;
    let updated = 0;
    let errors = 0;
    const skipped = dedupRows.filter((r) => r.action === 'skip').length;

    for (let i = 0; i < toProcess.length; i++) {
      const { mapped, existingId, action } = toProcess[i];

      const row: Record<string, unknown> = {
        property_address: mapped.property_address || null,
        owner_name: mapped.owner_name || null,
        name: mapped.owner_name || mapped.name || 'Unknown',
        phone: mapped.phone || null,
        phone_2: mapped.phone_2 || null,
        phone_3: mapped.phone_3 || null,
        email: mapped.email || null,
        city: mapped.city || null,
        state: mapped.state || null,
        zip: mapped.zip || null,
        mailing_address: mapped.mailing_address || null,
        mailing_city: mapped.mailing_city || null,
        mailing_state: mapped.mailing_state || null,
        mailing_zip: mapped.mailing_zip || null,
        price_range: mapped.price_range || null,
        property_condition: mapped.property_condition || null,
        notes: mapped.notes || null,
        source: mapped.source || 'CSV Import',
        status: (LEAD_STATUSES as readonly string[]).includes(mapped.status)
          ? mapped.status
          : 'New',
      };

      // latitude / longitude
      if (mapped.latitude) row.latitude = parseFloat(mapped.latitude) || null;
      if (mapped.longitude) row.longitude = parseFloat(mapped.longitude) || null;

      if (action === 'update' && existingId) {
        const { error } = await supabase
          .from('leads')
          .update(row)
          .eq('id', existingId);
        if (error) errors++;
        else updated++;
      } else {
        const { error } = await supabase.from('leads').insert(row);
        if (error) errors++;
        else imported++;
      }

      setCsvImportProgress(i + 1);
    }

    // geocode
    const needGeocode = toProcess.filter(
      (r) =>
        r.mapped.property_address &&
        !r.mapped.latitude &&
        !r.mapped.longitude
    );

    setCsvGeocodeTotal(needGeocode.length);
    setCsvGeocodeProgress(0);

    let geocoded = 0;
    const chunkSize = 25;

    for (let i = 0; i < needGeocode.length; i += chunkSize) {
      const chunk = needGeocode.slice(i, i + chunkSize);
      const addresses = chunk.map((r) =>
        [r.mapped.property_address, r.mapped.city, r.mapped.state, r.mapped.zip]
          .filter(Boolean)
          .join(', ')
      );

      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses }),
        });
        if (res.ok) {
          const results = await res.json();
          const geoArr = Array.isArray(results) ? results : results.results ?? [];
          for (const geo of geoArr) {
            if (geo.lat && geo.lng && geo.address) {
              await supabase
                .from('leads')
                .update({
                  latitude: geo.lat,
                  longitude: geo.lng,
                  geocoded_at: new Date().toISOString(),
                })
                .ilike('property_address', `%${geo.address.split(',')[0]}%`);
              geocoded++;
            }
          }
        }
      } catch {
        /* non-fatal */
      }

      setCsvGeocodeProgress(Math.min(i + chunkSize, needGeocode.length));
    }

    setCsvResult({ imported, updated, skipped, geocoded, errors });
    setCsvImporting(false);
  }

  function resetCsv() {
    setCsvStep('upload');
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setNameCombine(null);
    setDedupRows([]);
    setCsvResult(null);
    setCsvImportProgress(0);
    setCsvImportTotal(0);
    setCsvGeocodeProgress(0);
    setCsvGeocodeTotal(0);
    setSelectedTemplateId('');
  }

  /* ==================== RENDER ==================== */

  const validation = getValidationSummary();

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface">
          Import Leads
        </h1>
        <p className="mt-1 text-secondary">
          Paste unstructured text for AI parsing or upload a structured CSV file.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="mb-8 flex gap-2">
        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all',
            activeTab === 'ai'
              ? 'bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg'
              : 'border border-slate-200 bg-surface-container-lowest text-slate-600 hover:bg-slate-50'
          )}
        >
          <MaterialIcon icon="auto_awesome" className="text-[18px]" />
          Paste &amp; Parse
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all',
            activeTab === 'csv'
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
              : 'border border-slate-200 bg-surface-container-lowest text-slate-600 hover:bg-slate-50'
          )}
        >
          <MaterialIcon icon="upload_file" className="text-[18px]" />
          CSV Upload
        </button>
        <button
          onClick={() => setActiveTab('mls')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all',
            activeTab === 'mls'
              ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg'
              : 'border border-slate-200 bg-surface-container-lowest text-slate-600 hover:bg-slate-50'
          )}
        >
          <MaterialIcon icon="real_estate_agent" className="text-[18px]" />
          MLS Import
        </button>
      </div>

      {/* ============================== AI TAB ============================== */}
      {activeTab === 'ai' && (
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Input area */}
          <div className="glass-card rounded-2xl p-6">
            <label className="mb-2 block text-sm font-bold text-on-surface">
              Paste property data
            </label>
            <textarea
              rows={10}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste MLS data, RPR reports, property lists, or any text with property information..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Source
                </label>
                <select
                  value={aiSource}
                  onChange={(e) => setAiSource(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Auto-detect</option>
                  <option value="MLS">MLS</option>
                  <option value="RPR">RPR</option>
                  <option value="PropWire">PropWire</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex-1" />

              <button
                onClick={handleAiParse}
                disabled={!aiText.trim() || aiParsing}
                className={cn(
                  'action-gradient flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl',
                  (!aiText.trim() || aiParsing) && 'cursor-not-allowed opacity-50'
                )}
              >
                {aiParsing ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Parsing with AI...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="auto_awesome" className="text-[18px]" />
                    AI Parse
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4">
                <MaterialIcon icon="error" className="text-[20px] text-rose-500 mt-0.5" />
                <p className="text-sm text-rose-700">{aiError}</p>
              </div>
            )}
          </div>

          {/* AI Parsed Preview */}
          {aiRecords.length > 0 && !aiResult && (
            <div className="glass-card rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  Parsed Records ({aiRecords.length})
                </h3>
                <span className="text-sm text-slate-500">
                  {aiSelected.size} selected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={aiSelected.size === aiRecords.length}
                          onChange={toggleAiAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                      {AI_PREVIEW_COLS.map((col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiRecords.map((rec, ri) => (
                      <tr
                        key={ri}
                        className={cn(
                          'border-b border-slate-100',
                          !aiSelected.has(ri) && 'opacity-40'
                        )}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={aiSelected.has(ri)}
                            onChange={() => toggleAiRow(ri)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        {AI_PREVIEW_COLS.map((col) => (
                          <td key={col} className="px-3 py-1">
                            <input
                              value={rec[col] || ''}
                              onChange={(e) =>
                                handleAiCellEdit(ri, col, e.target.value)
                              }
                              className="w-full min-w-[80px] rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleAiImport}
                  disabled={aiSelected.size === 0 || aiImporting}
                  className={cn(
                    'action-gradient flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl',
                    (aiSelected.size === 0 || aiImporting) &&
                      'cursor-not-allowed opacity-50'
                  )}
                >
                  <MaterialIcon icon="download" className="text-[18px]" />
                  Import Selected ({aiSelected.size})
                </button>
              </div>
            </div>
          )}

          {/* AI Import Progress */}
          {aiImporting && (
            <div className="space-y-4">
              {aiGeocodeTotal > 0 ? (
                <ImportProgress current={aiGeocodeProgress} total={aiGeocodeTotal} phase="geocoding" label="Pinpointing properties on the map..." />
              ) : (
                <ImportProgress current={aiImportProgress} total={aiImportTotal} phase="processing" label="AI is parsing your data..." />
              )}
            </div>
          )}

          {/* AI Results */}
          {aiResult && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <MaterialIcon
                  icon="check_circle"
                  className="text-[40px] text-emerald-500"
                  filled
                />
              </div>
              <h3 className="font-headline text-xl font-extrabold text-on-surface">
                Import Complete
              </h3>
              <p className="mt-1 text-sm text-secondary">
                {aiResult.imported} records imported, {aiResult.geocoded}{' '}
                geocoded, {aiResult.errors} errors
              </p>

              <div className="my-6 flex justify-center gap-4">
                <div className="rounded-xl bg-emerald-50 px-6 py-3">
                  <p className="text-2xl font-extrabold text-emerald-600">
                    {aiResult.imported}
                  </p>
                  <p className="text-xs font-medium text-emerald-500">
                    Imported
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 px-6 py-3">
                  <p className="text-2xl font-extrabold text-blue-600">
                    {aiResult.geocoded}
                  </p>
                  <p className="text-xs font-medium text-blue-500">Geocoded</p>
                </div>
                {aiResult.errors > 0 && (
                  <div className="rounded-xl bg-rose-50 px-6 py-3">
                    <p className="text-2xl font-extrabold text-rose-600">
                      {aiResult.errors}
                    </p>
                    <p className="text-xs font-medium text-rose-500">Errors</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4">
                <a
                  href="/leads"
                  className="action-gradient rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                >
                  <MaterialIcon
                    icon="group"
                    className="mr-2 text-[16px] align-middle"
                  />
                  View Leads
                </a>
                <button
                  onClick={() => {
                    setAiText('');
                    setAiRecords([]);
                    setAiResult(null);
                    setAiSelected(new Set());
                  }}
                  className="rounded-xl border border-slate-300 px-8 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <MaterialIcon
                    icon="refresh"
                    className="mr-2 text-[16px] align-middle"
                  />
                  Parse More
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {aiRecords.length === 0 && !aiParsing && !aiResult && !aiError && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <MaterialIcon
                icon="auto_awesome"
                className="text-[48px] text-slate-300"
              />
              <p className="mt-3 text-sm text-slate-400">
                Paste property data above and click &quot;AI Parse&quot; to
                extract structured records.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================== CSV TAB ============================== */}
      {activeTab === 'csv' && (
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Step indicator */}
          {csvFile && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
              {(['upload', 'mapping', 'preview', 'import'] as CsvStep[]).map(
                (step, i) => {
                  const labels = ['Upload', 'Map Columns', 'Preview', 'Import'];
                  const steps: CsvStep[] = ['upload', 'mapping', 'preview', 'import'];
                  const currentIdx = steps.indexOf(csvStep);
                  const isActive = csvStep === step;
                  const isDone = currentIdx > i;
                  return (
                    <div key={step} className="flex items-center">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-blue-600 text-white'
                              : 'border-2 border-slate-300 text-slate-400'
                        )}
                      >
                        {isDone ? (
                          <MaterialIcon icon="check" className="text-[14px]" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span
                        className={cn(
                          'ml-1.5 mr-3',
                          isActive
                            ? 'text-blue-600'
                            : isDone
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                        )}
                      >
                        {labels[i]}
                      </span>
                      {i < 3 && (
                        <div
                          className={cn(
                            'h-0.5 w-8',
                            isDone ? 'bg-emerald-400' : 'bg-slate-200'
                          )}
                        />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          {/* ---- Step 1: Upload ---- */}
          {csvStep === 'upload' && (
            <>
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
                    <p className="text-lg font-semibold text-emerald-700">
                      {csvFile.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {csvRows.length} rows detected with {csvHeaders.length}{' '}
                      columns
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
                <>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
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
                                  {cell || (
                                    <span className="text-slate-300">--</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setCsvStep('mapping')}
                      className="action-gradient rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                    >
                      Continue to Mapping
                      <MaterialIcon
                        icon="arrow_forward"
                        className="ml-2 text-[16px] align-middle"
                      />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ---- Step 2: Column Mapping ---- */}
          {csvStep === 'mapping' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Validation summary */}
              <div className="lg:col-span-4 space-y-6">
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
                    Validation Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-blue-50 p-4 text-center">
                      <p className="text-2xl font-extrabold text-blue-600">
                        {validation.totalRows}
                      </p>
                      <p className="mt-1 text-xs font-medium text-blue-500">
                        Total Rows
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4 text-center">
                      <p className="text-2xl font-extrabold text-emerald-600">
                        {validation.validRows}
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-500">
                        Valid (has address)
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4 text-center">
                      <p className="text-2xl font-extrabold text-amber-600">
                        {validation.missingData}
                      </p>
                      <p className="mt-1 text-xs font-medium text-amber-500">
                        Missing Data
                      </p>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-4 text-center">
                      <p className="text-2xl font-extrabold text-violet-600">
                        {validation.readyToImport}
                      </p>
                      <p className="mt-1 text-xs font-medium text-violet-500">
                        Ready to Import
                      </p>
                    </div>
                  </div>
                </div>

                {/* Name combine notice */}
                {nameCombine && (
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                    <MaterialIcon
                      icon="info"
                      className="text-[20px] text-blue-500 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-700">
                        Name Combine Detected
                      </p>
                      <p className="text-xs text-blue-600">
                        &quot;{nameCombine.first}&quot; + &quot;{nameCombine.last}
                        &quot; will be combined into Owner Name.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mapping table */}
              <div className="lg:col-span-8">
                <div className="glass-card rounded-2xl p-6">
                  {/* Template selector */}
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Template
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">-- No Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.source})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <MaterialIcon
                        icon="save"
                        className="mr-1 text-[16px] align-middle"
                      />
                      Save as Template
                    </button>
                  </div>

                  {/* Save template inline form */}
                  {showSaveTemplate && (
                    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">
                          Template Name
                        </label>
                        <input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="e.g. PropWire Standard"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">
                          Source
                        </label>
                        <input
                          value={templateSource}
                          onChange={(e) => setTemplateSource(e.target.value)}
                          placeholder="e.g. PropWire"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <button
                        onClick={saveTemplate}
                        disabled={!templateName.trim() || templateSaving}
                        className={cn(
                          'action-gradient rounded-lg px-4 py-2 text-sm font-bold text-white',
                          (!templateName.trim() || templateSaving) &&
                            'cursor-not-allowed opacity-50'
                        )}
                      >
                        {templateSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setShowSaveTemplate(false)}
                        className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

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
                            CSV Column
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Sample Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {IMPORT_SYSTEM_FIELDS.map((field) => {
                          const selectedCol = columnMapping[field.key] || '';
                          const colIdx = csvHeaders.indexOf(selectedCol);
                          const sample =
                            colIdx >= 0 && csvRows[0]
                              ? csvRows[0][colIdx] ?? ''
                              : '';
                          return (
                            <tr
                              key={field.key}
                              className="border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {field.label}
                                {field.required && (
                                  <span className="ml-1 text-rose-500">*</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={selectedCol}
                                  onChange={(e) =>
                                    setColumnMapping((prev) => ({
                                      ...prev,
                                      [field.key]: e.target.value,
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
                                  <span className="text-slate-300">
                                    No data
                                  </span>
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

              {/* Nav buttons */}
              <div className="lg:col-span-12 flex items-center gap-4">
                <button
                  onClick={() => setCsvStep('upload')}
                  className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <MaterialIcon
                    icon="arrow_back"
                    className="mr-2 text-[16px] align-middle"
                  />
                  Back
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setCsvStep('preview');
                    runDedup();
                  }}
                  className="action-gradient rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                >
                  Preview &amp; Dedup
                  <MaterialIcon
                    icon="arrow_forward"
                    className="ml-2 text-[16px] align-middle"
                  />
                </button>
              </div>
            </div>
          )}

          {/* ---- Step 3: Preview & Dedup ---- */}
          {csvStep === 'preview' && (
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-headline text-lg font-bold text-on-surface">
                    Preview &amp; Deduplication
                  </h3>
                  {!dedupLoading && dedupRows.length > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                        New ({dedupRows.filter((r) => !r.existingId).length})
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
                        Match (
                        {dedupRows.filter((r) => r.existingId).length})
                      </span>
                    </div>
                  )}
                </div>

                {dedupLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="mr-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span className="text-sm text-slate-500">
                      Checking for duplicates...
                    </span>
                  </div>
                ) : dedupRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Address
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Owner
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Phone
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            City
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dedupRows.map((row, i) => (
                          <tr
                            key={i}
                            className={cn(
                              'border-b border-slate-100',
                              row.existingId
                                ? 'bg-amber-50/50'
                                : 'bg-emerald-50/30',
                              row.action === 'skip' && 'opacity-40'
                            )}
                          >
                            <td className="px-3 py-2">
                              {row.existingId ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                  Match
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                  New
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {row.mapped.property_address || '--'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.mapped.owner_name || '--'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.mapped.phone || '--'}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.mapped.city || '--'}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.action}
                                onChange={(e) =>
                                  setRowAction(
                                    i,
                                    e.target.value as RowAction
                                  )
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold focus:border-blue-400 focus:outline-none"
                              >
                                <option value="create">Create New</option>
                                {row.existingId && (
                                  <option value="update">
                                    Update Existing
                                  </option>
                                )}
                                <option value="skip">Skip</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No rows to preview.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCsvStep('mapping')}
                  className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <MaterialIcon
                    icon="arrow_back"
                    className="mr-2 text-[16px] align-middle"
                  />
                  Back
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setCsvStep('import');
                    runCsvImport();
                  }}
                  disabled={
                    dedupLoading ||
                    dedupRows.filter((r) => r.action !== 'skip').length === 0
                  }
                  className={cn(
                    'action-gradient rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl',
                    (dedupLoading ||
                      dedupRows.filter((r) => r.action !== 'skip').length ===
                        0) &&
                      'cursor-not-allowed opacity-50'
                  )}
                >
                  Import All
                  <MaterialIcon
                    icon="rocket_launch"
                    className="ml-2 text-[16px] align-middle"
                  />
                </button>
              </div>
            </div>
          )}

          {/* ---- Step 4: Import & Geocode ---- */}
          {csvStep === 'import' && (
            <div className="mx-auto max-w-2xl space-y-6">
              {csvImporting && (
                <div className="space-y-4">
                  {csvGeocodeTotal > 0 ? (
                    <ImportProgress current={csvGeocodeProgress} total={csvGeocodeTotal} phase="geocoding" label="Pinpointing properties on the map..." />
                  ) : (
                    <ImportProgress current={csvImportProgress} total={csvImportTotal} phase="importing" label="Importing your property list..." />
                  )}
                </div>
              )}

              {csvResult && (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
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

                  <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div className="rounded-xl bg-emerald-50 p-4">
                      <p className="text-2xl font-extrabold text-emerald-600">
                        {csvResult.imported}
                      </p>
                      <p className="text-xs font-medium text-emerald-500">
                        Created
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-2xl font-extrabold text-blue-600">
                        {csvResult.updated}
                      </p>
                      <p className="text-xs font-medium text-blue-500">
                        Updated
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-2xl font-extrabold text-slate-600">
                        {csvResult.skipped}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Skipped
                      </p>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-4">
                      <p className="text-2xl font-extrabold text-violet-600">
                        {csvResult.geocoded}
                      </p>
                      <p className="text-xs font-medium text-violet-500">
                        Geocoded
                      </p>
                    </div>
                    {csvResult.errors > 0 && (
                      <div className="rounded-xl bg-rose-50 p-4">
                        <p className="text-2xl font-extrabold text-rose-600">
                          {csvResult.errors}
                        </p>
                        <p className="text-xs font-medium text-rose-500">
                          Errors
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <a
                      href="/leads"
                      className="action-gradient rounded-xl px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
                    >
                      <MaterialIcon
                        icon="group"
                        className="mr-2 text-[16px] align-middle"
                      />
                      View Leads
                    </a>
                    <button
                      onClick={resetCsv}
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
              )}
            </div>
          )}
        </div>
      )}
      {/* ============================== MLS TAB ============================== */}
      {activeTab === 'mls' && <MlsImportTab />}
    </div>
  );
}

/* ============================================================
   MLS IMPORT TAB — handles MLS CSV format (Status, Address, Listing Price, etc.)
   ============================================================ */
function MlsImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ updated: number; inserted: number; geocoded: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const STATUS_MAP: Record<string, string> = { S: 'Sold', A: 'Active', T: 'Pending' };

  function parseDate(str: string): string | null {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [m, d, rawY] = parts.map(Number);
    const y = rawY < 100 ? rawY + 2000 : rawY;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) return;
      const headers = parseLine(lines[0]);
      const parsed: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseLine(line);
        if (values.length === headers.length) {
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx]; });
          parsed.push(row);
        }
      }
      setRows(parsed);
    };
    reader.readAsText(f);
  }

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  function normalizeAddr(addr: string): string {
    return addr.replace(/,\s*CA\s+\d{5}(-\d{4})?/i, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  async function runImport() {
    setImporting(true);
    let updated = 0, inserted = 0, geocoded = 0, errors = 0;
    setProgress(0);

    // Get existing leads for matching
    const { data: existingLeads } = await supabase.from('leads').select('id, property_address');
    const addrMap = new Map<string, string>();
    (existingLeads || []).forEach((l) => {
      if (l.property_address) addrMap.set(normalizeAddr(l.property_address), l.id);
    });

    for (const row of rows) {
      const address = row['Address'] || '';
      if (!address) continue;

      const parts = address.split(',').map((s: string) => s.trim());
      const street = parts[0] || address;
      const city = parts[1] || 'Lemoore';
      const stateZip = (parts[2] || '').split(' ').filter(Boolean);
      const state = stateZip[0] || 'CA';
      const zip = stateZip[1]?.replace(/-\d+$/, '') || '';

      const listingStatus = STATUS_MAP[row['Status']] || row['Status'] || null;
      const listingPrice = Number(row['Listing Price']) || null;
      const sellingPrice = Number(row['Selling Price']) || null;
      const dom = Number(row['DOM']) || null;
      const sqft = Number(row['Square Footage']) || null;
      const lotAcres = Number(row['Lot Size - Acres']) || null;
      const yearBuilt = Number(row['Year Built']) || null;

      const mlsFields = {
        listing_status: listingStatus,
        listing_price: listingPrice,
        selling_price: sellingPrice,
        dom,
        listing_date: parseDate(row['Listing Date'] || ''),
        pending_date: parseDate(row['Pending Date'] || ''),
        selling_date: parseDate(row['Selling Date'] || ''),
        sqft,
        lot_acres: lotAcres,
        year_built: yearBuilt,
      };

      const normAddr = normalizeAddr(address);
      const existingId = addrMap.get(normAddr);

      if (existingId) {
        const { error } = await supabase.from('leads').update(mlsFields).eq('id', existingId);
        if (error) errors++; else updated++;
        setProgress(p => p + 1);
      } else {
        const { data, error } = await supabase.from('leads').insert({
          property_address: address,
          name: street,
          city, state, zip,
          source: 'MLS',
          status: 'new' as const,
          priority: 'medium',
          price_range: sellingPrice ? `$${sellingPrice.toLocaleString()}` : (listingPrice ? `$${listingPrice.toLocaleString()}` : null),
          ...mlsFields,
        }).select('id, property_address');
        if (error) { errors++; setProgress(p => p + 1); } else {
          inserted++;
          setProgress(p => p + 1);
          if (data?.[0]) addrMap.set(normAddr, data[0].id);
          // Geocode
          if (data?.[0]) {
            try {
              const geoRes = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
              });
              if (geoRes.ok) {
                const geo = await geoRes.json();
                if (geo.lat && geo.lng) {
                  await supabase.from('leads').update({
                    latitude: geo.lat, longitude: geo.lng, geocoded_at: new Date().toISOString(),
                  }).eq('id', data[0].id);
                  geocoded++;
                }
              }
            } catch { /* non-fatal */ }
          }
        }
      }
    }

    setResult({ updated, inserted, geocoded, errors });
    setImporting(false);
  }

  const soldCount = rows.filter(r => r['Status'] === 'S').length;
  const activeCount = rows.filter(r => r['Status'] === 'A').length;
  const pendingCount = rows.filter(r => r['Status'] === 'T').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold font-headline mb-2">MLS Listing Import</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload MLS export CSVs with columns: Status, Address, Listing Price, Selling Price, Year Built, Square Footage, Lot Size, Listing Date, Selling Date, DOM.
          Matching addresses will be updated, new ones will be created and geocoded.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {!file ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 py-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all"
          >
            <MaterialIcon icon="upload_file" className="text-[48px] text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-500">Click to select MLS CSV file</p>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{file.name}</p>
                <p className="text-xs text-slate-500">{rows.length} properties found</p>
              </div>
              <button onClick={() => { setFile(null); setRows([]); setResult(null); }}
                className="text-xs text-red-500 hover:underline">Clear</button>
            </div>

            {/* Preview stats */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{soldCount}</p>
                <p className="text-[10px] font-bold text-green-500 uppercase">Sold</p>
              </div>
              <div className="flex-1 rounded-xl bg-orange-50 border border-orange-200 p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{activeCount}</p>
                <p className="text-[10px] font-bold text-orange-500 uppercase">Active</p>
              </div>
              <div className="flex-1 rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
                <p className="text-[10px] font-bold text-yellow-500 uppercase">Pending</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Status</th>
                    <th className="px-3 py-2 text-left font-bold">Address</th>
                    <th className="px-3 py-2 text-right font-bold">List $</th>
                    <th className="px-3 py-2 text-right font-bold">Sold $</th>
                    <th className="px-3 py-2 text-right font-bold">DOM</th>
                    <th className="px-3 py-2 text-right font-bold">Sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                          r['Status'] === 'S' ? 'bg-green-100 text-green-700' :
                          r['Status'] === 'A' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        )}>{STATUS_MAP[r['Status']] || r['Status']}</span>
                      </td>
                      <td className="px-3 py-1.5 font-medium">{r['Address']?.split(',')[0]}</td>
                      <td className="px-3 py-1.5 text-right">${Number(r['Listing Price']).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">{Number(r['Selling Price']) > 0 ? `$${Number(r['Selling Price']).toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{r['DOM']}</td>
                      <td className="px-3 py-1.5 text-right">{Number(r['Square Footage']).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!result ? (
              importing ? (
                <ImportProgress current={progress} total={rows.length} phase="importing" label="Importing MLS data & geocoding..." />
              ) : (
                <button
                  onClick={runImport}
                  className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white py-3 font-bold text-sm hover:shadow-lg transition-all"
                >
                  Import {rows.length} MLS Entries
                </button>
              )
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="font-bold text-emerald-800">Import Complete</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-emerald-700"><strong>{result.updated}</strong> updated</span>
                  <span className="text-blue-700"><strong>{result.inserted}</strong> new</span>
                  <span className="text-violet-700"><strong>{result.geocoded}</strong> geocoded</span>
                  {result.errors > 0 && <span className="text-red-600"><strong>{result.errors}</strong> errors</span>}
                </div>
                <button onClick={() => { setFile(null); setRows([]); setResult(null); }}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline">Import Another</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
