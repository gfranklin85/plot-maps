"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lead } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";

// PropertyPopup — Plot's public-layer property card.
// Locked 2026-05-30 evening. Replaces the warm-gold hologram with a
// modern 2026 dark glass card (Stitch-direction).
//
// TWO MODES based on lead.listing_status:
//   LISTED   (Active/Pending/Sold) → buyer-facing card with photo
//                                    carousel, price, status pill,
//                                    listing-agent attribution, and
//                                    Call/Email/Message/Tour buttons
//                                    that ALL route to Position via
//                                    /api/inbox/message. Plot respects
//                                    the listing — listing agent contact
//                                    info is shown for attribution but
//                                    never as click-to-call.
//   UNLISTED (no listing_status)   → research-only card. Address,
//                                    beds/baths/sf/year/lot/APN, last
//                                    sale price+date from public
//                                    records, "Off market" tag.
//                                    NO action buttons. The public
//                                    layer never surfaces operator
//                                    tools (skip-trace, postcard, etc.).
//                                    Those live behind the agent layer
//                                    login (project_two_layer_audience_strategy).
//
// Data resolution: lead.id may be a stub
//   parcel:<APN>    → /api/parcel?apn=…       (PostGIS parcel)
//   gpoi:<placeId>  → /api/google-poi?…       (Google Place Details)
//   addr:<id>       → /api/addresses/[id]     (Plot address layer)
//   mock-*          → already populated (mock listings JSON)
//   normal id       → /api/parcel?lat=&lng=   (proximity guess)

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
  onToggleProspectMode?: () => void;
  prospectMode?: boolean;
  onClose?: () => void;
  onPin?: () => void;
}

type InquiryAction = 'call' | 'email' | 'message' | 'tour';

export default function PropertyPopup({ lead, onClose, onPin }: Props) {
  // Resolver state (parcel takes precedence; popup pulls assessor
  // fields from there when listing fields are missing)
  const [parcel, setParcel] = useState<import('@/lib/property-data/types').ResolvedProperty | null>(null);
  const [googlePoi, setGooglePoi] = useState<{
    placeId: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [addressRecord, setAddressRecord] = useState<{
    id: number;
    fullAddress: string;
  } | null>(null);

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

  // ── Resolved data ──────────────────────────────────────────────
  const fullAddr =
    lead.property_address ||
    parcel?.address ||
    addressRecord?.fullAddress ||
    googlePoi?.address ||
    '';
  const poiName = googlePoi?.name ?? null;
  const headline = poiName || (fullAddr.split(',')[0]?.trim() || 'Unknown address');
  const tail = poiName ? fullAddr : fullAddr.split(',').slice(1).join(',').trim();

  const status = lead.listing_status as 'Active' | 'Pending' | 'Sold' | null | undefined;
  const isListed = !!status; // any status (Active, Pending, Sold) shows as a listing card

  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : null;
  const priceLabel =
    status === 'Sold' ? 'sold price' :
    status === 'Pending' ? 'pending price' :
    status === 'Active' ? 'list price' : null;

  const beds = lead.bedrooms ?? (typeof parcel?.bedrooms === 'number' ? parcel.bedrooms : null);
  const baths = lead.bathrooms ?? (typeof parcel?.bathrooms === 'number' ? parcel.bathrooms : null);
  const sqft = lead.sqft ?? (parcel?.buildingSize ?? null);
  const lotAcres = lead.lot_acres ?? (parcel?.acres ?? null);
  const built = lead.year_built ?? parcel?.yearBuilt ?? null;
  const apn = parcel?.apn ?? null;

  // NOTE on last-sale public-record data: the Kings County parcel
  // resolver (src/lib/property-data/types.ts ResolvedProperty) does
  // not yet expose lastSalePrice / lastSaleDate. When it does, the
  // unlisted card should surface them as a "Last sold" fact-row item.
  // See project-two-layer-audience-strategy + Greg 2026-05-30: this
  // is exactly the public-record context that helps buyers research
  // off-market homes without crossing into operator-tier territory.

  // ── Photos ─────────────────────────────────────────────────────
  const photos: string[] = (() => {
    if (Array.isArray(lead.listing_photo_urls) && lead.listing_photo_urls.length > 0) {
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
  useEffect(() => { setPhotoIdx(0); }, [lead.id]);
  const goPrev = () => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setPhotoIdx((i) => (i + 1) % photos.length);

  // ── Buyer inquiry state (listed mode only) ─────────────────────
  // All four buttons (Call/Email/Message/Tour) capture intent to
  // /api/inbox/message. Tour is the primary CTA; the others are
  // smaller secondary buttons.
  const [inquiryAction, setInquiryAction] = useState<InquiryAction | null>(null);
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [buyerMessage, setBuyerMessage] = useState('');

  const openInquiry = (a: InquiryAction) => {
    setInquiryAction(a);
    setInquiryStatus('idle');
    setInquiryError(null);
  };
  const closeInquiry = () => {
    setInquiryAction(null);
    setBuyerName('');
    setBuyerContact('');
    setBuyerMessage('');
  };

  const sendInquiry = async () => {
    if (!inquiryAction) return;
    setInquiryStatus('sending');
    setInquiryError(null);
    // Sort the buyer's contact into phone vs email by sniffing
    const c = buyerContact.trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
    try {
      const res = await fetch('/api/inbox/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: inquiryAction,
          listing_id: lead.id,
          listing_address: fullAddr || headline,
          listing_price: price || undefined,
          listing_status: status || undefined,
          listing_agent: lead.listing_agent_name || undefined,
          listing_brokerage: lead.listing_office_name || undefined,
          buyer_name: buyerName.trim() || undefined,
          buyer_phone: !looksLikeEmail ? c || undefined : undefined,
          buyer_email: looksLikeEmail ? c || undefined : undefined,
          buyer_message: buyerMessage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setInquiryStatus('failed');
        setInquiryError(d?.error || 'Could not send right now.');
        return;
      }
      setInquiryStatus('sent');
    } catch {
      setInquiryStatus('failed');
      setInquiryError('Network error.');
    }
  };

  const inquiryHeader = (() => {
    switch (inquiryAction) {
      case 'call': return 'Request a call';
      case 'email': return 'Send an email';
      case 'message': return 'Send a message';
      case 'tour': return 'Schedule a tour';
      default: return '';
    }
  })();

  // ── Render ─────────────────────────────────────────────────────
  // Single return — branches inside on isListed. The styled-jsx block
  // at the bottom scopes to .plot-popup and .plot-popup-compact so
  // both modes get the right rules from one source.
  return (
    <div className={isListed ? "plot-popup" : "plot-popup plot-popup-compact"}>

      {/* Top-right chrome — pin + close. Present in both modes. */}
      {(onPin || onClose) && (
        <div className={isListed ? "chrome" : "chrome chrome-compact"}>
          {onPin && (
            <button type="button" className="chrome-btn" onClick={onPin} title="Pin as reference">
              <MaterialIcon icon="push_pin" className={isListed ? "text-[16px]" : "text-[14px]"} />
            </button>
          )}
          {onClose && (
            <button type="button" className="chrome-btn" onClick={onClose} title="Close">
              <MaterialIcon icon="close" className={isListed ? "text-[16px]" : "text-[14px]"} />
            </button>
          )}
        </div>
      )}

      {/* UNLISTED — compact research card. No hero, no big banner.
          Just bare facts: address, beds, baths, sqft, lot, year. */}
      {!isListed && (
        <div className="content content-compact">
          <div className="off-tag">OFF MARKET</div>

          <div className="compact-addr">
            <div className="addr-head">{headline}</div>
            {tail && <div className="addr-tail">{tail}</div>}
          </div>

          {(beds != null || baths != null || sqft != null || lotAcres != null) && (
            <div className="stats stats-compact">
              {beds != null && <Stat label="Beds" value={String(beds)} />}
              {baths != null && <Stat label="Baths" value={String(baths)} />}
              {sqft != null && <Stat label="Sqft" value={sqft.toLocaleString()} />}
              {lotAcres != null && <Stat label="Acres" value={Number(lotAcres).toFixed(2)} />}
            </div>
          )}

          {built != null && (
            <div className="compact-built">
              <span className="fact-lab">Built</span> {built}
            </div>
          )}

          <Link href={`/listings/${lead.id}`} className="link link-compact">
            Open full record →
          </Link>
        </div>
      )}

      {/* LISTED — full buyer-facing card with photo carousel, price,
          attribution, action cluster. */}
      {isListed && hasPhotos && (
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
              <button type="button" className="car-btn car-prev" onClick={(e) => { e.stopPropagation(); goPrev(); }} aria-label="Previous photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button type="button" className="car-btn car-next" onClick={(e) => { e.stopPropagation(); goNext(); }} aria-label="Next photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <div className="car-count">{photoIdx + 1} / {photos.length}</div>
            </>
          )}
        </div>
      )}

      {/* LISTED content block */}
      {isListed && <div className="content">

        {/* Identity row: price + address */}
        <div className="identity">
          {isListed && priceStr && (
            <div className="price-block">
              <div className="price">{priceStr}</div>
              {priceLabel && <div className="price-meta">{priceLabel}</div>}
            </div>
          )}
          <div className="addr-block">
            <div className="addr-head">{headline}</div>
            {tail && <div className="addr-tail">{tail}</div>}
          </div>
        </div>

        {/* Stats box */}
        {(beds != null || baths != null || sqft != null || lotAcres != null) && (
          <div className="stats">
            {beds != null && <Stat label="Beds" value={String(beds)} />}
            {baths != null && <Stat label="Baths" value={String(baths)} />}
            {sqft != null && <Stat label="Sqft" value={sqft.toLocaleString()} />}
            {lotAcres != null && <Stat label="Acres" value={Number(lotAcres).toFixed(2)} />}
          </div>
        )}

        {/* Secondary facts row (built, APN, and \"Last sold\" once the
            parcel resolver exposes sale history — see note above). */}
        {(built != null || apn != null) && (
          <div className="facts">
            {built != null && <span className="fact"><span className="fact-lab">Built</span> {built}</span>}
            {apn != null && <span className="fact"><span className="fact-lab">APN</span> {apn}</span>}
          </div>
        )}

        {/* LISTED: attribution line + action cluster */}
        {isListed && (
          <>
            {(lead.listing_agent_name || lead.listing_office_name) && (
              <div className="attribution">
                Listed by{' '}
                {lead.listing_agent_name && <span className="attr-name">{lead.listing_agent_name}</span>}
                {lead.listing_agent_name && lead.listing_office_name && ' · '}
                {lead.listing_office_name && <span className="attr-broker">{lead.listing_office_name}</span>}
              </div>
            )}

            <div className="actions">
              <div className="secondary-row">
                <button type="button" className="sec-btn" onClick={() => openInquiry('call')}>
                  <MaterialIcon icon="call" className="text-[18px]" />
                  <span>Call</span>
                </button>
                <button type="button" className="sec-btn" onClick={() => openInquiry('email')}>
                  <MaterialIcon icon="mail" className="text-[18px]" />
                  <span>Email</span>
                </button>
                <button type="button" className="sec-btn" onClick={() => openInquiry('message')}>
                  <MaterialIcon icon="chat_bubble" className="text-[18px]" />
                  <span>Message</span>
                </button>
              </div>
              <button type="button" className="primary-btn" onClick={() => openInquiry('tour')}>
                Schedule a tour
                <MaterialIcon icon="arrow_forward" className="text-[18px]" />
              </button>
              <Link href={`/listings/${lead.id}`} className="link">
                Open full record →
              </Link>
            </div>
          </>
        )}
      </div>}

      {/* Demo badge for mock listings (committee honesty) */}
      {lead.id?.startsWith('mock-') && (
        <div className="demo-badge">DEMO DATA · SAMPLE LISTING</div>
      )}

      {/* Inquiry sheet — overlays the popup when an action is clicked */}
      {inquiryAction && (
        <div className="inquiry-sheet">
          <div className="inquiry-card">
            <div className="inq-head">
              <div className="inq-title">{inquiryHeader}</div>
              <button type="button" className="inq-close" onClick={closeInquiry}>
                <MaterialIcon icon="close" className="text-[16px]" />
              </button>
            </div>
            {inquiryStatus === 'sent' ? (
              <div className="inq-sent">
                <div className="inq-sent-title">Sent</div>
                <div className="inq-sent-body">
                  We&apos;ll be in touch about <span className="inq-sent-addr">{headline}</span>.
                </div>
                <button type="button" className="primary-btn" onClick={closeInquiry}>OK</button>
              </div>
            ) : (
              <>
                <div className="inq-fields">
                  <input
                    type="text"
                    className="inq-input"
                    placeholder="Your name (optional)"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    autoComplete="name"
                  />
                  <input
                    type="text"
                    className="inq-input"
                    placeholder={inquiryAction === 'call' ? 'Phone number' : 'Email or phone'}
                    value={buyerContact}
                    onChange={(e) => setBuyerContact(e.target.value)}
                    autoComplete="email"
                  />
                  {(inquiryAction === 'message' || inquiryAction === 'email' || inquiryAction === 'tour') && (
                    <textarea
                      className="inq-textarea"
                      rows={3}
                      placeholder={
                        inquiryAction === 'tour'
                          ? 'Best times for a tour?'
                          : inquiryAction === 'email'
                            ? 'What would you like to ask?'
                            : 'Your message'
                      }
                      value={buyerMessage}
                      onChange={(e) => setBuyerMessage(e.target.value)}
                    />
                  )}
                </div>
                {inquiryError && <div className="inq-error">{inquiryError}</div>}
                <button
                  type="button"
                  className="primary-btn"
                  disabled={inquiryStatus === 'sending' || !buyerContact.trim()}
                  onClick={sendInquiry}
                >
                  {inquiryStatus === 'sending' ? 'Sending…' : 'Send to Position Realty'}
                  <MaterialIcon icon="arrow_forward" className="text-[18px]" />
                </button>
                <div className="inq-note">
                  Routed to Position Realty · Greg Franklin, Broker · CA DRE #02090737
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .plot-popup{
          position:relative;
          width:380px;
          border-radius:14px;
          color:var(--plot-text);
          font-family:'Inter', system-ui, -apple-system, sans-serif;
          background:var(--plot-base-glass);
          backdrop-filter:blur(32px);
          -webkit-backdrop-filter:blur(32px);
          border:1px solid var(--plot-divider-strong);
          box-shadow:
            0 18px 48px -12px rgba(0,0,0,0.7),
            0 0 0 1px rgba(255,255,255,0.04) inset;
          overflow:hidden;
          isolation:isolate;
        }
        /* compact unlisted card — smaller width, no hero, tight padding */
        .plot-popup-compact{
          width:300px;
        }

        /* top-right chrome */
        .chrome{
          position:absolute;
          top:12px; right:12px;
          z-index:4;
          display:flex; gap:6px;
        }
        .chrome-btn{
          width:30px; height:30px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(13,14,16,0.6);
          border:0;
          border-radius:9999px;
          color:var(--plot-text);
          cursor:pointer;
          padding:0;
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          transition: background 120ms ease, color 120ms ease;
        }
        .chrome-btn:hover{
          background:rgba(13,14,16,0.85);
          color:var(--plot-edge);
        }

        /* hero photo */
        .hero{
          position:relative;
          width:100%;
          height:200px;
          background:var(--plot-base-deep);
          overflow:hidden;
        }
        .hero img{
          width:100%; height:100%; display:block; object-fit:cover;
        }
        .hero-empty{
          display:flex;
          align-items:center;
          justify-content:center;
          background:linear-gradient(135deg, var(--plot-base-deep), var(--plot-base-soft));
          height:84px;
        }
        .hero-empty-tag{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:10px;
          font-weight:700;
          letter-spacing:0.24em;
          text-transform:uppercase;
          color:var(--plot-status-off);
        }

        /* status pill on hero */
        .pill{
          position:absolute;
          top:14px; left:14px;
          z-index:2;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:10px;
          font-weight:700;
          letter-spacing:0.16em;
          padding:5px 9px;
          border-radius:4px;
          color:#0D0E10;
        }
        .pill-active{ background:var(--plot-status-active); }
        .pill-pending{ background:var(--plot-status-pending); }
        .pill-sold{ background:var(--plot-status-sold); color:#FFF; }

        /* carousel controls */
        .car-btn{
          position:absolute;
          top:50%;
          transform:translateY(-50%);
          width:32px; height:32px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(13,14,16,0.6);
          border:0;
          border-radius:9999px;
          color:#FFF;
          cursor:pointer;
          padding:0;
          z-index:3;
          backdrop-filter:blur(6px);
          -webkit-backdrop-filter:blur(6px);
          opacity:0.85;
          transition:opacity 120ms ease, background 120ms ease;
        }
        .car-btn:hover{ opacity:1; background:rgba(13,14,16,0.85); }
        .car-prev{ left:10px; }
        .car-next{ right:10px; }
        .car-count{
          position:absolute;
          bottom:12px; right:14px;
          z-index:3;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:10px;
          letter-spacing:0.10em;
          color:#FFF;
          padding:3px 8px;
          background:rgba(13,14,16,0.6);
          border-radius:9999px;
          backdrop-filter:blur(6px);
          -webkit-backdrop-filter:blur(6px);
        }

        /* CONTENT */
        .content{ padding:18px 18px 16px; }
        /* compact content — tight padding, vertical-stack layout */
        .content-compact{
          padding:14px 14px 12px;
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .chrome-compact{
          top:8px; right:8px;
        }
        .chrome-compact .chrome-btn{
          width:24px; height:24px;
        }
        .off-tag{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:700;
          letter-spacing:0.22em;
          color:var(--plot-status-off);
          align-self:flex-start;
        }
        .compact-addr .addr-head{
          font-size:14px;
          font-weight:600;
          line-height:1.25;
          color:var(--plot-text);
        }
        .compact-addr .addr-tail{
          font-size:11.5px;
          color:var(--plot-text-muted);
          margin-top:1px;
        }
        .stats-compact{
          padding:8px 0;
          margin-bottom:0;
        }
        .compact-built{
          font-size:11.5px;
          color:var(--plot-text-muted);
          font-variant-numeric:tabular-nums;
        }
        .compact-built .fact-lab{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:700;
          letter-spacing:0.14em;
          text-transform:uppercase;
          color:var(--plot-text-faint);
          margin-right:4px;
        }
        .link-compact{
          align-self:flex-start;
          padding:2px 0;
        }

        /* identity */
        .identity{
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:14px;
          margin-bottom:14px;
        }
        .price-block{ flex:0 0 auto; }
        .price{
          font-size:24px;
          font-weight:700;
          line-height:1;
          letter-spacing:-0.02em;
          font-variant-numeric:tabular-nums;
          color:var(--plot-edge);
        }
        .price-meta{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:700;
          letter-spacing:0.18em;
          text-transform:uppercase;
          color:var(--plot-text-muted);
          margin-top:4px;
        }
        .addr-block{ min-width:0; flex:1; text-align:right; }
        .addr-head{
          font-size:15px;
          font-weight:600;
          line-height:1.25;
          letter-spacing:-0.005em;
          color:var(--plot-text);
        }
        .addr-tail{
          font-size:12px;
          font-weight:400;
          margin-top:2px;
          color:var(--plot-text-muted);
        }

        /* stats box */
        .stats{
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:0;
          margin-bottom:14px;
          padding:10px 0;
          background:rgba(13,14,16,0.35);
          border:1px solid var(--plot-divider);
          border-radius:10px;
        }

        /* secondary facts */
        .facts{
          display:flex;
          flex-wrap:wrap;
          gap:6px 12px;
          margin-bottom:14px;
          font-size:11px;
          color:var(--plot-text-muted);
        }
        .fact{
          font-variant-numeric:tabular-nums;
        }
        .fact-lab{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9.5px;
          font-weight:700;
          letter-spacing:0.14em;
          text-transform:uppercase;
          color:var(--plot-text-faint);
          margin-right:4px;
        }

        /* attribution */
        .attribution{
          font-size:11.5px;
          color:var(--plot-text-muted);
          padding-top:10px;
          border-top:1px solid var(--plot-divider);
          margin-bottom:12px;
        }
        .attr-name{ color:var(--plot-text); font-weight:500; }
        .attr-broker{ color:var(--plot-text); font-weight:500; }

        /* actions */
        .actions{
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .secondary-row{
          display:grid;
          grid-template-columns:repeat(3, 1fr);
          gap:6px;
        }
        .sec-btn{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          padding:9px 4px;
          background:var(--plot-base-soft);
          color:var(--plot-text);
          border:1px solid var(--plot-divider);
          border-radius:8px;
          font-size:12px;
          font-weight:500;
          letter-spacing:0.01em;
          cursor:pointer;
          transition:background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .sec-btn:hover{
          background:rgba(0,242,255,0.08);
          border-color:var(--plot-edge);
          color:var(--plot-edge);
        }
        .primary-btn{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:11px 12px;
          background:var(--plot-action);
          color:var(--plot-on-action);
          border:0;
          border-radius:8px;
          font-size:13px;
          font-weight:700;
          letter-spacing:0.02em;
          cursor:pointer;
          box-shadow:0 4px 14px -4px color-mix(in srgb, var(--plot-action) 60%, transparent);
          transition:filter 120ms ease, transform 120ms ease;
        }
        .primary-btn:hover:not(:disabled){ filter:brightness(1.08); }
        .primary-btn:active:not(:disabled){ transform:scale(0.98); }
        .primary-btn:disabled{ opacity:0.5; cursor:not-allowed; }
        .link{
          display:inline-block;
          text-align:center;
          font-size:11.5px;
          color:var(--plot-text-muted);
          text-decoration:none;
          padding:4px;
          transition:color 120ms ease;
        }
        .link:hover{ color:var(--plot-edge); }

        .actions-unlisted{
          gap:6px;
          padding-top:6px;
          border-top:1px solid var(--plot-divider);
        }
        .research-tag{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:9px;
          font-weight:600;
          letter-spacing:0.18em;
          text-transform:uppercase;
          color:var(--plot-text-faint);
          text-align:center;
        }

        /* demo badge */
        .demo-badge{
          position:absolute;
          bottom:8px; left:14px;
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:8.5px;
          font-weight:700;
          letter-spacing:0.18em;
          color:var(--plot-edge);
          border:1px solid color-mix(in srgb, var(--plot-edge) 50%, transparent);
          background:rgba(0,242,255,0.08);
          border-radius:3px;
          padding:2px 6px;
          pointer-events:none;
        }

        /* inquiry sheet */
        .inquiry-sheet{
          position:absolute;
          inset:0;
          z-index:10;
          background:rgba(13,14,16,0.85);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          display:flex;
          align-items:flex-end;
          justify-content:stretch;
          animation:plot-inq-in 220ms ease-out;
        }
        @keyframes plot-inq-in{
          from{ opacity:0; }
          to  { opacity:1; }
        }
        .inquiry-card{
          flex:1;
          background:var(--plot-base-soft);
          border-top:1px solid var(--plot-divider-strong);
          padding:18px;
          display:flex; flex-direction:column; gap:12px;
        }
        .inq-head{
          display:flex; align-items:center; justify-content:space-between;
        }
        .inq-title{
          font-size:15px;
          font-weight:600;
          color:var(--plot-text);
        }
        .inq-close{
          background:transparent;
          border:0;
          color:var(--plot-text-muted);
          cursor:pointer;
          padding:4px;
          border-radius:6px;
          display:flex; align-items:center; justify-content:center;
        }
        .inq-close:hover{ color:var(--plot-text); }
        .inq-fields{ display:flex; flex-direction:column; gap:8px; }
        .inq-input, .inq-textarea{
          background:var(--plot-base-deep);
          color:var(--plot-text);
          border:1px solid var(--plot-divider);
          border-radius:8px;
          padding:9px 12px;
          font-size:13px;
          font-family:inherit;
          outline:none;
          transition:border-color 120ms ease;
        }
        .inq-input::placeholder, .inq-textarea::placeholder{ color:var(--plot-text-faint); }
        .inq-input:focus, .inq-textarea:focus{ border-color:var(--plot-edge); }
        .inq-textarea{ resize:vertical; min-height:56px; }
        .inq-error{
          font-size:11.5px;
          color:var(--plot-status-sold);
        }
        .inq-note{
          font-size:10.5px;
          color:var(--plot-text-faint);
          text-align:center;
          line-height:1.4;
        }
        .inq-sent{
          display:flex; flex-direction:column; gap:10px;
          padding:14px 0;
        }
        .inq-sent-title{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:11px;
          font-weight:700;
          letter-spacing:0.22em;
          text-transform:uppercase;
          color:var(--plot-edge);
        }
        .inq-sent-body{
          font-size:14px;
          color:var(--plot-text);
        }
        .inq-sent-addr{
          color:var(--plot-edge);
          font-weight:500;
        }
      `}</style>
    </div>
  );
}

// ── Stat cell ────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-cell">
      <div className="val">{value}</div>
      <div className="lab">{label}</div>
      <style jsx>{`
        .stat-cell{
          text-align:center;
          padding:0 4px;
          border-right:1px solid var(--plot-divider);
        }
        .stat-cell:last-child{ border-right:0; }
        .val{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:15px;
          font-weight:700;
          color:var(--plot-text);
          font-variant-numeric:tabular-nums;
          line-height:1.1;
        }
        .lab{
          font-family:'JetBrains Mono', ui-monospace, monospace;
          font-size:8.5px;
          font-weight:700;
          letter-spacing:0.16em;
          text-transform:uppercase;
          color:var(--plot-text-faint);
          margin-top:3px;
        }
      `}</style>
    </div>
  );
}
