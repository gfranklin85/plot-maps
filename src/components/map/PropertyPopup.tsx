"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lead, CallOutcome, LeadStatus } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { cn, formatPhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";
import { usePhone } from "@/lib/phone-context";
import UpgradeGate from "@/components/ui/UpgradeGate";

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
  onToggleProspectMode?: () => void;
  prospectMode?: boolean;
}

const OUTCOME_STATUS: Partial<Record<CallOutcome, LeadStatus>> = {
  'No Answer': 'Called',
  'Left VM': 'Called',
  'Spoke with Owner': 'Interested',
  'Not Interested': 'Not Interested',
  'Follow-Up': 'Follow-Up',
  'DNC': 'Do Not Call',
};

function fillScript(template: string, lead: Lead): string {
  const name = lead.owner_name || lead.name || 'there';
  const firstName = name.split(' ')[0];
  const street = lead.property_address?.split(',')[0] || 'your street';
  const value = lead.selling_price
    ? `$${lead.selling_price.toLocaleString()}`
    : lead.price_range || '$XXX,XXX';
  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{street\}/g, street)
    .replace(/\{value\}/g, value);
}

// Generate talking points for reference properties — focused on how this helps nearby calls
function generateTalkingPoints(lead: Lead): string[] {
  const points: string[] = [];

  if (lead.listing_status === 'Sold') {
    if (lead.listing_price && lead.selling_price && lead.selling_price > 0) {
      const diff = lead.selling_price - lead.listing_price;
      if (diff > 0) points.push(`Sold $${diff.toLocaleString()} OVER asking — competitive market`);
      else if (diff < 0) points.push(`Sold $${Math.abs(diff).toLocaleString()} below asking`);
      else points.push(`Sold at full asking price — strong demand`);
    }
    if (lead.dom != null) {
      if (lead.dom <= 7) points.push(`Only ${lead.dom} days on market — extremely fast sale`);
      else if (lead.dom <= 30) points.push(`${lead.dom} days on market — quick sale`);
      else if (lead.dom <= 90) points.push(`${lead.dom} days on market — normal pace`);
      else points.push(`${lead.dom} DOM — sat a while, possibly overpriced initially`);
    }
    if (lead.selling_price && lead.sqft && lead.sqft > 0) {
      points.push(`$${Math.round(lead.selling_price / lead.sqft)}/sqft — use as comp for neighbors`);
    }
    if (lead.selling_date) {
      const days = Math.floor((Date.now() - new Date(lead.selling_date + 'T00:00:00').getTime()) / 86400000);
      if (days <= 30) points.push(`Sold ${days} days ago — very fresh comp`);
      else if (days <= 90) points.push(`Sold ${Math.round(days / 7)} weeks ago — recent comp`);
      else if (days <= 180) points.push(`Sold ${Math.round(days / 30)} months ago — still relevant`);
    }
  }

  if (lead.listing_status === 'Active') {
    if (lead.listing_price) points.push(`Asking $${lead.listing_price.toLocaleString()}`);
    if (lead.dom != null) {
      if (lead.dom > 60) points.push(`${lead.dom} DOM — sitting, price may be high`);
      else if (lead.dom > 30) points.push(`${lead.dom} DOM — moderate time on market`);
      else points.push(`${lead.dom} DOM — freshly listed`);
    }
    if (lead.listing_price && lead.sqft && lead.sqft > 0) {
      points.push(`Asking $${Math.round(lead.listing_price / lead.sqft)}/sqft`);
    }
  }

  if (lead.listing_status === 'Pending') {
    if (lead.listing_price) points.push(`Listed at $${lead.listing_price.toLocaleString()} — now under contract`);
    if (lead.dom != null) points.push(`Went pending after ${lead.dom} days`);
  }

  return points;
}

// Generate "how this relates to neighbors" insights
function generateNeighborContext(lead: Lead): string[] {
  const insights: string[] = [];

  if (lead.listing_status === 'Sold') {
    if (lead.dom != null && lead.dom <= 14) insights.push(`Fast-sale signal for neighbors — "your area is moving"`);
    if (lead.selling_price && lead.sqft && lead.sqft > 0) {
      const ppsf = Math.round(lead.selling_price / lead.sqft);
      insights.push(`$${ppsf}/sqft sets the comp for this street`);
    }
    if (lead.selling_date) {
      const days = Math.floor((Date.now() - new Date(lead.selling_date + 'T00:00:00').getTime()) / 86400000);
      if (days <= 30) insights.push(`Very recent sale — strong "your neighbor just sold" opener`);
    }
  }

  if (lead.listing_status === 'Active') {
    insights.push(`Active listing nearby — creates urgency for neighbors`);
    if (lead.dom != null && lead.dom > 30) insights.push(`Sitting on market — possible price reduction coming`);
  }

  if (lead.listing_status === 'Pending') {
    insights.push(`Under contract — shows buyer demand on this street`);
  }

  return insights;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Compact "label · value" row used throughout the parcel card sections.
// span2 makes the row stretch the full grid width for longer values.
function Row({ label, value, span2 = false }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={cn('flex items-baseline gap-2', span2 && 'col-span-2')}>
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="font-semibold text-on-surface truncate">{value}</span>
    </div>
  );
}

export default function PropertyPopup({ lead, onUpdate, walkMode = false, onWalkHere, onToggleProspectMode, prospectMode }: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [localScript, setLocalScript] = useState('');
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [contextPaste, setContextPaste] = useState('');
  const [contextSaved, setContextSaved] = useState(false);
  // Plot platform — channel-aware inquiry firing.
  // For Lite users: this popup displays NO owner name or phone (masked layer).
  // For Pro users: an Owner Contact block above the channel actions renders
  // raw owner identity from the lead row. Same data path, different render
  // policy by edition.
  const [armedChannel, setArmedChannel] = useState<'text_invite' | 'direct_mail' | 'phone_call' | null>(null);
  const [plotEdition, setPlotEdition] = useState<'lite' | 'pro' | null>(null);
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const { makeCall, isDesktop } = usePhone();
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/arm-channel')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data) {
          setArmedChannel(data.armed_channel || null);
          setPlotEdition((data.plot_edition as 'lite' | 'pro') || 'lite');
        }
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);
  const fireArmedInquiry = async (override?: 'text_invite' | 'direct_mail' | 'phone_call', phase?: 'primer' | 'fire') => {
    const channel = override || armedChannel;
    if (!channel) {
      setInquiryError('Arm a channel at /dashboard/arming first');
      return;
    }
    setInquiryStatus('sending');
    setInquiryError(null);
    try {
      const res = await fetch('/api/inquiry/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, channel, ...(phase ? { phase } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInquiryStatus('failed');
        setInquiryError(data?.error || 'Failed');
        return;
      }
      setInquiryStatus('sent');
      onUpdate?.();
    } catch {
      setInquiryStatus('failed');
      setInquiryError('Network error');
    }
  };

  // Parcel info — full ResolvedProperty shape from /api/parcel. Municipal
  // sources (Lemoore GIS) contribute zoning/general-plan/pipeline; county
  // sources (Kings County) contribute the rich assessor extensions. The
  // resolver folds them into one shape; we render every section that has
  // anything to show and silently omit the rest.
  const [parcel, setParcel] = useState<import('@/lib/property-data/types').ResolvedProperty | null>(null);

  // Google POI data — populated for `gpoi:<placeId>` stub leads. Normalized
  // shape comes from /api/google-poi (server-side Place Details proxy).
  // Lives in its own state so the parcel + POI cases don't share a slot.
  const [googlePoi, setGooglePoi] = useState<{
    placeId: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    types: string[];
    phone: string | null;
    website: string | null;
    rating: number | null;
    userRatingsTotal: number | null;
  } | null>(null);
  const [googlePoiError, setGooglePoiError] = useState<string | null>(null);

  // Plot address-layer record — populated for `addr:<id>` stub leads.
  // Source is /api/addresses/[id], backed by the `addresses` PostGIS
  // table seeded from OpenAddresses. This is the universal layer: every
  // address in every ingested county, no owner data attached, ammo-billed
  // skip-trace fills in owner on demand. Greg locked 2026-05-27.
  const [addressRecord, setAddressRecord] = useState<{
    id: number;
    streetNumber: string | null;
    streetName: string | null;
    unit: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
    fullAddress: string;
  } | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Which expand-sections are open. Default: everything collapsed except
  // the always-visible at-a-glance row. Buyer-mode controller experience:
  // sections expand on A/select; collapsed sections show a one-line preview.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    let cancelled = false;
    // Stub-id resolver routing:
    //   `parcel:<APN>`     → /api/parcel?apn=…   (Plot's PostGIS parcel resolver)
    //   `gpoi:<placeId>`   → /api/google-poi?placeId=…  (Google Place Details proxy)
    //   `addr:<id>`        → /api/addresses/[id]  (Plot's address layer)
    //   anything else      → /api/parcel?lat=…&lng=…   (lat/lng proximity guess)
    //
    // The branches set DIFFERENT state slots (parcel vs googlePoi vs
    // addressRecord) so the popup body renders the right sections.
    const id = lead.id ?? '';
    if (id.startsWith('addr:')) {
      const addrId = id.slice('addr:'.length);
      setAddressError(null);
      fetch(`/api/addresses/${encodeURIComponent(addrId)}`)
        .then(async (r) => {
          if (!r.ok) {
            setAddressError(r.status === 404 ? 'Address not found' : 'Address lookup failed');
            return null;
          }
          return r.json();
        })
        .then((data) => { if (!cancelled && data) setAddressRecord(data); })
        .catch(() => { if (!cancelled) setAddressError('Address lookup failed'); });
      return () => { cancelled = true; };
    }
    if (id.startsWith('gpoi:')) {
      const placeId = id.slice('gpoi:'.length);
      setGooglePoiError(null);
      fetch(`/api/google-poi?placeId=${encodeURIComponent(placeId)}`)
        .then(async (r) => {
          if (!r.ok) {
            setGooglePoiError(r.status === 404 ? 'POI not found' : 'POI lookup failed');
            return null;
          }
          return r.json();
        })
        .then((data) => { if (!cancelled && data) setGooglePoi(data); })
        .catch(() => { if (!cancelled) setGooglePoiError('POI lookup failed'); });
      return () => { cancelled = true; };
    }
    // Polygon-click stubs encode the parcel identity in the id as
    // 'parcel:<APN>'. When present, look up by APN directly — exact,
    // deterministic, and avoids the proximity guess the lat/lng path
    // uses. Falls back to lat/lng for normal pin clicks.
    const apnFromStub = id.startsWith('parcel:') ? id.slice('parcel:'.length) : null;
    const url = apnFromStub
      ? `/api/parcel?apn=${encodeURIComponent(apnFromStub)}`
      : (lead.latitude != null && lead.longitude != null
          ? `/api/parcel?lat=${lead.latitude}&lng=${lead.longitude}`
          : null);
    if (!url) return;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setParcel(data); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [lead.id, lead.latitude, lead.longitude]);

  // AI call state

  const isFree = profile.subscriptionStatus !== 'active';

  // Determine card type: reference property vs callable lead
  const isReference = !!lead.listing_status;
  const phones = [lead.phone, lead.phone_2, lead.phone_3].filter(Boolean) as string[];
  const isCallable = phones.length > 0;
  const isSold = lead.listing_status === 'Sold';
  const isActive = lead.listing_status === 'Active';
  const isPending = lead.listing_status === 'Pending';

  const talkingPoints = isReference ? generateTalkingPoints(lead) : [];
  const neighborContext = isReference ? generateNeighborContext(lead) : [];

  const statusColor = isSold ? 'text-yellow-400' : isActive ? 'text-green-400' : isPending ? 'text-purple-400' : 'text-on-surface-variant';
  const statusText = isSold ? 'Sold' : isActive ? 'Active' : isPending ? 'Pending' : '';
  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : '';
  const ppsf = (lead.selling_price || lead.listing_price) && lead.sqft && lead.sqft > 0
    ? `$${Math.round((lead.selling_price || lead.listing_price || 0) / lead.sqft)}/sqft`
    : '';

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'note', title: 'Note (from map)', description: note.trim(),
    });
    setNote(''); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate?.();
  }

  async function saveContext() {
    if (!contextPaste.trim()) return;
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'note', title: 'Market Context', description: contextPaste.trim(),
    });
    setContextPaste(''); setContextSaved(true);
    setTimeout(() => setContextSaved(false), 2000);
    onUpdate?.();
  }

  async function logOutcome(outcome: CallOutcome) {
    const newStatus = OUTCOME_STATUS[outcome];
    if (newStatus) {
      await supabase.from('leads').update({
        status: newStatus, last_contact_date: new Date().toISOString(),
      }).eq('id', lead.id).eq('user_id', user!.id);
    }
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'call', title: `Call: ${outcome}`, outcome, description: note || undefined,
    });
    setOutcomeLogged(outcome); setNote('');
    onUpdate?.();
  }

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden", walkMode ? "min-w-[280px] max-w-[320px]" : "w-full")}>
      <div className="px-5 pt-4 pb-3 space-y-3">
        {/* ── ADDRESS + ACTION PILLS ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            {(() => {
              // Prefer the lead's address (real prospect), fall back to
              // the resolved parcel address (polygon-click case where the
              // stub has no address yet — assessor data fills it in), then
              // to Google POI name/address for `gpoi:<placeId>` stubs.
              const poiName = googlePoi?.name ?? null;
              const poiAddr = googlePoi?.address ?? null;
              if (poiName) {
                // POI case: name is the headline, address is the tail.
                return (
                  <>
                    <h2 className="font-headline text-lg font-extrabold tracking-tight text-on-surface leading-tight">
                      {poiName}
                    </h2>
                    {poiAddr && (
                      <p className="text-xs text-on-surface-variant font-medium">{poiAddr}</p>
                    )}
                  </>
                );
              }
              // Address layer takes precedence over POI fallback because
              // the addr:<id> resolver returns a clean fullAddress string
              // (street + city + state + zip), already comma-formatted.
              const addr = lead.property_address
                || parcel?.address
                || addressRecord?.fullAddress
                || poiAddr
                || null;
              const head = addr?.split(',')[0]?.trim()
                || (addressError ?? googlePoiError ?? 'No address');
              const tail = addr?.split(',').slice(1).join(',').trim() || '';
              return (
                <>
                  <h2 className="font-headline text-lg font-extrabold tracking-tight text-on-surface leading-tight">
                    {head}
                  </h2>
                  {tail && (
                    <p className="text-xs text-on-surface-variant font-medium">{tail}</p>
                  )}
                </>
              );
            })()}
            {!isReference && (lead.owner_name || lead.name) && (
              <p className="text-xs text-on-surface-variant mt-0.5">{lead.owner_name || lead.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!walkMode && isReference && lead.latitude != null && lead.longitude != null && onToggleProspectMode && (
              <button
                onClick={onToggleProspectMode}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  prospectMode ? 'bg-primary text-white border-primary' : 'bg-surface-container-high border-card-border text-primary hover:bg-primary hover:text-white'
                }`}
              >
                <MaterialIcon icon="ads_click" className="text-[14px]" />
                {prospectMode ? 'Selecting...' : 'Select Prospects'}
              </button>
            )}
            {!walkMode && onWalkHere && lead.latitude != null && lead.longitude != null && (
              <button onClick={() => onWalkHere(lead)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-surface-container-high border border-card-border text-xs font-medium text-primary hover:bg-primary hover:text-white transition-all">
                <MaterialIcon icon="directions_walk" className="text-[14px]" />
                Walk
              </button>
            )}
          </div>
        </div>

        {/* ── PARCEL DETAILS — single-view + expand/collapse ── */}
        {parcel?.hit && (() => {
          const fmtUSD = (v: number) => `$${v.toLocaleString()}`;
          const fmtNum = (v: number | string | null | undefined): string => {
            if (v == null || v === '') return '';
            if (typeof v === 'number') return v.toLocaleString();
            return v.toString();
          };
          const isPro = plotEdition === 'pro';

          // ── Always-visible at-a-glance row ────────────────────────
          // The seven fields that drive a prospecting decision at a
          // glance. We render whatever's present in a two-column grid
          // and skip anything null.
          const glanceItems: { label: string; value: string }[] = [];
          if (parcel.acres != null) glanceItems.push({ label: 'Acres', value: parcel.acres.toFixed(2) });
          if (parcel.yearBuilt != null) glanceItems.push({ label: 'Built', value: String(parcel.yearBuilt) });
          if (parcel.buildingSize != null && parcel.buildingSize > 0) glanceItems.push({ label: 'Sqft', value: parcel.buildingSize.toLocaleString() });
          if (parcel.bedrooms != null && parcel.bedrooms !== '' && parcel.bedrooms !== 0) glanceItems.push({ label: 'Beds', value: fmtNum(parcel.bedrooms) });
          if (parcel.bathrooms != null && parcel.bathrooms !== '' && parcel.bathrooms !== 0) glanceItems.push({ label: 'Baths', value: fmtNum(parcel.bathrooms) });
          if (parcel.netValue != null) glanceItems.push({ label: 'Net assessed', value: fmtUSD(parcel.netValue) });
          if (parcel.zoningCode) glanceItems.push({ label: 'Zoning', value: parcel.zoningCode });

          // ── Absentee detection (Pro only) ─────────────────────────
          // If the assessee's mailing address differs from the parcel's
          // situs address, the owner doesn't live there — a huge
          // prospecting signal. Compare loosely (uppercase, collapse
          // whitespace) because punctuation/casing varies in the roll.
          const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
          const situsForMatch = norm(parcel.address);
          const mailingFull = [parcel.mailingAddress1, parcel.mailingAddress2, parcel.mailingAddress3, parcel.mailingAddress4]
            .map(p => p ?? '').filter(Boolean).join(' / ');
          const mailingForMatch = norm(mailingFull);
          const isAbsentee = isPro && !!parcel.assesseeName && !!mailingForMatch && !!situsForMatch && !mailingForMatch.includes(situsForMatch.split(',')[0] ?? '_');

          // ── Section definitions ───────────────────────────────────
          // Each section: a key, a header label, a preview string for
          // the collapsed state (one-glance summary), and a render
          // function for the expanded body. Sections with no data
          // self-skip (preview returns null).

          type Section = { key: string; header: string; preview: string | null; body: React.ReactNode };

          const sections: Section[] = [];

          // Owner (Pro only — assessee name + mailing address)
          if (isPro && parcel.assesseeName) {
            sections.push({
              key: 'owner',
              header: 'Owner',
              preview: parcel.assesseeName + (isAbsentee ? ' · ABSENTEE' : ''),
              body: (
                <div className="space-y-1 text-[11px]">
                  <div className="font-semibold text-on-surface">{parcel.assesseeName}</div>
                  {mailingFull && (
                    <div>
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Tax mailing address</div>
                      <div className="text-on-surface-variant whitespace-pre-line">{mailingFull.replace(/ \/ /g, '\n')}</div>
                    </div>
                  )}
                  {isAbsentee && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      <MaterialIcon icon="flight_takeoff" className="text-[11px]" />
                      Absentee owner — mailing address differs from parcel
                    </div>
                  )}
                </div>
              ),
            });
          }

          // Structure details — everything past beds/baths/sqft/year
          const structurePreviewParts: string[] = [];
          if (parcel.storiesCount != null && parcel.storiesCount !== '') structurePreviewParts.push(`${parcel.storiesCount} story`);
          if (parcel.buildingType) structurePreviewParts.push(parcel.buildingType);
          if (parcel.construction) structurePreviewParts.push(parcel.construction);
          if (parcel.condition) structurePreviewParts.push(parcel.condition);
          const hasStructureExtras = !!(parcel.effectiveYear || parcel.unitsCount || parcel.halfBaths != null || parcel.qualityClass ||
            parcel.construction || parcel.foundation || parcel.exteriorType || parcel.roofCover || parcel.storiesCount || parcel.buildingUsedFor);
          if (hasStructureExtras) {
            sections.push({
              key: 'structure',
              header: 'Structure',
              preview: structurePreviewParts.slice(0, 3).join(' · ') || null,
              body: (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {parcel.effectiveYear && parcel.effectiveYear !== parcel.yearBuilt && (
                    <Row label="Effective yr" value={String(parcel.effectiveYear)} />
                  )}
                  {parcel.storiesCount != null && parcel.storiesCount !== '' && parcel.storiesCount !== 0 && (
                    <Row label="Stories" value={fmtNum(parcel.storiesCount)} />
                  )}
                  {parcel.unitsCount != null && parcel.unitsCount !== '' && parcel.unitsCount !== 0 && (
                    <Row label="Units" value={fmtNum(parcel.unitsCount)} />
                  )}
                  {parcel.halfBaths != null && parcel.halfBaths !== '' && parcel.halfBaths !== 0 && (
                    <Row label="½ Baths" value={fmtNum(parcel.halfBaths)} />
                  )}
                  {parcel.buildingType && <Row label="Type" value={parcel.buildingType} />}
                  {parcel.buildingUsedFor && <Row label="Used for" value={parcel.buildingUsedFor} />}
                  {parcel.condition && <Row label="Condition" value={parcel.condition} />}
                  {parcel.qualityClass && <Row label="Quality" value={parcel.qualityClass} />}
                  {parcel.construction && <Row label="Construction" value={parcel.construction} span2 />}
                  {parcel.foundation && <Row label="Foundation" value={parcel.foundation} span2 />}
                  {parcel.exteriorType && <Row label="Exterior" value={parcel.exteriorType} />}
                  {parcel.roofCover && <Row label="Roof" value={parcel.roofCover} />}
                </div>
              ),
            });
          }

          // Land & ag
          const isAg = !!(parcel.hasOrchard === 'Y' || parcel.hasVineyard === 'Y' || parcel.hasWell === 'Y' ||
            (parcel.growingAcres != null && parcel.growingAcres !== '' && parcel.growingAcres !== 0));
          const landPreviewParts: string[] = [];
          if (parcel.acres != null) landPreviewParts.push(`${parcel.acres.toFixed(2)} ac`);
          if (parcel.use2024) landPreviewParts.push(parcel.use2024);
          if (isAg) landPreviewParts.push('agricultural');
          const hasLandExtras = !!(parcel.use2024 || parcel.development2024 || parcel.generalPlanCode || parcel.subdivisionName ||
            parcel.subdivision?.name || parcel.sitePlan?.title || parcel.homesiteAcres || parcel.growingAcres ||
            parcel.primeAcres || parcel.openSpaceAcres || parcel.urbanAcres || isAg);
          if (hasLandExtras) {
            sections.push({
              key: 'land',
              header: 'Land & planning',
              preview: landPreviewParts.slice(0, 3).join(' · ') || null,
              body: (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {parcel.use2024 && <Row label="Use" value={parcel.use2024} span2 />}
                  {parcel.development2024 && <Row label="Status" value={parcel.development2024} span2 />}
                  {parcel.generalPlanCode && <Row label="Gen. Plan" value={`${parcel.generalPlanCode}${parcel.generalPlanDesc ? ` · ${parcel.generalPlanDesc}` : ''}`} span2 />}
                  {parcel.subdivisionName && <Row label="Subdivision" value={parcel.subdivisionName} span2 />}
                  {parcel.subdivision?.name && parcel.subdivision.name !== parcel.subdivisionName && (
                    <Row label="Pipeline" value={`${parcel.subdivision.name}${parcel.subdivision.status ? ` · ${parcel.subdivision.status}` : ''}`} span2 />
                  )}
                  {parcel.sitePlan?.title && (
                    <Row label="Site plan" value={`${parcel.sitePlan.title}${parcel.sitePlan.status ? ` · ${parcel.sitePlan.status}` : ''}`} span2 />
                  )}
                  {parcel.homesiteAcres != null && parcel.homesiteAcres !== '' && parcel.homesiteAcres !== 0 && (
                    <Row label="Homesite ac" value={fmtNum(parcel.homesiteAcres)} />
                  )}
                  {parcel.growingAcres != null && parcel.growingAcres !== '' && parcel.growingAcres !== 0 && (
                    <Row label="Growing ac" value={fmtNum(parcel.growingAcres)} />
                  )}
                  {parcel.primeAcres != null && parcel.primeAcres !== '' && parcel.primeAcres !== 0 && (
                    <Row label="Prime ac" value={fmtNum(parcel.primeAcres)} />
                  )}
                  {parcel.openSpaceAcres != null && parcel.openSpaceAcres !== '' && parcel.openSpaceAcres !== 0 && (
                    <Row label="Open ac" value={fmtNum(parcel.openSpaceAcres)} />
                  )}
                  {parcel.urbanAcres != null && parcel.urbanAcres !== '' && parcel.urbanAcres !== 0 && (
                    <Row label="Urban ac" value={fmtNum(parcel.urbanAcres)} />
                  )}
                  {parcel.hasWell === 'Y' && <Row label="Well" value="Yes" />}
                  {parcel.hasOrchard === 'Y' && <Row label="Orchard" value="Yes" />}
                  {parcel.hasVineyard === 'Y' && <Row label="Vineyard" value="Yes" />}
                </div>
              ),
            });
          }

          // Amenities
          const amenityPreviewParts: string[] = [];
          if (parcel.poolSpa && parcel.poolSpa !== 'N' && parcel.poolSpa !== '') amenityPreviewParts.push('pool');
          if (parcel.solar && parcel.solar !== 'N' && parcel.solar !== '') amenityPreviewParts.push('solar');
          if (parcel.fireplace && parcel.fireplace !== 'N' && parcel.fireplace !== '') amenityPreviewParts.push('fireplace');
          if (parcel.garage && parcel.garage !== 'N' && parcel.garage !== '') amenityPreviewParts.push('garage');
          const hasAmenities = !!(parcel.heating || parcel.coolingCentral || parcel.fireplace || parcel.garage ||
            parcel.attachGarageSqft || parcel.detachGarageSqft || parcel.poolSpa || parcel.solar);
          if (hasAmenities) {
            sections.push({
              key: 'amenities',
              header: 'Amenities & mechanical',
              preview: amenityPreviewParts.slice(0, 4).join(' · ') || null,
              body: (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {parcel.heating && <Row label="Heating" value={parcel.heating} />}
                  {parcel.coolingCentral && <Row label="A/C" value={parcel.coolingCentral} />}
                  {parcel.fireplace && parcel.fireplace !== 'N' && <Row label="Fireplace" value={parcel.fireplace} />}
                  {parcel.garage && parcel.garage !== 'N' && <Row label="Garage" value={parcel.garage} />}
                  {parcel.attachGarageSqft != null && parcel.attachGarageSqft > 0 && (
                    <Row label="Garage (att)" value={`${parcel.attachGarageSqft} sqft`} />
                  )}
                  {parcel.detachGarageSqft != null && parcel.detachGarageSqft > 0 && (
                    <Row label="Garage (det)" value={`${parcel.detachGarageSqft} sqft`} />
                  )}
                  {parcel.poolSpa && parcel.poolSpa !== 'N' && <Row label="Pool/Spa" value={parcel.poolSpa} />}
                  {parcel.solar && parcel.solar !== 'N' && <Row label="Solar" value={parcel.solar} />}
                  {parcel.waterSource && <Row label="Water" value={parcel.waterSource} />}
                  {parcel.sewerCode && <Row label="Sewer" value={parcel.sewerCode} />}
                </div>
              ),
            });
          }

          // Valuation breakdown
          const valuePreviewParts: string[] = [];
          if (parcel.landValue != null && parcel.landValue > 0) valuePreviewParts.push(`Land ${fmtUSD(parcel.landValue)}`);
          if (parcel.structureValue != null && parcel.structureValue > 0) valuePreviewParts.push(`Bldg ${fmtUSD(parcel.structureValue)}`);
          const hasValuation = !!(parcel.landValue || parcel.structureValue || parcel.tra || parcel.taxabilityFull);
          if (hasValuation) {
            sections.push({
              key: 'valuation',
              header: 'Valuation breakdown',
              preview: valuePreviewParts.slice(0, 2).join(' · ') || null,
              body: (
                <div className="space-y-1 text-[11px]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {parcel.landValue != null && parcel.landValue > 0 && <Row label="Land $" value={fmtUSD(parcel.landValue)} />}
                    {parcel.structureValue != null && parcel.structureValue > 0 && <Row label="Structure $" value={fmtUSD(parcel.structureValue)} />}
                    {parcel.netValue != null && <Row label="Net assessed" value={fmtUSD(parcel.netValue)} span2 />}
                    {parcel.tra && <Row label="TRA" value={parcel.tra} />}
                    {parcel.taxabilityFull && <Row label="Taxability" value={parcel.taxabilityFull} />}
                  </div>
                  <div className="text-[9px] text-on-surface-variant italic">
                    Public assessor record · not market value (Prop 13 anchors to purchase year)
                  </div>
                </div>
              ),
            });
          }

          return (
            <div className="rounded-lg border border-card-border bg-surface-container-low/60 px-3 py-2 space-y-2">
              {/* Header row: Parcel Details label + APN */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon icon="location_searching" className="text-[12px] text-primary" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                    Parcel Details
                  </span>
                </div>
                {parcel.apn && (
                  <span className="font-mono text-[9px] text-on-surface-variant">{parcel.apn}</span>
                )}
              </div>

              {/* At-a-glance row: the 5-7 fields that drive a decision. */}
              {glanceItems.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {glanceItems.map((it, i) => (
                    <Row key={i} label={it.label} value={it.value} />
                  ))}
                </div>
              )}

              {/* Absentee badge — surface up top for Pro when applicable.
                  Even if the Owner section is collapsed, the badge is
                  what makes the parcel actionable as a prospect. */}
              {isAbsentee && !expandedSections['owner'] && (
                <button
                  onClick={() => toggleSection('owner')}
                  className="w-full flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-500/15 transition-colors"
                >
                  <MaterialIcon icon="flight_takeoff" className="text-[12px]" />
                  Absentee owner
                  <span className="ml-auto text-[9px] text-amber-400/70 font-medium">tap for details</span>
                </button>
              )}

              {/* Expand/collapse sections. Each row is a header with a
                  one-line preview; clicking expands the body inline. */}
              {sections.map(section => {
                const open = !!expandedSections[section.key];
                return (
                  <div key={section.key} className="rounded-md border border-card-border/50 overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-surface-container-high/50 transition-colors text-left"
                    >
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface shrink-0">
                          {section.header}
                        </span>
                        {!open && section.preview && (
                          <span className="text-[10px] text-on-surface-variant truncate">
                            {section.preview}
                          </span>
                        )}
                      </div>
                      <MaterialIcon
                        icon={open ? 'expand_less' : 'expand_more'}
                        className="text-[16px] text-on-surface-variant shrink-0"
                      />
                    </button>
                    {open && (
                      <div className="px-2 pb-2 pt-1 border-t border-card-border/30">
                        {section.body}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════ */}
        {/* REFERENCE PROPERTY CARD — market context, not call workflow */}
        {/* ════════════════════════════════════════════════════════ */}
        {isReference && (
          <>
            {/* Snapshot: price + status + DOM */}
            <div className={cn("flex items-center gap-2 flex-wrap", isFree && "relative")}>
              <div className={cn(isFree && "blur-sm select-none", "flex items-center gap-2 flex-wrap")}>
                {priceStr && <span className="font-bold text-on-surface">{priceStr}</span>}
                {statusText && <span className={`font-semibold text-sm ${statusColor}`}>{statusText}</span>}
                {ppsf && <span className="text-xs text-on-surface-variant">{ppsf}</span>}
              </div>
              {isFree && (
                <button onClick={() => setUpgradeFeature('marketData')} className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary bg-card/80 px-2 py-0.5 rounded-full border border-primary/30">Upgrade to see</span>
                </button>
              )}
            </div>

            {/* Key dates + facts grid */}
            <div className={cn(isFree && "blur-sm select-none")}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {lead.sqft && <div className="flex justify-between"><span className="text-on-surface-variant">Sqft</span><span className="text-on-surface font-medium">{lead.sqft.toLocaleString()}</span></div>}
                {lead.year_built && <div className="flex justify-between"><span className="text-on-surface-variant">Built</span><span className="text-on-surface font-medium">{lead.year_built}</span></div>}
                {lead.lot_acres && <div className="flex justify-between"><span className="text-on-surface-variant">Lot</span><span className="text-on-surface font-medium">{lead.lot_acres} ac</span></div>}
                {lead.dom != null && <div className="flex justify-between"><span className="text-on-surface-variant">DOM</span><span className="text-on-surface font-medium">{lead.dom} days</span></div>}
                {lead.listing_date && <div className="flex justify-between"><span className="text-on-surface-variant">Listed</span><span className="text-on-surface font-medium">{formatDate(lead.listing_date)}</span></div>}
                {lead.pending_date && <div className="flex justify-between"><span className="text-on-surface-variant">Pending</span><span className="text-on-surface font-medium">{formatDate(lead.pending_date)}</span></div>}
                {lead.selling_date && <div className="flex justify-between"><span className="text-on-surface-variant">Sold</span><span className="text-on-surface font-medium">{formatDate(lead.selling_date)}</span></div>}
              </div>
            </div>

            {/* Talking points — what happened here */}
            {talkingPoints.length > 0 && (
              <div className={cn("py-2 border-t border-card-border/50", isFree && "blur-sm select-none")}>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">What happened</p>
                {talkingPoints.map((pt, i) => (
                  <p key={i} className="text-xs text-on-surface-variant leading-relaxed">
                    <span className="text-primary mr-1">·</span>{pt}
                  </p>
                ))}
              </div>
            )}

            {/* Neighbor context — how to use this in calls */}
            {neighborContext.length > 0 && (
              <div className={cn("py-2 border-t border-card-border/50", isFree && "blur-sm select-none")}>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Use in nearby calls</p>
                {neighborContext.map((pt, i) => (
                  <p key={i} className="text-xs text-on-surface-variant leading-relaxed">
                    <span className="text-emerald-400 mr-1">→</span>{pt}
                  </p>
                ))}
              </div>
            )}

            {/* Add context — paste box for admin/users to add market data */}
            <div className="pt-2 border-t border-card-border/50">
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Add Market Context</p>
              <div className="relative">
                <textarea
                  value={contextPaste}
                  onChange={(e) => setContextPaste(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-on-surface-variant/40"
                  placeholder="Paste MLS remarks, agent notes, concessions..."
                />
                {contextPaste.trim() && (
                  <button onClick={saveContext}
                    className="absolute right-2 bottom-2 text-[10px] font-bold text-primary hover:underline">
                    Save
                  </button>
                )}
                {contextSaved && <span className="absolute right-2 bottom-2 text-[10px] text-emerald-500 font-bold">Saved</span>}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* LEAD / PROSPECT CARD — call workflow */}
        {/* ════════════════════════════════════════════════════════ */}
        {!isReference && (
          <>
            {/* ──────── Pro: raw Owner Contact block ──────── */}
            {/* Only renders for Pro edition. Lite never sees raw owner data
             *  here — they continue to interact only via the Plot system
             *  channels below. Same data on the lead row regardless of
             *  edition; this is purely a render-policy gate.
             */}
            {plotEdition === 'pro' && (lead.owner_name || lead.phone || lead.email) && (
              <div className="rounded-lg border border-card-border bg-card p-2 text-xs space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Owner contact
                </div>
                {lead.owner_name && (
                  <div className="font-semibold text-on-surface">{lead.owner_name}</div>
                )}
                {[lead.phone, lead.phone_2, lead.phone_3]
                  .filter((p): p is string => !!p)
                  .map((phone, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isDesktop) {
                          makeCall(phone, lead.owner_name || lead.name || 'Unknown', lead.id);
                        } else {
                          window.location.href = `tel:${phone}`;
                        }
                      }}
                      className="flex items-center gap-1 text-emerald-500 hover:underline font-bold"
                    >
                      <MaterialIcon icon="call" className="text-[12px]" />
                      {formatPhone(phone)}
                    </button>
                  ))}
                {lead.email && (
                  <div className="text-on-surface-variant break-all">{lead.email}</div>
                )}
                {lead.mailing_address && lead.mailing_address !== lead.property_address && (
                  <div className="text-on-surface-variant text-[11px]">
                    Mail: {lead.mailing_address}
                  </div>
                )}
              </div>
            )}

            {/* ──────── Plot platform — channel-aware inquiry actions ──────── */}
            {/* Self-score state, if any (no buyer info ever shown). */}
            {lead.self_score_state && (
              <div className="rounded-lg border border-card-border bg-surface-container-low p-2 text-xs">
                <div className="font-semibold text-on-surface">
                  Owner self-score:{' '}
                  <span className="text-emerald-400">
                    {lead.self_score_state.state === 'here_to_stay' && 'Staying put'}
                    {lead.self_score_state.state === 'curious_to_hear_offers' && 'Curious to hear offers'}
                    {lead.self_score_state.state === 'would_sell_if' && (
                      <>
                        Would sell if {lead.self_score_state.condition || '—'}
                      </>
                    )}
                  </span>
                </div>
                {lead.self_score_state.visibility === 'private_to_initiator' && (
                  <div className="text-[10px] text-on-surface-variant mt-0.5">Private to your inquiry</div>
                )}
                {/* Verification badge text */}
                {lead.verification_state && lead.verification_state.tier !== 'unverified' && (
                  <div className="text-[10px] mt-0.5">
                    {lead.verification_state.tier === 'agent_attested' && (
                      <span className="text-amber-400">Verified by agent</span>
                    )}
                    {lead.verification_state.tier === 'owner' && (
                      <span className="text-emerald-400">Verified owner</span>
                    )}
                    {lead.verification_state.tier === 'manager' && (
                      <span className="text-on-surface-variant">Manager-claimed</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Agent verification — discrete inline link only, no beacon.
             *  The verification path exists for agents who want to use it
             *  but is NOT a workflow we push from the map. The dedicated
             *  /dashboard/agent/verifications page is where agents go
             *  when they're in verification-mode. */}
            {lead.verification_state?.needs_verification && (
              <a
                href={`/dashboard/agent/verifications?lead=${lead.id}`}
                className="text-[10px] text-on-surface-variant hover:text-on-surface underline self-start"
              >
                Owner requested agent verification →
              </a>
            )}
            {/* Inquiry-state row */}
            {lead.inquiry_state && (
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                Inquiry: {lead.inquiry_state.channel.replace('_', ' ')} — {lead.inquiry_state.status}
              </div>
            )}
            {/* Channel actions: text invitation, mail letter, dial. No name or phone is shown. */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fireArmedInquiry('text_invite')}
                disabled={
                  inquiryStatus === 'sending' ||
                  lead.inquiry_state?.channel === 'text_invite' ||
                  !!lead.text_declined
                }
                title={lead.text_declined ? 'This property declined text inquiries — try direct mail instead' : undefined}
                className="flex items-center gap-1 rounded-md bg-primary/20 hover:bg-primary/30 px-2 py-1 text-[11px] font-bold text-primary disabled:opacity-50"
              >
                <MaterialIcon icon="mail" className="text-[14px]" />
                Send invitation
              </button>
              <button
                onClick={() => fireArmedInquiry('direct_mail')}
                disabled={inquiryStatus === 'sending'}
                className="flex items-center gap-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 text-[11px] font-bold text-amber-400 disabled:opacity-50"
              >
                <MaterialIcon icon="inventory_2" className="text-[14px]" />
                Send letter
              </button>
              <button
                onClick={() => fireArmedInquiry('phone_call', 'fire')}
                disabled={inquiryStatus === 'sending'}
                className="flex items-center gap-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-1 text-[11px] font-bold text-emerald-400 disabled:opacity-50"
              >
                <MaterialIcon icon="call" className="text-[14px]" />
                Dial
              </button>
            </div>
            {lead.text_declined && (
              <div className="text-[10px] text-on-surface-variant italic">
                This property declined text inquiries. Try direct mail instead.
              </div>
            )}
            {inquiryStatus === 'sent' && (
              <div className="text-[10px] text-emerald-400">Inquiry queued.</div>
            )}
            {inquiryStatus === 'failed' && inquiryError && (
              <div className="text-[10px] text-rose-400">{inquiryError}</div>
            )}
          </>
        )}
        {!isReference && (
          <>
            {/* Owner name and phone numbers intentionally not shown.
             *  Plot's universal product trait: raw owner identity stays
             *  server-side and is reached only via the channel-aware
             *  inquiry actions above. */}

            {/* Script (collapsed by default) */}
            {profile.openingScript && isCallable && (
              <div>
                <button onClick={() => setScriptOpen(!scriptOpen)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80">
                  <MaterialIcon icon={scriptOpen ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                  Script
                </button>
                {scriptOpen && (
                  <div className="mt-1 rounded-lg bg-surface-container-low border border-card-border p-2">
                    {editingScript ? (
                      <div>
                        <textarea value={localScript} onChange={(e) => setLocalScript(e.target.value)} rows={4}
                          className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-[11px] text-on-surface leading-snug focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                        <button onClick={() => setEditingScript(false)} className="text-[10px] font-bold text-primary hover:underline mt-1">Done</button>
                      </div>
                    ) : (
                      <div onClick={() => { setLocalScript(fillScript(profile.openingScript, lead)); setEditingScript(true); }} className="cursor-pointer">
                        <p className="text-[11px] text-on-surface-variant leading-snug whitespace-pre-line">{fillScript(profile.openingScript, lead)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Note input */}
            <div className="relative">
              <input type="text" value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); }}
                className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-on-surface-variant/50"
                placeholder="Quick note..." />
              {saved && <span className="absolute right-2 top-2 text-[10px] text-emerald-500 font-bold">Saved</span>}
            </div>

            {/* Call outcomes — ONLY if callable */}
            {isCallable && (
              outcomeLogged ? (
                <div className="flex items-center gap-2 justify-center py-1">
                  <MaterialIcon icon="check_circle" className="text-[16px] text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600">Logged: {outcomeLogged}</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { outcome: 'No Answer' as CallOutcome, icon: 'phone_disabled', label: 'No Ans' },
                    { outcome: 'Left VM' as CallOutcome, icon: 'voicemail', label: 'VM' },
                    { outcome: 'Spoke with Owner' as CallOutcome, icon: 'forum', label: 'Spoke' },
                    { outcome: 'DNC' as CallOutcome, icon: 'block', label: 'DNC' },
                  ]).map(({ outcome, icon, label }) => (
                    <button key={outcome} onClick={() => logOutcome(outcome)}
                      className="flex flex-col items-center py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/20 text-[9px] font-semibold text-on-surface-variant hover:text-primary transition-all">
                      <MaterialIcon icon={icon} className="text-[14px] mb-0.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* ── OPEN FULL RECORD (both types) ── */}
        <Link href={`/leads/${lead.id}`}
          className="block w-full text-center rounded-lg bg-primary text-white text-xs font-bold py-2 hover:bg-primary/90 transition-colors">
          Open Full Record
        </Link>
      </div>

      <UpgradeGate
        feature={upgradeFeature as 'dialer' | 'marketData' | 'aiCaller'}
        show={!!upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
      />

    </div>
  );
}
