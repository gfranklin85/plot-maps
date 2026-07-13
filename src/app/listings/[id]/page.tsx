'use client';

// ── /listings/[id] — a single listing ─────────────────────────────────
//
// Public detail view: photos, price/facts, description, contact, and a link to
// see it on the map. ?new=1 shows a "posted!" banner. Greg 2026-07-13.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Listing {
  id: string; address: string; city: string | null; state: string | null; zip: string | null;
  lat: number | null; lng: number | null; apn: string | null;
  status: string; price: number | null; beds: number | null; baths: number | null;
  sqft: number | null; lot_sqft: number | null; year_built: number | null;
  property_type: string | null; description: string | null; photos: string[];
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  posted_by: string; created_at: string;
}

const money = (n: number | null) => (n == null ? null : `$${Math.round(n).toLocaleString()}`);

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const justPosted = sp.get('new') === '1';
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch(`/api/listings?id=${id}`)
      .then((r) => r.json())
      .then((j) => setListing(j.listing ?? null))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="ld">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>

      {loading ? (
        <div className="ld__center">Loading…</div>
      ) : !listing ? (
        <div className="ld__center">
          <MaterialIcon icon="search_off" className="text-[40px] opacity-40" />
          <p>Listing not found.</p>
          <Link href="/listings" className="ld__back">Back to listings</Link>
        </div>
      ) : (
        <div className="ld__wrap">
          {justPosted && (
            <div className="ld__posted"><MaterialIcon icon="check_circle" className="text-[18px]" /> Your listing is live. Share it or view it on the map.</div>
          )}

          {/* gallery */}
          <div className="ld__gallery">
            {listing.photos?.length ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ld__hero" src={listing.photos[active]} alt={listing.address} />
                {listing.photos.length > 1 && (
                  <div className="ld__thumbs">
                    {listing.photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p} alt="" className={i === active ? 'is-on' : ''} onClick={() => setActive(i)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="ld__nophoto"><MaterialIcon icon="photo" className="text-[48px] opacity-30" /></div>
            )}
          </div>

          <div className="ld__body">
            <div className="ld__main">
              <div className="ld__price">{money(listing.price) ?? 'Contact for price'}
                {listing.status !== 'active' && <span className="ld__status">{listing.status}</span>}
              </div>
              <div className="ld__facts">
                {listing.beds != null && <span><b>{listing.beds}</b> beds</span>}
                {listing.baths != null && <span><b>{listing.baths}</b> baths</span>}
                {listing.sqft != null && <span><b>{listing.sqft.toLocaleString()}</b> sqft</span>}
                {listing.lot_sqft != null && <span><b>{listing.lot_sqft.toLocaleString()}</b> lot sqft</span>}
                {listing.year_built != null && <span>built <b>{listing.year_built}</b></span>}
              </div>
              <h1 className="ld__addr">{listing.address}</h1>
              {(listing.city || listing.state) && <div className="ld__city">{[listing.city, listing.state, listing.zip].filter(Boolean).join(', ')}</div>}

              {listing.lat != null && listing.lng != null && (
                <Link href={`/map?view=3d&lat=${listing.lat}&lng=${listing.lng}`} className="ld__map">
                  <MaterialIcon icon="map" className="text-[18px]" /> See it on the map
                </Link>
              )}

              {listing.description && <p className="ld__desc">{listing.description}</p>}
            </div>

            {/* contact card */}
            <aside className="ld__contact">
              <div className="ld__contact-h">Contact {listing.posted_by === 'agent' ? 'the agent' : 'the owner'}</div>
              {listing.contact_name && <div className="ld__contact-name">{listing.contact_name}</div>}
              {listing.contact_phone && <a className="ld__contact-btn" href={`tel:${listing.contact_phone}`}><MaterialIcon icon="call" className="text-[18px]" /> {listing.contact_phone}</a>}
              {listing.contact_email && <a className="ld__contact-btn ld__contact-btn--alt" href={`mailto:${listing.contact_email}`}><MaterialIcon icon="mail" className="text-[18px]" /> Email</a>}
              {!listing.contact_phone && !listing.contact_email && <p className="ld__contact-none">No contact provided.</p>}
            </aside>
          </div>
        </div>
      )}

      <style>{`
        .ld { min-height: 100svh; background: linear-gradient(180deg, #f2f7fe 0%, #f8fbff 100%); }
        .ld__center { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 100px 20px; color: #6b7699; }
        .ld__back { color: #1349d4; font-weight: 700; }
        .ld__wrap { max-width: 1080px; margin: 0 auto; padding: 18px 20px 80px; }
        .ld__posted { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 12px 16px;
          border-radius: 12px; background: rgba(26,143,76,0.1); color: #1a8f4c; font-weight: 700; font-size: 14px; }
        .ld__gallery { border-radius: 18px; overflow: hidden; background: #e6eefb; }
        .ld__hero { width: 100%; max-height: 520px; object-fit: cover; display: block; }
        .ld__nophoto { aspect-ratio: 16/9; display: grid; place-items: center; }
        .ld__thumbs { display: flex; gap: 8px; padding: 8px; overflow-x: auto; background: #fff; }
        .ld__thumbs img { width: 84px; height: 62px; object-fit: cover; border-radius: 8px; cursor: pointer;
          opacity: 0.6; transition: opacity .12s; flex: none; }
        .ld__thumbs img.is-on { opacity: 1; outline: 2px solid #1349d4; }
        .ld__body { display: grid; grid-template-columns: 1fr; gap: 24px; margin-top: 22px; }
        @media (min-width: 860px) { .ld__body { grid-template-columns: 1fr 300px; } }
        .ld__price { font-size: 2.1rem; font-weight: 800; color: #122d8d; display: flex; align-items: center; gap: 12px; }
        .ld__status { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: rgba(10,20,40,0.7);
          color: #fff; font-weight: 700; text-transform: capitalize; }
        .ld__facts { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; color: #5a6a8c; font-size: 15px; }
        .ld__facts b { color: #1a2333; }
        .ld__addr { margin-top: 16px; font-size: 1.4rem; font-weight: 700; color: #1a2333; }
        .ld__city { color: #6b7699; margin-top: 2px; }
        .ld__map { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; padding: 10px 16px;
          border-radius: 11px; background: #fff; border: 1.5px solid rgba(19,73,212,0.2); color: #1349d4;
          font-weight: 700; font-size: 14px; }
        .ld__desc { margin-top: 22px; line-height: 1.6; color: #35405c; font-size: 15.5px; white-space: pre-wrap; }
        .ld__contact { align-self: start; background: #fff; border: 1px solid rgba(19,73,212,0.1); border-radius: 16px;
          padding: 20px; box-shadow: 0 8px 26px -16px rgba(20,50,120,0.4); }
        .ld__contact-h { font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7699; }
        .ld__contact-name { margin-top: 6px; font-weight: 700; color: #1a2333; font-size: 16px; }
        .ld__contact-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px;
          padding: 13px; border-radius: 12px; background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 15px; }
        .ld__contact-btn--alt { background: #eef3fd; color: #1349d4; }
        .ld__contact-none { margin-top: 8px; color: #9aa4bc; font-size: 13px; }
      `}</style>
    </div>
  );
}
