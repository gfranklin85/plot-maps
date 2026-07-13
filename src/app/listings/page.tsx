'use client';

// ── /listings — the public browse grid ────────────────────────────────
//
// Where buyers browse the free listings. Public (no auth to look). A "Post
// your listing — free" CTA leads to /listings/new. Greg 2026-07-13.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Listing {
  id: string; address: string; city: string | null; state: string | null;
  price: number | null; beds: number | null; baths: number | null; sqft: number | null;
  property_type: string | null; photos: string[]; status: string; created_at: string;
}

const money = (n: number | null) => (n == null ? null : `$${Math.round(n).toLocaleString()}`);

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/listings${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then((r) => r.json())
        .then((j) => setListings(j.listings ?? []))
        .catch(() => setListings([]))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="lstb">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>

      <div className="lstb__hero">
        <div className="lstb__hero-in">
          <div>
            <h1 className="lstb__h">Listings</h1>
            <p className="lstb__sub">Homes posted free by owners and agents.</p>
          </div>
          <Link href="/listings/new" className="lstb__post">
            <MaterialIcon icon="add" className="text-[20px]" /> Post your listing — free
          </Link>
        </div>
        <div className="lstb__search">
          <MaterialIcon icon="search" className="text-[20px] lstb__search-ic" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address or city" />
        </div>
      </div>

      <div className="lstb__grid-wrap">
        {loading ? (
          <div className="lstb__empty">Loading…</div>
        ) : listings.length === 0 ? (
          <div className="lstb__empty">
            <MaterialIcon icon="home" className="text-[40px] opacity-40" />
            <p>{q ? 'No listings match that search.' : 'No listings yet — be the first.'}</p>
            <Link href="/listings/new" className="lstb__post lstb__post--sm">Post your listing — free</Link>
          </div>
        ) : (
          <div className="lstb__grid">
            {listings.map((l) => (
              <Link key={l.id} href={`/listings/${l.id}`} className="lcard">
                <div className="lcard__photo">
                  {l.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt={l.address} />
                  ) : (
                    <div className="lcard__nophoto"><MaterialIcon icon="photo" className="text-[32px] opacity-30" /></div>
                  )}
                  {l.status !== 'active' && <span className="lcard__status">{l.status}</span>}
                </div>
                <div className="lcard__body">
                  <div className="lcard__price">{money(l.price) ?? 'Contact for price'}</div>
                  <div className="lcard__facts">
                    {l.beds != null && <span><b>{l.beds}</b> bd</span>}
                    {l.baths != null && <span><b>{l.baths}</b> ba</span>}
                    {l.sqft != null && <span><b>{l.sqft.toLocaleString()}</b> sqft</span>}
                  </div>
                  <div className="lcard__addr">{l.address}</div>
                  {(l.city || l.state) && <div className="lcard__city">{[l.city, l.state].filter(Boolean).join(', ')}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .lstb { min-height: 100svh; background: linear-gradient(180deg, #f2f7fe 0%, #f8fbff 100%); }
        .lstb__hero { max-width: 1180px; margin: 0 auto; padding: 24px 20px 8px; }
        .lstb__hero-in { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .lstb__h { font-size: 2.2rem; font-weight: 800; color: #122d8d; letter-spacing: -0.02em; }
        .lstb__sub { margin-top: 2px; color: #5a6a8c; font-size: 0.98rem; }
        .lstb__post { display: inline-flex; align-items: center; gap: 6px; padding: 12px 20px; border-radius: 12px;
          background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 14.5px;
          box-shadow: 0 12px 26px -12px rgba(19,73,212,0.6); white-space: nowrap; }
        .lstb__post:hover { background: var(--plot-brand-deep, #122d8d); }
        .lstb__post--sm { margin-top: 14px; }
        .lstb__search { max-width: 1180px; margin: 18px auto 0; display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1.5px solid rgba(19,73,212,0.14); border-radius: 14px; padding: 0 14px; }
        .lstb__search-ic { color: rgba(19,73,212,0.5); }
        .lstb__search input { flex: 1; border: none; outline: none; background: transparent; padding: 14px 0;
          font-size: 15px; color: #0f2b6b; }
        .lstb__grid-wrap { max-width: 1180px; margin: 0 auto; padding: 22px 20px 80px; }
        .lstb__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .lstb__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 20px;
          color: #6b7699; text-align: center; }
        .lcard { display: flex; flex-direction: column; background: #fff; border-radius: 16px; overflow: hidden;
          border: 1px solid rgba(19,73,212,0.08); box-shadow: 0 6px 20px -14px rgba(20,50,120,0.4);
          transition: transform .15s, box-shadow .15s; }
        .lcard:hover { transform: translateY(-3px); box-shadow: 0 16px 34px -16px rgba(20,50,120,0.5); }
        .lcard__photo { position: relative; aspect-ratio: 4/3; background: #e6eefb; }
        .lcard__photo img { width: 100%; height: 100%; object-fit: cover; }
        .lcard__nophoto { width: 100%; height: 100%; display: grid; place-items: center; }
        .lcard__status { position: absolute; top: 10px; left: 10px; padding: 4px 10px; border-radius: 999px;
          background: rgba(10,20,40,0.7); color: #fff; font-size: 11px; font-weight: 700; text-transform: capitalize; }
        .lcard__body { padding: 13px 15px 16px; }
        .lcard__price { font-size: 1.3rem; font-weight: 800; color: #122d8d; }
        .lcard__facts { display: flex; gap: 12px; margin-top: 4px; color: #5a6a8c; font-size: 13.5px; }
        .lcard__facts b { color: #1a2333; }
        .lcard__addr { margin-top: 8px; font-weight: 600; color: #1a2333; font-size: 14.5px; }
        .lcard__city { color: #6b7699; font-size: 13px; }
        @media (max-width: 720px) { .lstb__h { font-size: 1.8rem; } }
      `}</style>
    </div>
  );
}
