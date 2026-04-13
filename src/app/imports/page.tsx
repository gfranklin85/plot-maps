'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ImportMiniMap from '@/components/map/ImportMiniMapDynamic';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

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
  const { profile } = useProfile();
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadType, setUploadType] = useState<'context' | 'target' | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Detected data
  const [, setFileName] = useState('');
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
  const [, setProgressPhase] = useState<'importing' | 'geocoding' | 'processing'>('importing');
  const [, setProgressLabel] = useState('');

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
    if (!isSubscribed) { setShowGate(true); return; }
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
    if (!user?.id) {
      setPhase('idle');
      return;
    }

    setPhase('importing');
    setProgress(0);
    setProgressPhase('importing');
    setProgressLabel('Importing your data...');

    let inserted = 0, updated = 0, geocoded = 0, errors = 0;
    const toGeocode: { id: string; address: string }[] = [];

    // Build lookup for existing addresses owned by this user
    const { data: existing } = await supabase.from('leads').select('id, property_address').eq('user_id', user.id);
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

        const { error } = await supabase.from('leads').update(updateData).eq('id', existingId).eq('user_id', user.id);
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
          user_id: user.id,
          record_type: uploadType || 'target',
          last_imported_at: new Date().toISOString(),
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
                }).eq('id', toGeocode[i].id).eq('user_id', user.id);
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
    setUploadType(null);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-12 space-y-8 md:space-y-16">
      {/* Header */}
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-extrabold tracking-tight mb-2">Build your map before you make your calls</h1>
        <p className="text-secondary text-sm sm:text-lg leading-relaxed">Upload your market data and your leads to get started</p>
      </div>

      {/* ═══ IDLE: Two-door entry ═══ */}
      {phase === 'idle' && !uploadType && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-10">
          {/* Market Layer (Left) */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <MaterialIcon icon="layers" className="text-[20px] text-primary" />
              <h2 className="text-sm uppercase tracking-wide sm:tracking-widest font-black text-on-surface">Market Layer (MLS / Comps)</h2>
            </div>
            <div className="group relative flex flex-col h-full border border-card-border rounded-2xl p-5 sm:p-6 md:p-10 hover:border-indigo-500/40 transition-all overflow-hidden">
              <img src="/import-mls.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/90 to-surface-container-lowest/60" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                  <MaterialIcon icon="map" className="text-[24px] text-primary" />
                </div>
                <h3 className="text-lg sm:text-2xl font-headline font-bold text-on-surface mb-3 sm:mb-4">Build your market view first</h3>
                <p className="text-secondary text-sm leading-relaxed mb-6">
                  Download a current snapshot of your market — active, pending, or recent sold listings — and upload it here. We&apos;ll place them on the map with full property cards so you can see what&apos;s happening in real time.
                </p>
                <p className="text-[11px] font-bold text-primary/70 uppercase tracking-wide mb-8 mt-auto">
                  Think of this as your live comp layer while you&apos;re calling
                </p>
                <button
                  onClick={() => setUploadType('context')}
                  className="w-full bg-surface-container-high text-on-surface py-3.5 rounded-xl font-bold text-sm border border-card-border hover:bg-primary hover:text-white hover:border-primary transition-all"
                >
                  Upload Market Snapshot
                </button>
                <p className="text-center text-[10px] text-secondary mt-2">CSV or paste data</p>
              </div>
            </div>
          </div>

          {/* Your Leads (Right) */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <MaterialIcon icon="target" className="text-[20px] text-orange-400" />
              <h2 className="text-sm uppercase tracking-widest font-black text-on-surface">Your Leads (Targets)</h2>
            </div>
            <div className="group relative flex flex-col h-full border border-card-border rounded-2xl p-5 sm:p-6 md:p-10 hover:border-orange-500/40 transition-all overflow-hidden">
              <img src="/import-leads.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c1324] via-[#0c1324]/90 to-[#0c1324]/60" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-6">
                  <MaterialIcon icon="person_search" className="text-[24px] text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-2xl font-headline font-bold text-on-surface mb-3 sm:mb-4">Bring your leads in</h3>
                <p className="text-secondary text-sm leading-relaxed mb-6">
                  Upload your lists from any source — PropStream, BatchLeads, county data, or your own notes. We automatically structure the data into property cards, then map them so you can see and work them directly.
                </p>
                <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wide mb-8 mt-auto">
                  Your data becomes something you can actually act on
                </p>
                <button
                  onClick={() => setUploadType('target')}
                  className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/10"
                >
                  Upload Lead List
                </button>
                <p className="text-center text-[10px] text-secondary mt-2">Paste, CSV, or raw text</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ IDLE: Upload zone (after type selected) ═══ */}
      {phase === 'idle' && uploadType && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setUploadType(null)} className="text-secondary hover:text-white transition-colors">
              <MaterialIcon icon="arrow_back" className="text-[20px]" />
            </button>
            <div className="flex items-center gap-2">
              <MaterialIcon icon={uploadType === 'context' ? 'layers' : 'target'} className={`text-[20px] ${uploadType === 'context' ? 'text-primary' : 'text-orange-400'}`} />
              <h2 className="text-sm uppercase tracking-widest font-black text-on-surface">
                {uploadType === 'context' ? 'Upload Market Snapshot' : 'Upload Lead List'}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Drop Zone */}
            <div
              className={cn(
                'group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 sm:p-8 md:p-12 transition-all cursor-pointer',
                dragActive
                  ? (uploadType === 'context' ? 'border-indigo-500 bg-indigo-500/5' : 'border-orange-500 bg-orange-500/5')
                  : 'border-outline-variant/30 hover:border-outline-variant/50 bg-surface-container-lowest'
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
              <div className="w-16 h-16 rounded-full bg-surface-container/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MaterialIcon icon="cloud_upload" className={`text-[32px] ${uploadType === 'context' ? 'text-primary' : 'text-orange-400'}`} />
              </div>
              <p className="text-base sm:text-xl font-semibold text-on-surface mb-2">Drop CSV or Excel</p>
              <p className="text-sm text-secondary mb-6">
                {uploadType === 'context' ? 'MLS exports, recent solds, active listings' : 'PropWire, BatchLeads, county records, any format'}
              </p>
              <button className="bg-surface-container/50 text-on-surface px-6 py-2 rounded-lg font-medium border border-card-border hover:bg-surface-container transition-colors text-sm">
                Select File
              </button>
            </div>

            {/* Smart Paste */}
            <div className="flex flex-col bg-card rounded-2xl p-8 border border-card-border">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MaterialIcon icon="auto_awesome" className="text-[20px] text-orange-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Smart Paste</h3>
                </div>
                <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-bold">AI</span>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                className="flex-1 bg-surface-container-lowest border-none rounded-lg p-4 font-mono text-xs text-on-surface-variant focus:ring-1 focus:ring-primary resize-none placeholder:text-secondary"
                placeholder={"Paste address chunks, MLS snippets, or unstructured text...\n\n123 Alpine Way, Boulder CO $1.2M\n09/12/23 - New listing: 455 Sunset Blvd, LA..."}
              />
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim() || aiParsing}
                className="mt-4 text-primary text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all disabled:opacity-50"
              >
                {aiParsing ? 'ANALYZING...' : 'PARSE SNIPPET'} <MaterialIcon icon="arrow_forward" className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETECTING: Loading ═══ */}
      {phase === 'detecting' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-lg font-bold text-on-surface">Analyzing your data...</p>
          <p className="text-sm text-secondary mt-1">Auto-detecting columns and format</p>
        </div>
      )}

      {/* ═══ PREVIEW: Data Mapping ═══ */}
      {phase === 'preview' && (
        <div className="space-y-8">
          {/* Ready bar */}
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase">Data Preview</span>
              <h2 className="text-3xl font-headline font-bold text-on-surface">Ready to Import</h2>
            </div>
            <div className="bg-surface-container/60 border border-primary/20 px-6 py-3 rounded-full flex items-center gap-6">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="check_circle" className="text-[16px] text-primary" />
                <span className="text-sm font-semibold text-on-surface">{rows.length} Rows Detected</span>
              </div>
              <div className="h-4 w-px bg-outline-variant" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary uppercase tracking-wider">Format:</span>
                <span className="text-xs font-bold text-on-surface uppercase">{formatLabel}</span>
              </div>
              <button onClick={reset} className="text-xs text-secondary hover:text-red-400 transition-colors ml-2">Clear</button>
            </div>
          </div>

          {/* Field grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {mappedFields.map((f) => (
              <div key={f.systemField} className="bg-surface/50 p-4 rounded-xl border border-card-border flex flex-col gap-2">
                <MaterialIcon icon="task_alt" className="text-[14px] text-primary" />
                <span className="text-[10px] font-bold text-secondary uppercase">{f.systemField.replace(/_/g, ' ')}</span>
                <span className="text-xs text-on-surface-variant truncate">{f.sampleValue || '—'}</span>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="bg-surface/50 rounded-2xl border border-card-border overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container/50 border-b border-card-border">
                    {mappedFields.slice(0, 6).map((f) => (
                      <th key={f.systemField} className="px-6 py-4 text-[10px] font-bold text-secondary uppercase tracking-widest">{f.systemField.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-surface-container/30 transition-colors">
                      {mappedFields.slice(0, 6).map((f) => {
                        let val = '';
                        if (f.csvHeader.includes(' + ')) {
                          val = f.csvHeader.split(' + ').map(p => row[p] || '').join(' ').trim();
                        } else {
                          val = row[f.csvHeader] || '';
                        }
                        return <td key={f.systemField} className="px-6 py-3 text-xs text-on-surface-variant truncate max-w-[150px]">{val}</td>;
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
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-4 font-bold text-base hover:shadow-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            <MaterialIcon icon="rocket_launch" className="text-[20px]" />
            Import {rows.length} Properties
          </button>
        </div>
      )}

      {/* ═══ IMPORTING / GEOCODING: Progress ═══ */}
      {(phase === 'importing' || phase === 'geocoding') && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-orange-400 tracking-[0.2em] uppercase">Live Processing</span>
                <h2 className="text-3xl font-headline font-bold text-on-surface">
                  {phase === 'geocoding' ? 'Geocoding & Mapping' : 'Importing Data'}
                </h2>
              </div>
              <span className="text-sm font-bold text-primary">
                {progress} / {phase === 'geocoding' ? rows.length : rows.length} Properties
              </span>
            </div>
            <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                style={{ width: `${rows.length > 0 ? (progress / rows.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {phase === 'geocoding' && geocodedPins.length > 0 && (
            <div className="relative h-[400px] rounded-3xl overflow-hidden border border-card-border">
              <ImportMiniMap pins={geocodedPins} />
              <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur p-3 rounded-xl border border-card-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Live Geocoding</span>
                </div>
                <p className="text-[10px] text-secondary mt-1 font-mono">{geocodedPins.length} pins placed</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DONE: Results ═══ */}
      {phase === 'done' && result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Map */}
          <div className="lg:col-span-7">
            {geocodedPins.length > 0 && (
              <div className="relative h-[400px] rounded-3xl overflow-hidden border border-card-border">
                <ImportMiniMap pins={geocodedPins} />
              </div>
            )}
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container/30 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-card-border">
              <h3 className="text-lg font-bold text-on-surface mb-8">Import Summary</h3>
              <div className="space-y-6">
                {result.inserted > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MaterialIcon icon="add" className="text-[20px] text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">New Records</p>
                        <p className="text-[10px] text-secondary">Inserted into database</p>
                      </div>
                    </div>
                    <span className="text-xl font-headline font-extrabold text-on-surface">{result.inserted}</span>
                  </div>
                )}
                {result.updated > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                        <MaterialIcon icon="update" className="text-[20px] text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Updated</p>
                        <p className="text-[10px] text-secondary">Existing records enriched</p>
                      </div>
                    </div>
                    <span className="text-xl font-headline font-extrabold text-on-surface">{result.updated}</span>
                  </div>
                )}
                {result.geocoded > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <MaterialIcon icon="location_on" className="text-[20px] text-orange-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Pinpointed</p>
                        <p className="text-[10px] text-secondary">High-confidence geocode</p>
                      </div>
                    </div>
                    <span className="text-xl font-headline font-extrabold text-on-surface">{result.geocoded}</span>
                  </div>
                )}
                {result.errors > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <MaterialIcon icon="error" className="text-[20px] text-red-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Errors</p>
                        <p className="text-[10px] text-secondary">Could not process</p>
                      </div>
                    </div>
                    <span className="text-xl font-headline font-extrabold text-on-surface">{result.errors}</span>
                  </div>
                )}
              </div>

              <div className="mt-10 pt-8 border-t border-card-border space-y-3">
                <a href="/map" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all">
                  <MaterialIcon icon="map" className="text-[18px]" />
                  Finish &amp; View Map
                </a>
                <button onClick={reset} className="w-full text-secondary py-3 rounded-xl font-bold text-sm hover:text-on-surface-variant transition-colors">
                  Import Another
                </button>
              </div>
            </div>

            {/* Overage / Upgrade prompt */}
            {overagePrompt && overagePrompt.isFree && (
              <div className="mt-6 rounded-2xl bg-gradient-to-br from-indigo-900/50 to-blue-900/50 border border-indigo-500/30 p-8 text-center">
                <MaterialIcon icon="lock_open" className="text-[40px] text-primary mb-3" />
                <h4 className="font-headline text-xl font-extrabold text-on-surface mb-2">
                  You&apos;ve used your 50 free geocodes
                </h4>
                <p className="text-sm text-secondary mb-2">
                  {overagePrompt.remaining} properties imported but not yet mapped.
                </p>
                <p className="text-sm text-secondary mb-6">
                  Subscribe to unlock 500+ geocodes/month and more.
                </p>
                <a
                  href="/subscribe"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-8 py-4 font-bold text-base hover:shadow-xl shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <MaterialIcon icon="upgrade" className="text-[20px]" />
                  Subscribe — $49/mo
                </a>
                <p className="text-xs text-secondary mt-3">Cancel anytime. Your data is saved.</p>
              </div>
            )}

            {overagePrompt && !overagePrompt.isFree && (
              <div className="mt-6 rounded-2xl bg-amber-900/20 border border-amber-500/30 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MaterialIcon icon="warning" className="text-[20px] text-amber-400" />
                  <h4 className="font-bold text-amber-200">
                    {overagePrompt.remaining} properties need map pins
                  </h4>
                </div>
                <p className="text-sm text-amber-300/70 mb-4">
                  Monthly limit reached. Properties saved but not mapped.
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
                          alert(`Charged ${overagePrompt.cost}. Properties will be geocoded.`);
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
                    {overageLoading ? 'Processing...' : `Geocode — ${overagePrompt.cost}`}
                  </button>
                  <a
                    href="/subscribe"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-3 font-bold text-sm hover:bg-primary/90 transition-colors"
                  >
                    <MaterialIcon icon="upgrade" className="text-[18px]" />
                    Upgrade
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <UpgradeGate feature="smartImport" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
