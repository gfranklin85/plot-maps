"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lead } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { usePhone } from "@/lib/phone-context";

// PropertyPopup — Plot's in-flight hologram projection over a selected
// property. Locked 2026-05-28 evening. Replaces the prior dense card.
// Brand thesis: this is NOT a glass object; it's an information field
// surfaced from the substrate (see project-design-intelligence-thesis).
// All content is fully resolved frame 1 — no entrance animations on
// content (see feedback-no-focus-in-animations). Ambient effects only:
// breathing outer bloom and slow rim sweep.
//
// Data resolution: lead.id may be a stub
//   parcel:<APN>    → /api/parcel?apn=…       (PostGIS parcel)
//   gpoi:<placeId>  → /api/google-poi?…       (Google Place Details)
//   addr:<id>       → /api/addresses/[id]     (Plot address layer)
//   normal id       → /api/parcel?lat=&lng=   (proximity guess)
//
// Workflows that lived in the prior popup (call outcomes, script editor,
// market context paste, parcel section expanders, owner-tier gate) now
// live on /leads/[id] — accessed via the Open Full Record action.

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
  onToggleProspectMode?: () => void;
  prospectMode?: boolean;
  /** Close handler — renders the X button when provided. */
  onClose?: () => void;
  /** Pin handler — renders the pin button when provided. */
  onPin?: () => void;
}

export default function PropertyPopup({ lead, onUpdate, onClose, onPin }: Props) {
  const { makeCall, isDesktop } = usePhone();

  // Resolver state slots — exactly one is populated based on stub id.
  const [parcel, setParcel] = useState<import('@/lib/property-data/types').ResolvedProperty | null>(null);
  const [googlePoi, setGooglePoi] = useState<{
    placeId: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    types: string[];
    phone: string | null;
    website: string | null;
  } | null>(null);
  const [addressRecord, setAddressRecord] = useState<{
    id: number;
    fullAddress: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null>(null);

  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = lead.id ?? '';
    if (id.startsWith('addr:')) {
      fetch(`/api/addresses/${encodeURIComponent(id.slice(5))}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!cancelled && data) setAddressRecord(data); })
        .catch(() => { /* silent */ });
      return () => { cancelled = true; };
    }
    if (id.startsWith('gpoi:')) {
      fetch(`/api/google-poi?placeId=${encodeURIComponent(id.slice(5))}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!cancelled && data) setGooglePoi(data); })
        .catch(() => { /* silent */ });
      return () => { cancelled = true; };
    }
    const apn = id.startsWith('parcel:') ? id.slice(7) : null;
    const url = apn
      ? `/api/parcel?apn=${encodeURIComponent(apn)}`
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

  // ── Address composition ────────────────────────────────────────
  // Prefer in this order: lead row → parcel resolver → address layer
  // → Google POI. Split into headline (street) + tail (city/state/zip).
  const fullAddr = lead.property_address
    || parcel?.address
    || addressRecord?.fullAddress
    || googlePoi?.address
    || '';
  const poiName = googlePoi?.name ?? null;
  const headline = poiName || (fullAddr.split(',')[0]?.trim() || 'Unknown address');
  const tail = poiName
    ? fullAddr
    : fullAddr.split(',').slice(1).join(',').trim();

  // ── Coordinates ghost (the surveyor's tell) ────────────────────
  const coords = lead.latitude != null && lead.longitude != null
    ? `${Math.abs(lead.latitude).toFixed(4)}° ${lead.latitude >= 0 ? 'N' : 'S'} · ${Math.abs(lead.longitude).toFixed(4)}° ${lead.longitude >= 0 ? 'E' : 'W'}`
    : null;

  // ── Status + price ─────────────────────────────────────────────
  const status = lead.listing_status as 'Active' | 'Pending' | 'Sold' | null | undefined;
  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : null;
  const priceLabel = lead.selling_price ? 'sold price' : lead.listing_price ? 'list price' : null;

  // ── Stat grid values (lead row → parcel resolver fallback) ────
  const beds = lead.bedrooms ?? (typeof parcel?.bedrooms === 'number' ? parcel.bedrooms : null);
  const baths = lead.bathrooms ?? (typeof parcel?.bathrooms === 'number' ? parcel.bathrooms : null);
  const sqft = lead.sqft ?? (parcel?.buildingSize ?? null);
  const lot = lead.lot_acres
    ? `${lead.lot_acres} ac`
    : (parcel?.acres != null ? `${parcel.acres.toFixed(2)} ac` : null);
  const built = lead.year_built ?? parcel?.yearBuilt ?? null;
  const apn = parcel?.apn ?? null;

  // ── Action targeting (listed → listing agent, unlisted → owner) ──
  const isListed = !!status && status !== 'Sold';
  const ownerPhone = lead.phone || lead.phone_2 || lead.phone_3 || null;

  const dialPhone = isListed
    ? (lead.listing_agent_phone || null)
    : ownerPhone;
  const dialTarget = isListed
    ? (lead.listing_agent_name || lead.listing_office_name || 'listing agent')
    : (lead.owner_name || lead.name || 'owner');

  const fireInquiry = async (channel: 'text_invite' | 'direct_mail' | 'phone_call') => {
    setInquiryStatus('sending');
    setInquiryError(null);
    try {
      const res = await fetch('/api/inquiry/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, channel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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

  const handleDial = () => {
    if (!dialPhone) return;
    if (isDesktop) {
      makeCall(dialPhone, dialTarget, lead.id);
    } else {
      window.location.href = `tel:${dialPhone}`;
    }
  };

  // ── Photo carousel source ──────────────────────────────────────
  // Prefers listing_photo_urls[] (full MLS media set) and falls back
  // to listing_photo_url (single thumbnail). Mock data and the live
  // RESO feed both flow through this path.
  const photos: string[] = (() => {
    if (Array.isArray(lead.listing_photo_urls) && lead.listing_photo_urls.length > 0) {
      // Filter empties + de-dupe in case the feed has both fields
      const seen = new Set<string>();
      const out: string[] = [];
      for (const u of lead.listing_photo_urls) {
        if (typeof u === 'string' && u && !seen.has(u)) {
          seen.add(u);
          out.push(u);
        }
      }
      if (out.length > 0) return out;
    }
    if (lead.listing_photo_url) return [lead.listing_photo_url];
    return [];
  })();
  const hasPhotos = photos.length > 0;
  const [photoIdx, setPhotoIdx] = useState(0);
  // Reset index when the lead changes so the carousel doesn't carry
  // a stale index from the prior property
  useEffect(() => { setPhotoIdx(0); }, [lead.id]);
  const goPrev = () => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setPhotoIdx((i) => (i + 1) % photos.length);

  return (
    <div className="plot-popup">
      {/* registration marks — surveyor's tell, sit OUTSIDE the rounded edge */}
      <span className="reg tl" />
      <span className="reg tr" />
      <span className="reg bl" />
      <span className="reg br" />
      <span className="tick t" />
      <span className="tick b" />
      <span className="tick l" />
      <span className="tick r" />

      {/* Top-right chrome — Pin + Close. Tucked into the popup's
          upper-right corner. Sits at z-index 3 above the hero pill. */}
      {(onPin || onClose) && (
        <div className="chrome">
          {onPin && (
            <button type="button" className="chrome-btn" onClick={onPin} title="Pin as reference">
              <MaterialIcon icon="push_pin" className="text-[14px]" />
            </button>
          )}
          {onClose && (
            <button type="button" className="chrome-btn" onClick={onClose} title="Close">
              <MaterialIcon icon="close" className="text-[14px]" />
            </button>
          )}
        </div>
      )}

      {/* ── HERO PHOTO CAROUSEL ────────────────────────────────
          Renders when listing photos are present. Single photo →
          static image with overlaid status pill. Multiple photos →
          scrollable carousel with prev/next arrows and a count
          indicator. Pattern mirrors Zillow's listing card model. */}
      {hasPhotos && (
        <div className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[photoIdx]}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          {status && (
            <div className={`pill pill-${status.toLowerCase()}`}>{status.toUpperCase()}</div>
          )}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-btn carousel-prev"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Previous photo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                className="carousel-btn carousel-next"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next photo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <div className="carousel-count">{photoIdx + 1} / {photos.length}</div>
            </>
          )}
        </div>
      )}

      {/* ── IDENTITY ─────────────────────────────────────────────── */}
      <div className="identity">
        <div className="addr-row">
          <div className="addr">
            <div className="addr-head">{headline}</div>
            {tail && <div className="addr-tail">{tail}</div>}
            {coords && <div className="coords">{coords}</div>}
          </div>
          {/* pill renders here when there's no hero image */}
          {!hasPhotos && status && (
            <div className={`pill pill-${status.toLowerCase()} pill-inline`}>{status.toUpperCase()}</div>
          )}
        </div>

        {priceStr && (
          <div className="price-row">
            <div className="price">{priceStr}</div>
            {priceLabel && <div className="price-meta">{priceLabel}</div>}
          </div>
        )}
      </div>

      {/* ── LUMEN SEAM (data substrate boundary) ────────────────── */}
      <div className="seam" />

      {/* ── STAT LEDGER (graceful — only renders what's available) */}
      {(beds != null || baths != null || sqft != null || lot != null || built != null || apn != null) && (
        <div className="stats">
          {beds != null && (<Stat label="Beds" value={String(beds)} />)}
          {baths != null && (<Stat label="Baths" value={String(baths)} />)}
          {sqft != null && (<Stat label="Living" value={`${sqft.toLocaleString()} SF`} />)}
          {lot != null && (<Stat label="Lot" value={lot} />)}
          {built != null && (<Stat label="Built" value={String(built)} />)}
          {apn != null && (<Stat label="APN" value={apn} mono />)}
        </div>
      )}

      {/* ── ACTION ROW ──────────────────────────────────────────── */}
      <div className="actions">
        <ActionBtn
          icon="call"
          label="Dial"
          tooltip={dialPhone ? `Dial ${dialTarget}` : 'No phone available'}
          disabled={!dialPhone || inquiryStatus === 'sending'}
          onClick={handleDial}
        />
        <ActionBtn
          icon="mail"
          label="Mail"
          tooltip="Send postcard to this address"
          disabled={inquiryStatus === 'sending'}
          onClick={() => fireInquiry('direct_mail')}
        />
        <ActionBtn
          icon="sms"
          label="Text"
          tooltip={isListed ? `Text ${dialTarget}` : 'Send Plot invitation'}
          disabled={inquiryStatus === 'sending' || !!lead.text_declined}
          onClick={() => fireInquiry('text_invite')}
        />
        <Link href={`/leads/${lead.id}`} className="action open-record" title="Open full record">
          <MaterialIcon icon="open_in_full" className="text-[16px]" />
          <span className="lab">Record</span>
        </Link>
      </div>

      {inquiryStatus === 'sent' && (
        <div className="inquiry-toast inquiry-toast-ok">Inquiry queued.</div>
      )}
      {inquiryStatus === 'failed' && inquiryError && (
        <div className="inquiry-toast inquiry-toast-err">{inquiryError}</div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <div className="footer">
        <div className="captured">
          <span className="dot" />
          Plot · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} PT
        </div>
        <div className="mark">PLOT <span className="pl">PL</span></div>
      </div>

      {/* All component styles scoped under .plot-popup.
          Consumes the canonical --plot-* token palette so the popup
          inverts with the active theme (light/dark) without code
          changes — see src/lib/theme-context.tsx + globals.css. */}
      <style jsx>{`
        .plot-popup{
          position:relative;
          width:380px;
          border-radius:14px;
          padding:18px 18px 20px;
          color:var(--plot-text);
          font-family:'Inter', system-ui, -apple-system, sans-serif;
          font-feature-settings:'ss01','cv11';
          isolation:isolate;
          /* Atmospheric pooling — soft warm pools on the base color.
             Both themes get the same recipe; the base shifts the mood. */
          background:
            radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--plot-edge) 14%, transparent) 0px, transparent 45%),
            radial-gradient(circle at 8% 88%,  color-mix(in srgb, var(--plot-edge) 10%, transparent) 0px, transparent 50%),
            radial-gradient(circle at 50% 50%, var(--plot-base-deep) 0px, transparent 70%),
            var(--plot-base);
          /* glow stack: hard rim, tight, far halo, inside edge, inner highlight */
          box-shadow:
            0 0 1px 0 var(--plot-edge),
            0 0 14px 0 color-mix(in srgb, var(--plot-edge) 80%, transparent),
            0 0 36px -2px color-mix(in srgb, var(--plot-edge-bloom) 45%, transparent),
            inset 0 0 0 1.5px var(--plot-edge),
            inset 0 0 10px 0 color-mix(in srgb, var(--plot-edge-hot) 35%, transparent);
        }
        .plot-popup::before{
          /* breathing outer bloom — ambient ~5s loop */
          content:""; position:absolute; inset:0;
          border-radius:14px; z-index:-1; pointer-events:none;
          box-shadow:
            0 0 28px 1px color-mix(in srgb, var(--plot-edge-bloom) 75%, transparent),
            0 0 64px 8px color-mix(in srgb, var(--plot-edge-bloom) 20%, transparent);
          animation: plot-popup-breathe 5s ease-in-out infinite;
          will-change:opacity, transform;
        }
        @keyframes plot-popup-breathe{
          0%,100%{ opacity:0.68; transform:scale(1.000); }
          50%   { opacity:1.00; transform:scale(1.010); }
        }

        /* registration corners — surveyor's tell */
        .reg{ position:absolute; width:14px; height:14px; pointer-events:none; z-index:2; }
        .reg.tl{ top:-6px;    left:-6px;   border-top:1.5px solid var(--plot-edge); border-left:1.5px solid var(--plot-edge); }
        .reg.tr{ top:-6px;    right:-6px;  border-top:1.5px solid var(--plot-edge); border-right:1.5px solid var(--plot-edge); }
        .reg.bl{ bottom:-6px; left:-6px;   border-bottom:1.5px solid var(--plot-edge); border-left:1.5px solid var(--plot-edge); }
        .reg.br{ bottom:-6px; right:-6px;  border-bottom:1.5px solid var(--plot-edge); border-right:1.5px solid var(--plot-edge); }

        /* midpoint tick marks */
        .tick{ position:absolute; background:var(--plot-edge); pointer-events:none; opacity:0.85; z-index:2; }
        .tick.t{ top:-3.5px;   left:50%; transform:translateX(-50%); width:1.5px; height:6px; }
        .tick.b{ bottom:-3.5px;left:50%; transform:translateX(-50%); width:1.5px; height:6px; }
        .tick.l{ left:-3.5px;  top:50%;  transform:translateY(-50%); width:6px; height:1.5px; }
        .tick.r{ right:-3.5px; top:50%;  transform:translateY(-50%); width:6px; height:1.5px; }

        /* top-right chrome — Pin + Close */
        .chrome{
          position:absolute;
          top:10px; right:10px;
          z-index:3;
          display:flex;
          gap:6px;
        }
        .chrome-btn{
          width:24px; height:24px;
          display:flex; align-items:center; justify-content:center;
          background:color-mix(in srgb, var(--plot-base-deep) 70%, transparent);
          border:1px solid var(--plot-divider-strong);
          border-radius:4px;
          color:var(--plot-edge);
          cursor:pointer;
          padding:0;
          backdrop-filter:blur(3px);
          -webkit-backdrop-filter:blur(3px);
          transition:background 120ms ease, color 120ms ease, border-color 120ms ease;
        }
        .chrome-btn:hover{
          background:color-mix(in srgb, var(--plot-edge) 22%, transparent);
          border-color:var(--plot-edge-bloom);
          color:var(--plot-edge-hot);
        }

        /* ── hero photo (and carousel) ────────────────────── */
        .hero{
          position:relative;
          width:100%;
          height:148px;
          border-radius:8px;
          overflow:hidden;
          margin-bottom:14px;
          background:var(--plot-base-deep);
          box-shadow: inset 0 -42px 50px -32px color-mix(in srgb, var(--plot-base-deep) 80%, black);
        }
        .hero img{
          width:100%; height:100%; display:block;
          object-fit:cover;
        }

        /* carousel arrows + count indicator */
        .carousel-btn{
          position:absolute;
          top:50%;
          transform:translateY(-50%);
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          background:color-mix(in srgb, var(--plot-base-deep) 80%, transparent);
          border:1px solid var(--plot-divider-strong);
          border-radius:9999px;
          color:var(--plot-text);
          cursor:pointer;
          padding:0;
          z-index:3;
          backdrop-filter:blur(4px);
          -webkit-backdrop-filter:blur(4px);
          opacity:0.85;
          transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
        }
        .carousel-btn:hover{
          opacity:1;
          background:color-mix(in srgb, var(--plot-signal) 22%, var(--plot-base-deep));
          color:var(--plot-signal);
        }
        .carousel-prev{ left:8px; }
        .carousel-next{ right:8px; }
        .carousel-count{
          position:absolute;
          bottom:8px; right:10px;
          z-index:3;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:10px;
          letter-spacing:0.14em;
          color:var(--plot-text);
          padding:3px 7px;
          background:color-mix(in srgb, var(--plot-base-deep) 70%, transparent);
          border-radius:9999px;
          backdrop-filter:blur(4px);
          -webkit-backdrop-filter:blur(4px);
        }

        /* ── identity ────────────────────────────────────── */
        .identity{ display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
        .addr-row{ display:flex; gap:10px; align-items:flex-start; justify-content:space-between; }
        .addr{ min-width:0; flex:1; }
        .addr-head{
          font-size:16px;
          font-weight:600;
          line-height:1.2;
          letter-spacing:-0.012em;
          color:var(--plot-text);
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .addr-tail{
          font-size:12px;
          font-weight:400;
          margin-top:1px;
          color:var(--plot-text-muted);
        }
        .coords{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:400;
          letter-spacing:0.06em;
          margin-top:3px;
          color:var(--plot-text-faint);
        }
        .price-row{
          display:flex; align-items:baseline; gap:10px; margin-top:6px;
        }
        .price{
          font-size:24px;
          font-weight:600;
          line-height:1;
          letter-spacing:-0.018em;
          font-variant-numeric:tabular-nums;
          color:var(--plot-edge-hot);
          text-shadow:0 0 14px color-mix(in srgb, var(--plot-edge-bloom) 30%, transparent);
        }
        .price-meta{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:400;
          letter-spacing:0.14em;
          text-transform:uppercase;
          color:var(--plot-text-muted);
        }

        /* ── status pill ─────────────────────────────────── */
        .pill{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:500;
          letter-spacing:0.26em;
          padding:4px 9px;
          line-height:1;
          border-radius:2px;
          backdrop-filter:blur(4px);
          -webkit-backdrop-filter:blur(4px);
          background:color-mix(in srgb, var(--plot-base-deep) 60%, transparent);
          flex-shrink:0;
        }
        .pill-active{
          color:var(--plot-status-active);
          border:1px solid color-mix(in srgb, var(--plot-status-active) 80%, transparent);
          text-shadow:0 0 6px color-mix(in srgb, var(--plot-status-active) 55%, transparent);
          box-shadow:0 0 10px -2px color-mix(in srgb, var(--plot-status-active) 55%, transparent);
          animation: plot-pill-breathe 5s ease-in-out infinite;
        }
        .pill-pending{
          color:var(--plot-status-pending);
          border:1px solid color-mix(in srgb, var(--plot-status-pending) 70%, transparent);
        }
        .pill-sold{
          color:var(--plot-status-sold);
          border:1px solid color-mix(in srgb, var(--plot-status-sold) 60%, transparent);
        }
        @keyframes plot-pill-breathe{
          0%,100%{ box-shadow:0 0 8px -2px color-mix(in srgb, var(--plot-status-active) 40%, transparent); }
          50%   { box-shadow:0 0 20px -2px color-mix(in srgb, var(--plot-status-active) 85%, transparent); }
        }
        /* pill positioned over hero image, top-LEFT
           (top-right is reserved for the Pin/Close chrome) */
        .hero .pill{
          position:absolute;
          top:12px; left:12px;
          z-index:2;
        }
        /* pill positioned inline next to address when no hero */
        .pill-inline{ align-self:flex-start; margin-top:2px; }

        /* ── lumen seam ──────────────────────────────────── */
        .seam{
          position:relative;
          height:1.5px;
          border-radius:2px;
          margin:4px 0 14px;
          background:linear-gradient(90deg,
            transparent 0%,
            var(--plot-edge-bloom) 14%,
            var(--plot-edge-hot) 42%,
            var(--plot-edge-hot) 58%,
            var(--plot-edge-bloom) 86%,
            transparent 100%);
          box-shadow:
            0 0 18px 0 color-mix(in srgb, var(--plot-edge-bloom) 70%, transparent),
            0 0 6px  0 color-mix(in srgb, var(--plot-edge-hot) 85%, transparent),
            0 0 2px  0 var(--plot-edge-hot);
        }
        .seam::before, .seam::after{ content:""; position:absolute; pointer-events:none; left:8%; right:8%; }
        .seam::before{ bottom:100%; height:20px; background:radial-gradient(ellipse at center bottom, color-mix(in srgb, var(--plot-edge-bloom) 35%, transparent), transparent 70%); }
        .seam::after{ top:100%; height:16px; background:radial-gradient(ellipse at center top, color-mix(in srgb, var(--plot-edge-bloom) 22%, transparent), transparent 70%); }

        /* ── stat ledger ─────────────────────────────────── */
        .stats{
          display:grid;
          grid-template-columns:1fr 1fr;
          column-gap:28px;
          row-gap:10px;
          margin-bottom:14px;
        }

        /* ── action row ──────────────────────────────────── */
        .actions{
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:8px;
          margin-top:4px;
        }
        .action{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:3px;
          padding:9px 4px 8px;
          background:color-mix(in srgb, var(--plot-base-deep) 60%, transparent);
          border:1px solid color-mix(in srgb, var(--plot-edge) 55%, transparent);
          border-radius:6px;
          color:var(--plot-edge);
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:500;
          letter-spacing:0.18em;
          text-transform:uppercase;
          cursor:pointer;
          transition:background 120ms ease, border-color 120ms ease, color 120ms ease;
          text-decoration:none;
        }
        .action:hover:not(:disabled){
          background:color-mix(in srgb, var(--plot-signal) 16%, transparent);
          border-color:var(--plot-signal);
          color:var(--plot-signal);
        }
        .action:disabled,
        .action[aria-disabled="true"]{
          opacity:0.35;
          cursor:not-allowed;
        }
        .open-record{
          border-color:color-mix(in srgb, var(--plot-edge) 85%, transparent);
        }

        /* ── inquiry toast (inline below actions) ────────── */
        .inquiry-toast{
          margin-top:8px;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          letter-spacing:0.14em;
          text-transform:uppercase;
        }
        .inquiry-toast-ok{ color:var(--plot-status-active); }
        .inquiry-toast-err{ color:var(--plot-status-sold); }

        /* ── footer ──────────────────────────────────────── */
        .footer{
          margin-top:14px;
          padding-top:10px;
          border-top:1px dashed var(--plot-divider);
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .captured{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:400;
          letter-spacing:0.18em;
          text-transform:uppercase;
          color:var(--plot-text-faint);
        }
        .captured .dot{
          display:inline-block;
          width:5px; height:5px;
          border-radius:50%;
          background:var(--plot-signal);
          margin:0 7px 1px 0;
          vertical-align:middle;
          box-shadow:0 0 6px var(--plot-signal);
          animation: plot-dot-pulse 2.4s ease-in-out infinite;
        }
        @keyframes plot-dot-pulse{
          0%,100%{ opacity:0.55; }
          50%   { opacity:1.00; }
        }
        .mark{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:600;
          letter-spacing:0.32em;
          color:var(--plot-text-faint);
        }
        .mark .pl{ color:var(--plot-edge); }

        @media (prefers-reduced-motion: reduce){
          .plot-popup::before,
          .pill-active,
          .captured .dot{ animation:none; }
          .plot-popup::before{ opacity:0.85; }
        }
      `}</style>
    </div>
  );
}

// ── Stat row helper ────────────────────────────────────────────
function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="stat">
      <span className="lab">{label}</span>
      <span className={mono ? "val val-mono" : "val"}>{value}</span>
      <style jsx>{`
        .stat{
          display:flex;
          align-items:baseline;
          justify-content:space-between;
          gap:8px;
        }
        .lab{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:500;
          letter-spacing:0.16em;
          text-transform:uppercase;
          color:var(--plot-text-muted);
        }
        .val{
          font-size:12.5px;
          font-weight:500;
          font-variant-numeric:tabular-nums;
          letter-spacing:-0.005em;
          color:var(--plot-text);
          text-align:right;
        }
        .val-mono{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:11px;
          letter-spacing:0.02em;
        }
      `}</style>
    </div>
  );
}

// ── Action button helper ───────────────────────────────────────
function ActionBtn({
  icon,
  label,
  tooltip,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="action"
      title={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <MaterialIcon icon={icon} className="text-[16px]" />
      <span className="lab">{label}</span>
      <style jsx>{`
        .lab{ display:block; }
      `}</style>
    </button>
  );
}
