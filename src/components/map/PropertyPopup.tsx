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

  // ── Hero image source ──────────────────────────────────────────
  // Pulled from lead.listing_photo_url when present (MLS feed will
  // populate this June 18+). Demo data can set it on the mock JSON.
  const heroUrl = lead.listing_photo_url || null;

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

      {/* ── HERO (when image available) ────────────────────────── */}
      {heroUrl && (
        <div className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroUrl} alt="" />
          {status && (
            <div className={`pill pill-${status.toLowerCase()}`}>{status.toUpperCase()}</div>
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
          {!heroUrl && status && (
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

      {/* All component styles scoped under .plot-popup. */}
      <style jsx>{`
        .plot-popup{
          --gold:        #F2C063;
          --gold-bloom:  #FFD66B;
          --gold-hot:    #FFE9A8;
          --gold-inner:  #FFF4D6;
          --gold-30:     rgba(242,192,99,0.30);
          --gold-40:     rgba(242,192,99,0.40);
          --gold-60:     rgba(242,192,99,0.60);
          --fill:        rgba(22,16,6,0.94);
          --cream:       #F5EDD8;
          --cream-price: #FFE9A8;
          --cream-muted: rgba(245,237,216,0.58);
          --cream-faint: rgba(245,237,216,0.35);

          position:relative;
          width:380px;
          border-radius:14px;
          padding:18px 18px 20px;
          color:var(--cream);
          font-family:'Inter', system-ui, -apple-system, sans-serif;
          font-feature-settings:'ss01','cv11';
          isolation:isolate;
          /* Atmospheric pooling — warm gold pools on warm near-black */
          background:
            radial-gradient(circle at 88% 12%, rgba(255,214,107,0.18) 0px, transparent 45%),
            radial-gradient(circle at 8% 88%,  rgba(255,180,80,0.16) 0px, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(80,55,20,0.40) 0px, transparent 70%),
            radial-gradient(circle at 0% 0%,   rgba(60,40,15,0.30) 0px, transparent 45%),
            var(--fill);
          /* glow stack: hard rim, tight, far halo, inside edge, inner highlight */
          box-shadow:
            0 0 1px 0 rgba(242,192,99,1),
            0 0 14px 0 rgba(242,192,99,0.95),
            0 0 36px -2px rgba(255,214,107,0.55),
            inset 0 0 0 1.5px var(--gold),
            inset 0 0 10px 0 rgba(255,244,214,0.45);
        }
        .plot-popup::before{
          /* breathing outer bloom — ambient ~5s loop */
          content:""; position:absolute; inset:0;
          border-radius:14px; z-index:-1; pointer-events:none;
          box-shadow:
            0 0 28px 1px rgba(255,214,107,0.85),
            0 0 64px 8px rgba(255,214,107,0.25);
          animation: plot-popup-breathe 5s ease-in-out infinite;
          will-change:opacity, transform;
        }
        @keyframes plot-popup-breathe{
          0%,100%{ opacity:0.68; transform:scale(1.000); }
          50%   { opacity:1.00; transform:scale(1.010); }
        }

        /* registration corners — surveyor's tell */
        .reg{ position:absolute; width:14px; height:14px; pointer-events:none; z-index:2; }
        .reg.tl{ top:-6px;    left:-6px;   border-top:1.5px solid var(--gold); border-left:1.5px solid var(--gold); }
        .reg.tr{ top:-6px;    right:-6px;  border-top:1.5px solid var(--gold); border-right:1.5px solid var(--gold); }
        .reg.bl{ bottom:-6px; left:-6px;   border-bottom:1.5px solid var(--gold); border-left:1.5px solid var(--gold); }
        .reg.br{ bottom:-6px; right:-6px;  border-bottom:1.5px solid var(--gold); border-right:1.5px solid var(--gold); }

        /* midpoint tick marks */
        .tick{ position:absolute; background:var(--gold); pointer-events:none; opacity:0.85; z-index:2; }
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
          background:rgba(12,9,4,0.55);
          border:1px solid rgba(242,192,99,0.45);
          border-radius:4px;
          color:var(--gold);
          cursor:pointer;
          padding:0;
          backdrop-filter:blur(3px);
          -webkit-backdrop-filter:blur(3px);
          transition:background 120ms ease, color 120ms ease, border-color 120ms ease;
        }
        .chrome-btn:hover{
          background:rgba(242,192,99,0.20);
          border-color:var(--gold-bloom);
          color:var(--gold-hot);
        }

        /* ── hero photo ──────────────────────────────────── */
        .hero{
          position:relative;
          width:100%;
          height:148px;
          border-radius:8px;
          overflow:hidden;
          margin-bottom:14px;
          box-shadow: inset 0 -42px 50px -32px rgba(18,13,5,0.55);
        }
        .hero img{
          width:100%; height:100%; display:block;
          object-fit:cover;
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
          color:var(--cream);
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .addr-tail{
          font-size:12px;
          font-weight:400;
          margin-top:1px;
          color:var(--cream-muted);
        }
        .coords{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:400;
          letter-spacing:0.06em;
          margin-top:3px;
          color:var(--cream-faint);
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
          color:var(--cream-price);
          text-shadow:0 0 14px rgba(255,233,168,0.30);
        }
        .price-meta{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:400;
          letter-spacing:0.14em;
          text-transform:uppercase;
          color:var(--cream-muted);
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
          background:rgba(12,9,4,0.34);
          text-shadow:0 0 8px rgba(255,214,107,0.45);
          flex-shrink:0;
        }
        .pill-active{
          color:var(--gold);
          border:1px solid var(--gold);
          box-shadow:0 0 10px -2px rgba(255,214,107,0.55);
          animation: plot-pill-breathe 5s ease-in-out infinite;
        }
        .pill-pending{
          color: #FFD9A8;
          border:1px solid rgba(255,217,168,0.7);
        }
        .pill-sold{
          color: rgba(245,237,216,0.65);
          border:1px solid rgba(245,237,216,0.4);
          text-shadow:none;
        }
        @keyframes plot-pill-breathe{
          0%,100%{ box-shadow:0 0 8px -2px rgba(255,214,107,0.40); }
          50%   { box-shadow:0 0 20px -2px rgba(255,214,107,0.85); }
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
            rgba(255,214,107,0)  0%,
            var(--gold-bloom)   14%,
            var(--gold-hot)     42%,
            #FFF1B8             50%,
            var(--gold-hot)     58%,
            var(--gold-bloom)   86%,
            rgba(255,214,107,0)100%);
          box-shadow:
            0 0 18px 0 rgba(255,214,107,0.75),
            0 0 6px  0 rgba(255,214,107,0.95),
            0 0 2px  0 rgba(255,241,184,1.00);
        }
        .seam::before, .seam::after{ content:""; position:absolute; pointer-events:none; left:8%; right:8%; }
        .seam::before{ bottom:100%; height:20px; background:radial-gradient(ellipse at center bottom, rgba(255,214,107,0.36), transparent 70%); }
        .seam::after{ top:100%; height:16px; background:radial-gradient(ellipse at center top, rgba(255,214,107,0.24), transparent 70%); }

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
          background:rgba(12,9,4,0.34);
          border:1px solid rgba(242,192,99,0.55);
          border-radius:6px;
          color:var(--gold);
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
          background:rgba(242,192,99,0.18);
          border-color:var(--gold-bloom);
          color:var(--gold-hot);
        }
        .action:disabled,
        .action[aria-disabled="true"]{
          opacity:0.35;
          cursor:not-allowed;
        }
        .open-record{
          border-color:rgba(242,192,99,0.85);
        }

        /* ── inquiry toast (inline below actions) ────────── */
        .inquiry-toast{
          margin-top:8px;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          letter-spacing:0.14em;
          text-transform:uppercase;
        }
        .inquiry-toast-ok{ color:#aef0c0; }
        .inquiry-toast-err{ color:#f0a8a8; }

        /* ── footer ──────────────────────────────────────── */
        .footer{
          margin-top:14px;
          padding-top:10px;
          border-top:1px dashed rgba(242,192,99,0.25);
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
          color:var(--cream-faint);
        }
        .captured .dot{
          display:inline-block;
          width:5px; height:5px;
          border-radius:50%;
          background:var(--gold);
          margin:0 7px 1px 0;
          vertical-align:middle;
          box-shadow:0 0 6px var(--gold);
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
          color:var(--gold-40);
        }
        .mark .pl{ color:var(--gold); }

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
          color:rgba(245,237,216,0.58);
        }
        .val{
          font-size:12.5px;
          font-weight:500;
          font-variant-numeric:tabular-nums;
          letter-spacing:-0.005em;
          color:#F5EDD8;
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
