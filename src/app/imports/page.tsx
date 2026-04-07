'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ImportProgress from '@/components/ui/ImportProgress';
import ImportMiniMap from '@/components/map/ImportMiniMapDynamic';
import { useAuth } from '@/lib/auth-context';

/* ================================================================
   UNIFIED IMPORT PAGE
   "Drop any list. We figure out the rest."
   ================================================================ */

type ImportPhase = 'idle' | 'detecting' | 'preview' | 'importing' | 'geocoding' | 'done';

interface DetectedField {
  systemField: string;
  csvHeader: string;
  sampleValue: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  geocoded: number;
  errors: number;
  total: number;
}

// ── Column auto-detection ──
const FIELD_MATCHERS: { field: string; label: string; test: (h: string) => boolean }[] = [
  { field: 'property_address', label: 'Property Address', test: (h) => /address/i.test(h) && !/mail/i.test(h) },
  { field: 'owner_name', label: 'Owner Name', test: (h) => /owner.*(?:first|last|name)/i.test(h) || h.toLowerCase() === 'owner 1 first name' },
  { field: 'name', label: 'Contact Name', test: (h) => /^name\s*1?$/i.test(h) || /contact.*name/i.test(h) },
  { field: 'phone', label: 'Phone', test: (h) => /phone\s*1?$/i.test(h) && !/2|3/i.test(h) },
  { field: 'phone_2', label: 'Phone 2', test: (h) => /phone.*2/i.test(h) },
  { field: 'phone_3', label: 'Phone 3', test: (h) => /phone.*3/i.test(h) },
  { field: 'email', label: 'Email', test: (h) => /email/i.test(h) },
  { field: 'mailing_address', label: 'Mailing Address', test: (h) => /mail.*address/i.test(h) },
  { field: 'mailing_city', label: 'Mailing City', test: (h) => /mail.*city/i.test(h) },
  { field: 'mailing_state', label: 'Mailing State', test: (h) => /mail.*state/i.test(h) },
  { field: 'mailing_zip', label: 'Mailing Zip', test: (h) => /mail.*zip/i.test(h) },
  { field: 'city', label: 'City', test: (h) => /^city$/i.test(h) },
  { field: 'state', label: 'State', test: (h) => /^state$/i.test(h) },
  { field: 'zip', label: 'Zip', test: (h) => /^zip$/i.test(h) || /postal/i.test(h) },
  { field: 'price_range', label: 'Price / Value', test: (h) => /price|value|estimated/i.test(h) },
  { field: 'property_condition', label: 'Property Type', test: (h) => /property.*type|property.*use|condition/i.test(h) },
  { field: 'source', label: 'Source', test: (h) => /^source$/i.test(h) },
  { field: 'notes', label: 'Notes', test: (h) => /note/i.test(h) },
  // MLS-specific fields
  { field: 'listing_status', label: 'Listing Status', test: (h) => /^status$/i.test(h) },
  { field: 'listing_price', label: 'Listing Price', test: (h) => /listing.*price/i.test(h) },
  { field: 'selling_price', label: 'Selling Price', test: (h) => /selling.*price/i.test(h) },
  { field: 'dom', label: 'Days on Market', test: (h) => /^dom$/i.test(h) || /days.*market/i.test(h) },
  { field: 'sqft', label: 'Square Footage', test: (h) => /sq.*ft|square.*f/i.test(h) || /living.*sq/i.test(h) },
  { field: 'year_built', label: 'Year Built', test: (h) => /year.*built/i.test(h) },
  { field: 'lot_acres', label: 'Lot Size', test: (h) => /lot.*acre|lot.*size/i.test(h) },
  { field: 'listing_date', label: 'Listing Date', test: (h) => /listing.*date/i.test(h) },
  { field: 'selling_date', label: 'Selling Date', test: (h) => /selling.*date/i.test(h) },
];

// ── CSV Parser ──
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      rows.push(row);
    }
  }
  return { headers, rows };
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

function parseDate(str: string): string | null {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [m, d, rawY] = parts.map(Number);
  const y = rawY < 100 ? rawY + 2000 : rawY;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Detect format type ──
function detectFormat(headers: string[]): 'mls' | 'propwire' | 'generic' {
  const h = headers.map(s => s.toLowerCase());
  if (h.some(x => x === 'dom' || /days.*market/i.test(x)) && h.some(x => /selling.*price|listing.*price/i.test(x))) return 'mls';
  if (h.some(x => /owner.*first/i.test(x)) && h.some(x => /phone.*1/i.test(x))) return 'propwire';
  return 'generic';
}

// ── Map status codes ──
const STATUS_MAP: Record<string, string> = { S: 'Sold', A: 'Active', T: 'Pending' };

export default function ImportsPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [dragActive, setDragActive] = useState(false);

  // Detected data
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<'mls' | 'propwire' | 'generic'>('generic');
  // Headers tracked internally, not rendered directly
  const [, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mappedFields, setMappedFields] = useState<DetectedField[]>([]);

  // AI parse
  const [pasteText, setPasteText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);

  // Progress
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState<'importing' | 'geocoding' | 'processing'>('importing');
  const [progressLabel, setProgressLabel] = useState('');

  // Result
  const [result, setResult] = useState<ImportResult | null>(null);

  // Live geocode map
  const [geocodedPins, setGeocodedPins] = useState<{ lat: number; lng: number; color: string }[]>([]);

  // Overage prompt
  const [overagePrompt, setOveragePrompt] = useState<{ remaining: number; cost: string; isFree: boolean } | null>(null);
  const [overageLoading, setOverageLoading] = useState(false);

  // ── Handle file drop/select ──
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setPhase('detecting');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
  }, []);

  // ── Handle paste ──
  const handlePaste = useCallback(async () => {
    if (!pasteText.trim()) return;

    // Try to parse as CSV first
    const lines = pasteText.trim().split('\n');
    if (lines.length > 1 && lines[0].includes(',')) {
      setPhase('detecting');
      processCSV(pasteText);
      return;
    }

    // Otherwise, use AI to parse unstructured text
    setAiParsing(true);
    setPhase('detecting');
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) throw new Error('AI parse failed');
      const data = await res.json();
      const records = Array.isArray(data) ? data : data.records || [];

      if (records.length > 0) {
        // Convert AI output to our format
        const aiHdrs = Object.keys(records[0]);
        const aiRows = records.map((r: Record<string, string>) => r);
        setHeaders(aiHdrs);
        setRows(aiRows);
        setFormat('generic');
        setFileName('AI Parsed Data');
        autoDetect(aiHdrs, aiRows);
        setPhase('preview');
      }
    } catch {
      // Fallback — show error
    } finally {
      setAiParsing(false);
    }
  }, [pasteText]);

  // ── Process CSV text ──
  function processCSV(text: string) {
    const { headers: h, rows: r } = parseCSV(text);
    if (h.length === 0 || r.length === 0) { setPhase('idle'); return; }
    setHeaders(h);
    setRows(r);
    const fmt = detectFormat(h);
    setFormat(fmt);
    autoDetect(h, r);
    setPhase('preview');
  }

  // ── Auto-detect column mapping ──
  function autoDetect(hdrs: string[], rws: Record<string, string>[]) {
    const detected: DetectedField[] = [];
    const sample = rws[0] || {};

    // Special handling: combine Owner First + Last name
    const ownerFirst = hdrs.find(h => /owner.*first/i.test(h));
    const ownerLast = hdrs.find(h => /owner.*last/i.test(h));

    if (ownerFirst && ownerLast) {
      detected.push({
        systemField: 'owner_name',
        csvHeader: `${ownerFirst} + ${ownerLast}`,
        sampleValue: `${sample[ownerFirst] || ''} ${sample[ownerLast] || ''}`.trim(),
      });
    }

    for (const matcher of FIELD_MATCHERS) {
      if (matcher.field === 'owner_name' && ownerFirst && ownerLast) continue;
      const match = hdrs.find(h => matcher.test(h));
      if (match) {
        detected.push({
          systemField: matcher.field,
          csvHeader: match,
          sampleValue: sample[match] || '',
        });
      }
    }
    setMappedFields(detected);
  }

  // ── Run import ──
  async function runImport() {
    setPhase('importing');
    setProgress(0);
    setProgressPhase('importing');
    setProgressLabel('Importing your data...');

    let inserted = 0, updated = 0, geocoded = 0, errors = 0;
    const toGeocode: { id: string; address: string }[] = [];

    // Build lookup for existing addresses
    const { data: existing } = await supabase.from('leads').select('id, property_address');
    const addrMap = new Map<string, string>();
    (existing || []).forEach(l => {
      if (l.property_address) {
        addrMap.set(l.property_address.split(',')[0].trim().toUpperCase(), l.id);
      }
    });

    // Find mapped header for each field
    function getVal(row: Record<string, string>, field: string): string {
      const mapping = mappedFields.find(m => m.systemField === field);
      if (!mapping) return '';
      // Handle combined fields like "Owner 1 First Name + Owner 1 Last Name"
      if (mapping.csvHeader.includes(' + ')) {
        const parts = mapping.csvHeader.split(' + ');
        return parts.map(p => row[p] || '').join(' ').trim();
      }
      return row[mapping.csvHeader] || '';
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const address = getVal(row, 'property_address') || '';
      if (!address) { errors++; setProgress(i + 1); continue; }

      const addrKey = address.split(',')[0].trim().toUpperCase();
      const existingId = addrMap.get(addrKey);

      // Build MLS fields if detected
      const listingStatus = getVal(row, 'listing_status');
      const mlsFields = format === 'mls' || listingStatus ? {
        listing_status: STATUS_MAP[listingStatus] || listingStatus || null,
        listing_price: Number(getVal(row, 'listing_price')) || null,
        selling_price: Number(getVal(row, 'selling_price')) || null,
        dom: Number(getVal(row, 'dom')) || null,
        sqft: Number(getVal(row, 'sqft')) || null,
        lot_acres: Number(getVal(row, 'lot_acres')) || null,
        year_built: Number(getVal(row, 'year_built')) || null,
        listing_date: parseDate(getVal(row, 'listing_date')),
        selling_date: parseDate(getVal(row, 'selling_date')),
      } : {};

      if (existingId) {
        // Update existing
        const updateData: Record<string, unknown> = { ...mlsFields };
        const ownerName = getVal(row, 'owner_name');
        if (ownerName) updateData.owner_name = ownerName;
        const phone = getVal(row, 'phone');
        if (phone) updateData.phone = phone;

        const { error } = await supabase.from('leads').update(updateData).eq('id', existingId);
        if (error) errors++; else updated++;
      } else {
        // Insert new
        const city = getVal(row, 'city') || address.split(',')[1]?.trim() || '';
        const state = getVal(row, 'state') || 'CA';
        const zip = getVal(row, 'zip') || '';
        const ownerName = getVal(row, 'owner_name') || getVal(row, 'name') || '';
        const sellingPrice = Number(getVal(row, 'selling_price')) || null;
        const listingPrice = Number(getVal(row, 'listing_price')) || null;
        const priceRange = getVal(row, 'price_range') || (sellingPrice ? `$${sellingPrice.toLocaleString()}` : listingPrice ? `$${listingPrice.toLocaleString()}` : null);

        const newLead = {
          property_address: address,
          name: ownerName || address.split(',')[0],
          owner_name: ownerName || null,
          phone: getVal(row, 'phone') || null,
          phone_2: getVal(row, 'phone_2') || null,
          phone_3: getVal(row, 'phone_3') || null,
          email: getVal(row, 'email') || null,
          mailing_address: getVal(row, 'mailing_address') || null,
          mailing_city: getVal(row, 'mailing_city') || null,
          mailing_state: getVal(row, 'mailing_state') || null,
          mailing_zip: getVal(row, 'mailing_zip') || null,
          city, state, zip,
          price_range: priceRange,
          property_condition: getVal(row, 'property_condition') || null,
          source: format === 'mls' ? 'MLS' : 'PropWire',
          status: 'new' as const,
          priority: 'medium',
          notes: getVal(row, 'notes') || null,
          user_id: user?.id || null,
          ...mlsFields,
        };

        const { data, error } = await supabase.from('leads').insert(newLead).select('id, property_address');
        if (error) errors++; else {
          inserted++;
          if (data?.[0]) {
            addrMap.set(addrKey, data[0].id);
            toGeocode.push({ id: data[0].id, address });
          }
        }
      }
      setProgress(i + 1);
    }

    // Check geocode usage before geocoding
    if (toGeocode.length > 0) {
      let usageRes;
      try { usageRes = await fetch('/api/usage').then(r => r.json()); } catch { usageRes = { geocodes_remaining: 0, is_free: true }; }
      const remaining = usageRes.geocodes_remaining ?? 0;
      const isFreeUser = usageRes.is_free ?? true;

      const canGeocode = Math.min(toGeocode.length, remaining);
      const overCount = toGeocode.length - canGeocode;

      // Geocode what we can
      if (canGeocode > 0) {
        setProgressPhase('geocoding');
        setProgressLabel('Pinpointing properties on the map...');
        setProgress(0);

        for (let i = 0; i < canGeocode; i++) {
          try {
            const res = await fetch('/api/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: toGeocode[i].address }),
            });
            if (res.ok) {
              const geo = await res.json();
              if (geo.lat && geo.lng) {
                await supabase.from('leads').update({
                  latitude: geo.lat, longitude: geo.lng, geocoded_at: new Date().toISOString(),
                }).eq('id', toGeocode[i].id);
                geocoded++;
                setGeocodedPins(prev => [...prev, { lat: geo.lat, lng: geo.lng, color: '#3b82f6' }]);
              }
            }
          } catch { /* non-fatal */ }
          setProgress(i + 1);
        }

        // Track usage
        try { await fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: canGeocode }) }); } catch { /* non-fatal */ }
      }

      // Show overage/upgrade prompt if needed
      if (overCount > 0) {
        setOveragePrompt({ remaining: overCount, cost: `$${(overCount * 0.01).toFixed(2)}`, isFree: isFreeUser });
        setResult({ inserted, updated, geocoded, errors, total: rows.length });
        setPhase('done');
        return;
      }
    }

    setResult({ inserted, updated, geocoded, errors, total: rows.length });
    setPhase('done');
  }

  // ── Reset ──
  function reset() {
    setPhase('idle');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMappedFields([]);
    setResult(null);
    setProgress(0);
    setPasteText('');
    setGeocodedPins([]);
  }

  // ── Derived stats ──
  const formatLabel = format === 'mls' ? 'MLS Listing Data' : format === 'propwire' ? 'Property List (PropWire format)' : 'Property Data';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-extrabold">Import Leads</h1>
        <p className="text-slate-500 mt-1">Drop any list. We figure out the rest.</p>
      </div>

      {/* ═══ IDLE: Drop zone + paste ═══ */}
      {phase === 'idle' && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            className={cn(
              'rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer',
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }} />
            <MaterialIcon icon="cloud_upload" className="text-[56px] text-blue-400 mb-4" />
            <p className="text-lg font-bold text-slate-700">Drop your CSV file here</p>
            <p className="text-sm text-slate-400 mt-1">PropWire, BatchLeads, MLS exports, county records — any format</p>
            <p className="text-xs text-slate-400 mt-4">or click to browse</p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-slate-400 font-medium">or paste text</span></div>
          </div>

          {/* Paste area */}
          <div className="glass-card rounded-2xl p-6">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              placeholder="Paste MLS data, RPR reports, property lists, or any text with property information..."
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim() || aiParsing}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg transition-all disabled:opacity-50"
              >
                <MaterialIcon icon="auto_awesome" className="text-[18px]" />
                {aiParsing ? 'Analyzing...' : 'Smart Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETECTING: Loading ═══ */}
      {phase === 'detecting' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-lg font-bold text-slate-700">Analyzing your data...</p>
          <p className="text-sm text-slate-400 mt-1">Auto-detecting columns and format</p>
        </div>
      )}

      {/* ═══ PREVIEW: Show what we found ═══ */}
      {phase === 'preview' && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <MaterialIcon icon="check_circle" className="text-[24px] text-emerald-500" />
                  <h3 className="text-xl font-bold text-slate-900">Ready to Import</h3>
                </div>
                <p className="text-sm text-slate-500 ml-9">{fileName} · {rows.length} properties detected · <span className="font-medium text-blue-600">{formatLabel}</span></p>
              </div>
              <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Clear</button>
            </div>

            {/* What we detected */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Auto-detected {mappedFields.length} fields</p>
              <div className="flex flex-wrap gap-2">
                {mappedFields.map((f) => (
                  <span key={f.systemField} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <MaterialIcon icon="check" className="text-[12px] text-emerald-500" />
                    {f.systemField.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {mappedFields.slice(0, 6).map((f) => (
                      <th key={f.systemField} className="px-3 py-2 text-left font-bold text-slate-600">{f.systemField.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {mappedFields.slice(0, 6).map((f) => {
                        let val = '';
                        if (f.csvHeader.includes(' + ')) {
                          val = f.csvHeader.split(' + ').map(p => row[p] || '').join(' ').trim();
                        } else {
                          val = row[f.csvHeader] || '';
                        }
                        return <td key={f.systemField} className="px-3 py-1.5 truncate max-w-[150px]">{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button */}
          <button
            onClick={runImport}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 font-bold text-base hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <MaterialIcon icon="rocket_launch" className="text-[20px]" />
            Import {rows.length} Properties
          </button>
        </div>
      )}

      {/* ═══ IMPORTING / GEOCODING: Progress ═══ */}
      {(phase === 'importing' || phase === 'geocoding') && (
        <div className="space-y-6">
          <ImportProgress
            current={progress}
            total={phase === 'geocoding' ? (result ? 0 : rows.filter(() => true).length) : rows.length}
            phase={progressPhase}
            label={progressLabel}
          />
          {phase === 'geocoding' && geocodedPins.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 h-[400px]">
              <ImportMiniMap pins={geocodedPins} />
            </div>
          )}
        </div>
      )}

      {/* ═══ DONE: Results ═══ */}
      {phase === 'done' && result && (
        <div className="space-y-6">
          {geocodedPins.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 h-[350px]">
              <ImportMiniMap pins={geocodedPins} />
            </div>
          )}
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <MaterialIcon icon="check_circle" className="text-[48px] text-emerald-500" />
            </div>
            <h3 className="font-headline text-2xl font-extrabold text-slate-900">Import Complete!</h3>
            <p className="text-slate-500 mt-2">{result.total} properties processed</p>

            <div className="flex justify-center gap-8 mt-6">
              {result.inserted > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-blue-600">{result.inserted}</p>
                  <p className="text-xs text-slate-400">New</p>
                </div>
              )}
              {result.updated > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-violet-600">{result.updated}</p>
                  <p className="text-xs text-slate-400">Updated</p>
                </div>
              )}
              {result.geocoded > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-emerald-600">{result.geocoded}</p>
                  <p className="text-xs text-slate-400">Pinpointed</p>
                </div>
              )}
              {result.errors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-red-500">{result.errors}</p>
                  <p className="text-xs text-slate-400">Errors</p>
                </div>
              )}
            </div>

            {/* Overage / Upgrade prompt */}
            {overagePrompt && overagePrompt.isFree && (
              <div className="mt-6 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 p-8 text-center">
                <MaterialIcon icon="lock_open" className="text-[40px] text-indigo-500 mb-3" />
                <h4 className="font-headline text-xl font-extrabold text-slate-900 mb-2">
                  You&apos;ve used your 50 free geocodes
                </h4>
                <p className="text-sm text-slate-600 mb-2">
                  {overagePrompt.remaining} properties were imported but can&apos;t be placed on the map yet.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Subscribe to unlock 500+ geocodes/month, walk mode, and more.
                </p>
                <a
                  href="/subscribe"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-8 py-4 font-bold text-base hover:shadow-xl shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <MaterialIcon icon="upgrade" className="text-[20px]" />
                  Subscribe — Starting at $49/mo
                </a>
                <p className="text-xs text-slate-400 mt-3">Cancel anytime. Your imported data is saved.</p>
              </div>
            )}

            {overagePrompt && !overagePrompt.isFree && (
              <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MaterialIcon icon="warning" className="text-[20px] text-amber-600" />
                  <h4 className="font-bold text-amber-800">
                    {overagePrompt.remaining} properties still need map pins
                  </h4>
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  You&apos;ve reached your monthly geocoding limit. These properties are saved but won&apos;t appear on the map until geocoded.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={async () => {
                      setOverageLoading(true);
                      try {
                        const res = await fetch('/api/stripe/charge-geocodes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ count: overagePrompt.remaining }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setOveragePrompt(null);
                          alert(`Charged ${overagePrompt.cost}. Remaining properties will be geocoded shortly.`);
                        } else if (data.checkout_url) {
                          window.location.href = data.checkout_url;
                        } else {
                          alert(data.error || 'Payment failed');
                        }
                      } catch { alert('Payment failed'); }
                      setOverageLoading(false);
                    }}
                    disabled={overageLoading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white py-3 font-bold text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    <MaterialIcon icon="bolt" className="text-[18px]" />
                    {overageLoading ? 'Processing...' : `Geocode Now — ${overagePrompt.cost}`}
                  </button>
                  <a
                    href="/subscribe"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-3 font-bold text-sm hover:bg-blue-700 transition-colors"
                  >
                    <MaterialIcon icon="upgrade" className="text-[18px]" />
                    Upgrade for More
                  </a>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 mt-8">
              <a href="/map" className="flex items-center gap-2 rounded-xl action-gradient px-6 py-3 text-sm font-bold text-white hover:shadow-lg transition-shadow">
                <MaterialIcon icon="map" className="text-[18px]" />
                View on Map
              </a>
              <button onClick={reset} className="flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <MaterialIcon icon="upload_file" className="text-[18px]" />
                Import Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
