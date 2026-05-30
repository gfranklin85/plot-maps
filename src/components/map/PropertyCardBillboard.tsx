"use client";

// PropertyCardBillboard — the in-world property card. The Figma design
// (file gWtc7VDjRuFx5oYgU8FTvw, component set 32:30) translated to React.
//
// Architecture:
//   - One body, two variant axes: Status × Audience.
//     • Status (from listing_status): Active | Pending | Sold | Off Market
//       drives the pill color/label, the headline content, and whether
//       PITI math runs at all.
//     • Audience: Public | Agent | Position drives which button row
//       renders below the body.
//   - Reads BuyerSettings from context; the monthly headline recalculates
//     live when the user adjusts knobs in BuyerSettingsPanel.
//   - Off Market NEVER shows estimated monthly (per
//     feedback_no_gimmick_estimates_off_market). Hero becomes a cream
//     surface with a centered theodolite reticle + PLOT watermark.
//   - List price + address is the supporting line on Monthly mode.
//     In Price mode (user toggle), the headline IS the price and the
//     supporting line becomes "$X/mo est."

import { useEffect, useState } from "react";
import { Lead } from "@/types";
import type { ResolvedProperty } from "@/lib/property-data/types";
import { useBuyerSettings } from "@/lib/buyer-settings/context";
import { calculatePiti, formatMoney, formatPitiCaption } from "@/lib/buyer-settings/piti";

// Resolver: when the click handler creates a stub Lead with one of
// the recognized ID prefixes (parcel: / gpoi: / addr:), the lead carries
// almost no data. Fetch the real source row and merge it into a
// hydrated view of the lead so the card can render real facts. Mirrors
// the resolver originally inside PropertyPopup (lines 68-97 there).
interface ResolverState {
  parcel: ResolvedProperty | null;
  googlePoi: { placeId: string; name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
  addressRecord: { id: number; fullAddress: string } | null;
}

export type CardStatus = 'Active' | 'Pending' | 'Sold' | 'Off Market';
export type CardAudience = 'public' | 'agent' | 'position';

interface Props {
  lead: Lead;
  audience?: CardAudience;
  onAction?: (action: string, lead: Lead) => void;
  onClose?: () => void;
}

function resolveStatus(lead: Lead): CardStatus {
  const s = (lead.listing_status || '').trim();
  if (s === 'Active' || s === 'active') return 'Active';
  if (s === 'Pending' || s === 'pending') return 'Pending';
  if (s === 'Sold' || s === 'sold' || s === 'Closed' || s === 'closed') return 'Sold';
  return 'Off Market';
}

function statusPillColors(status: CardStatus): { bg: string; ink: string } {
  switch (status) {
    case 'Active':     return { bg: 'var(--plot-status-active)',  ink: '#0F2417' };
    case 'Pending':    return { bg: 'var(--plot-status-pending)', ink: '#2E1C05' };
    case 'Sold':       return { bg: 'var(--plot-status-sold)',    ink: '#2D0808' };
    case 'Off Market': return { bg: 'var(--plot-status-off)',     ink: '#1F2832' };
  }
}

function buildAddress(lead: Lead): string {
  const parts = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean);
  if (lead.city && lead.state) {
    return `${lead.property_address ?? ''}, ${lead.city}, ${lead.state} ${lead.zip ?? ''}`.trim();
  }
  return parts.join(', ');
}

function fmtSqft(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

function fmtLot(acres: number | null | undefined): string {
  if (acres == null) return '—';
  const sqft = Math.round(acres * 43560);
  return sqft.toLocaleString('en-US');
}

function fmtDateShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export default function PropertyCardBillboard({ lead: rawLead, audience = 'public', onAction, onClose }: Props) {
  const { settings } = useBuyerSettings();

  // ── Stub Lead resolver ──────────────────────────────────────────
  // Stub Leads with id prefixes parcel: / gpoi: / addr: need server
  // resolution before the card has real facts to render. Fall back
  // to the lat/lng parcel lookup when there's no prefix but coords
  // exist. Mock listings (id starts with "mock-") are already
  // populated and skip the fetch entirely.
  const [resolved, setResolved] = useState<ResolverState>({
    parcel: null,
    googlePoi: null,
    addressRecord: null,
  });

  useEffect(() => {
    let cancelled = false;
    const id = rawLead.id ?? '';

    // Mock + fully populated rows skip resolution.
    if (id.startsWith('mock-')) return;

    if (id.startsWith('addr:')) {
      fetch(`/api/addresses/${encodeURIComponent(id.slice(5))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setResolved((s) => ({ ...s, addressRecord: data }));
        })
        .catch(() => { /* silent */ });
      return () => { cancelled = true; };
    }

    if (id.startsWith('gpoi:')) {
      fetch(`/api/google-poi?placeId=${encodeURIComponent(id.slice(5))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setResolved((s) => ({ ...s, googlePoi: data }));
        })
        .catch(() => { /* silent */ });
      return () => { cancelled = true; };
    }

    const apn = id.startsWith('parcel:') ? id.slice(7) : null;
    const url = apn
      ? `/api/parcel?apn=${encodeURIComponent(apn)}`
      : (rawLead.latitude != null && rawLead.longitude != null
          ? `/api/parcel?lat=${rawLead.latitude}&lng=${rawLead.longitude}`
          : null);
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setResolved((s) => ({ ...s, parcel: data }));
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [rawLead.id, rawLead.latitude, rawLead.longitude]);

  // Merge resolved data into a hydrated lead view so the renderer below
  // can treat everything uniformly. Resolved fields fill in only when
  // the raw lead is missing them — explicit data on a mock listing wins.
  const lead: Lead = {
    ...rawLead,
    property_address:
      rawLead.property_address ??
      resolved.parcel?.address ??
      resolved.addressRecord?.fullAddress ??
      resolved.googlePoi?.address ??
      rawLead.property_address,
    bedrooms:
      rawLead.bedrooms ??
      (typeof resolved.parcel?.bedrooms === 'string' ? Number(resolved.parcel.bedrooms) : resolved.parcel?.bedrooms ?? null),
    bathrooms:
      rawLead.bathrooms ??
      (typeof resolved.parcel?.bathrooms === 'string' ? Number(resolved.parcel.bathrooms) : resolved.parcel?.bathrooms ?? null),
    sqft:
      rawLead.sqft ??
      (typeof resolved.parcel?.buildingSize === 'number' ? resolved.parcel.buildingSize : null),
    lot_acres:
      rawLead.lot_acres ??
      (typeof resolved.parcel?.acres === 'number' ? resolved.parcel.acres : null),
    year_built:
      rawLead.year_built ??
      (resolved.parcel?.yearBuilt != null
        ? (typeof resolved.parcel.yearBuilt === 'string' ? Number(resolved.parcel.yearBuilt) : resolved.parcel.yearBuilt)
        : null),
  };

  const status = resolveStatus(lead);
  const pill = statusPillColors(status);

  const isListed = status !== 'Off Market';
  const priceForMath =
    status === 'Sold'
      ? (lead.selling_price ?? lead.listing_price ?? null)
      : (lead.listing_price ?? null);

  const piti = isListed ? calculatePiti(priceForMath ?? 0, settings) : null;
  const monthlyStr = piti && piti.monthly > 0 ? `${formatMoney(piti.monthly)} / mo` : null;
  const priceStr = priceForMath ? formatMoney(priceForMath) : null;

  // Headline + supporting line are mode-aware.
  let headline: string;
  let supportingTop: string | null = null;
  if (!isListed) {
    headline = buildAddress(lead) || '—';
  } else if (settings.headlineMode === 'monthly' && monthlyStr) {
    headline = monthlyStr;
    supportingTop = formatPitiCaption(settings);
  } else if (priceStr) {
    headline = priceStr;
    supportingTop = monthlyStr ? `${monthlyStr} est.` : null;
  } else {
    headline = '—';
  }

  // Listed-at / sold-at supporting microcopy line shown below address on
  // listed variants. Off Market shows "Public record · Not currently listed".
  let footnote: string | null;
  if (!isListed) {
    footnote = 'Public record  ·  Not currently listed';
  } else if (status === 'Sold') {
    const dt = fmtDateShort(lead.selling_date);
    const sold = lead.selling_price ?? lead.listing_price;
    footnote = sold ? `Sold at ${formatMoney(sold)}${dt ? `  ·  ${dt}` : ''}` : null;
  } else if (status === 'Pending') {
    footnote = lead.listing_price ? `Listed at ${formatMoney(lead.listing_price)}  ·  In escrow` : null;
  } else {
    footnote = lead.listing_price ? `Listed at ${formatMoney(lead.listing_price)}` : null;
  }

  const photoUrl =
    (lead.listing_photo_urls && lead.listing_photo_urls[0]) ||
    lead.listing_photo_url ||
    null;

  const fire = (action: string) => () => onAction?.(action, lead);

  return (
    <div className="pcb-root" role="dialog" aria-label="Property card">
      {/* HERO */}
      <div className={`pcb-hero ${isListed && photoUrl ? 'has-photo' : 'is-watermark'}`}>
        {isListed && photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="pcb-hero-img" src={photoUrl} alt="" />
        ) : (
          <Watermark />
        )}
        <div className="pcb-pill" style={{ background: pill.bg, color: pill.ink }}>
          {status}
        </div>
        {onClose && (
          <button type="button" className="pcb-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      {/* BODY */}
      <div className="pcb-body">
        <div className="pcb-headline">{headline}</div>
        {supportingTop && <div className="pcb-caption">{supportingTop}</div>}
        {isListed && (
          <div className="pcb-address">{buildAddress(lead) || ''}</div>
        )}
        {footnote && <div className="pcb-footnote">{footnote}</div>}

        {/* FACTS GRID */}
        <div className="pcb-facts">
          <Fact label="BEDS"      value={lead.bedrooms != null ? String(lead.bedrooms) : '—'} />
          <Fact label="BATHS"     value={lead.bathrooms != null ? String(lead.bathrooms) : '—'} />
          <Fact label="BLDG SQFT" value={fmtSqft(lead.sqft)} />
          <Fact label="LOT SQFT"  value={fmtLot(lead.lot_acres)} />
          <Fact label="YEAR"      value={lead.year_built != null ? String(lead.year_built) : '—'} />
        </div>

        {/* PITI BREAKDOWN — listed variants only */}
        {isListed && piti && piti.monthly > 0 && (
          <>
            <div className="pcb-divider" />
            <div className="pcb-piti">
              <Fact label="PRINCIPAL + INT" value={formatMoney(piti.pi)} />
              <Fact label="TAXES"           value={formatMoney(piti.tax)} />
              <Fact label="INSURANCE"       value={formatMoney(piti.insurance)} />
            </div>
          </>
        )}

        {/* BUTTON ROW — varies by audience */}
        <div className="pcb-buttons">
          <ButtonRow audience={audience} status={status} onAction={fire} />
        </div>
      </div>

      <style jsx>{`
        .pcb-root {
          width: 480px;
          max-width: calc(100vw - 32px);
          background: var(--plot-card-surface);
          border-radius: 24px;
          overflow: hidden;
          box-shadow:
            0 20px 50px var(--plot-card-shadow),
            0 1px 0 var(--plot-card-shadow-inner) inset;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: var(--plot-card-ink);
        }
        .pcb-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 2;
          background: var(--plot-card-hero-empty);
          overflow: hidden;
        }
        .pcb-hero.has-photo {
          background: #ccc;
        }
        .pcb-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pcb-pill {
          position: absolute;
          top: 14px;
          left: 14px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          line-height: 1;
        }
        .pcb-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: rgba(255,255,255,0.85);
          border: 0;
          color: var(--plot-card-ink);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(20,22,28,0.18);
        }

        .pcb-body {
          padding: 18px 22px 18px;
        }
        .pcb-headline {
          font-size: 32px;
          font-weight: 700;
          line-height: 1.1;
          color: var(--plot-card-ink);
          letter-spacing: -0.5px;
        }
        .pcb-caption {
          margin-top: 8px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.9px;
          color: var(--plot-card-ink-faint);
        }
        .pcb-address {
          margin-top: 12px;
          font-size: 14px;
          font-weight: 500;
          color: var(--plot-card-ink-mid);
        }
        .pcb-footnote {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
          color: var(--plot-card-ink-faint);
        }

        .pcb-facts {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-top: 18px;
        }
        .pcb-divider {
          margin-top: 14px;
          height: 1px;
          background: var(--plot-card-divider);
        }
        .pcb-piti {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 14px;
        }

        .pcb-buttons {
          margin-top: 18px;
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <div className="fact-label">{label}</div>
      <div className="fact-value">{value}</div>
      <style jsx>{`
        .fact {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fact-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.7px;
          color: var(--plot-card-ink-faint);
        }
        .fact-value {
          font-size: 15px;
          font-weight: 600;
          color: var(--plot-card-ink);
        }
      `}</style>
    </div>
  );
}

function Watermark() {
  // Theodolite reticle + PLOT wordmark — quiet, parchment-ink, hand-spec.
  // Mirrors the watermark we built in the Figma Off Market variant.
  return (
    <div className="wm">
      <svg viewBox="0 0 144 144" width="100" height="100" aria-hidden="true">
        <circle cx="72" cy="72" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* crosshair: 4 short segments, gap at center, no dot */}
        <line x1="72" y1="32" x2="72" y2="60" stroke="currentColor" strokeWidth="1.5" />
        <line x1="72" y1="84" x2="72" y2="112" stroke="currentColor" strokeWidth="1.5" />
        <line x1="32" y1="72" x2="60" y2="72" stroke="currentColor" strokeWidth="1.5" />
        <line x1="84" y1="72" x2="112" y2="72" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="wm-text">PLOT</div>
      <style jsx>{`
        .wm {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--plot-card-watermark-ink);
          border-bottom: 1px solid var(--plot-card-divider);
        }
        .wm-text {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 4px;
          color: var(--plot-card-watermark-ink);
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Button rows — change with audience
// ────────────────────────────────────────────────────────────────────

interface ButtonRowProps {
  audience: CardAudience;
  status: CardStatus;
  onAction: (action: string) => () => void;
}

function ButtonRow({ audience, status, onAction }: ButtonRowProps) {
  // Off Market gets a special public CTA: "Get notified if listed" —
  // demand capture for the public, no operator tools surface here.
  if (status === 'Off Market') {
    return (
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={onAction('notify')}>
          Get notified if listed
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('share')}>
          Share
        </button>
        <style jsx>{ROW_CSS}</style>
      </div>
    );
  }

  if (audience === 'public') {
    return (
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={onAction('tour')}>
          Schedule Tour
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('save')}>
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('share')}>
          Share
        </button>
        <style jsx>{ROW_CSS}</style>
      </div>
    );
  }

  if (audience === 'agent') {
    return (
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={onAction('skiptrace')}>
          Skip Trace
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('postcard')}>
          Postcard
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('campaign')}>
          Add to Campaign
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAction('owner')}>
          Owner
        </button>
        <style jsx>{ROW_CSS}</style>
      </div>
    );
  }

  // Position — in-house operator toolkit (full agent buttons + assign/hot/log)
  return (
    <div className="btn-row position-row">
      <button type="button" className="btn btn-primary" onClick={onAction('skiptrace')}>
        Skip Trace
      </button>
      <button type="button" className="btn btn-ghost" onClick={onAction('postcard')}>
        Postcard
      </button>
      <button type="button" className="btn btn-ghost" onClick={onAction('owner')}>
        Owner
      </button>
      <button type="button" className="btn btn-ghost" onClick={onAction('assign')}>
        Assign
      </button>
      <button type="button" className="btn btn-ghost" onClick={onAction('hot')}>
        Mark Hot
      </button>
      <style jsx>{ROW_CSS}</style>
    </div>
  );
}

const ROW_CSS = `
  .btn-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    appearance: none;
    border: 0;
    cursor: pointer;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.1px;
    transition: background 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  }
  .btn-primary {
    background: var(--plot-blue);
    color: var(--plot-on-blue);
    box-shadow: 0 2px 6px rgba(43,107,255,0.30);
    flex-grow: 1;
  }
  .btn-primary:hover {
    background: var(--plot-blue-hover);
  }
  .btn-primary:active {
    background: var(--plot-blue-press);
    transform: translateY(1px);
  }
  .btn-ghost {
    background: #efeee9;
    color: var(--plot-card-ink);
  }
  .btn-ghost:hover {
    background: #e6e5df;
  }
  .position-row .btn {
    padding: 8px 12px;
    font-size: 12px;
  }
`;
