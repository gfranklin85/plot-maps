'use client';

// ── /listings — BUYER-FIRST browse ────────────────────────────────────
//
// "Don't just show buyers the price. Show them what the price means."
// (Greg 2026-07-13). Three columns: Buyer Settings (left) → payment-first
// cards (center) → Market Snapshot + Offer Context + Payment Fit (right).
// Every listing leads with the estimated MONTHLY payment under the buyer's
// own settings, price second.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';
import BuyerSettingsPanel from '@/components/listings/BuyerSettingsPanel';
import MarketSidebar from '@/components/listings/MarketSidebar';
import { loadSettings, paymentFor, type BuyerSettings, DEFAULT_SETTINGS } from '@/lib/listings/buyerSettings';
import { fmtMo } from '@/lib/finance/payment';

interface Listing {
  id: string; address: string; city: string | null; state: string | null;
  price: number | null; beds: number | null; baths: number | null; sqft: number | null;
  lot_sqft?: number | null; property_type: string | null; photos: string[]; status: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [settings, setSettings] = useState<BuyerSettings>(DEFAULT_SETTINGS);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [mobileSettings, setMobileSettings] = useState(false);

  useEffect(() => { setSettings(loadSettings()); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      // includeComps=1 → also surface active MLS comps so the board isn't empty
      fetch(`/api/listings?includeComps=1${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        .then((r) => r.json())
        .then((j) => setListings(j.listings ?? []))
        .catch(() => setListings([]))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  // the city the market sidebar keys on: the selected listing's, else the
  // most common city in the results, else Lemoore.
  const marketCity = useMemo(() => {
    if (selected?.city) return selected.city;
    const counts = new Map<string, number>();
    for (const l of listings) if (l.city) counts.set(l.city, (counts.get(l.city) ?? 0) + 1);
    let best: string | null = null, n = 0;
    counts.forEach((v, k) => { if (v > n) { n = v; best = k; } });
    return best ?? 'Lemoore';
  }, [selected, listings]);

  return (
    <div className="lb">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>

      <div className="lb__cols">
        {/* LEFT — Buyer Settings */}
        <aside className={`lb__left ${mobileSettings ? 'is-open' : ''}`}>
          <BuyerSettingsPanel settings={settings} onChange={setSettings} />
        </aside>

        {/* CENTER — listings */}
        <main className="lb__center">
          <div className="lb__head">
            <div>
              <h1 className="lb__h">Listings</h1>
              <p className="lb__sub">See what each home means for your monthly payment.</p>
            </div>
            <Link href="/listings/new" className="lb__post"><MaterialIcon icon="add" className="text-[18px]" /> Post free</Link>
          </div>
          <p className="lb__hint"><MaterialIcon icon="download" className="text-[15px]" /> Set your rate, down payment, and payment target on the left. We translate every listing into your estimated monthly payment.</p>

          <div className="lb__search">
            <MaterialIcon icon="search" className="text-[20px] lb__search-ic" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address, neighborhood, or keyword" />
            <button className="lb__settings-btn" onClick={() => setMobileSettings((v) => !v)} aria-label="Buyer settings"><MaterialIcon icon="tune" className="text-[20px]" /></button>
          </div>

          <div className="lb__count">{loading ? 'Loading…' : `${listings.length} home${listings.length === 1 ? '' : 's'}`}</div>

          <div className="lb__list">
            {listings.map((l) => {
              const price = l.price ?? 0;
              const pay = price > 0 ? paymentFor(settings, price) : null;
              const overUnder = pay ? pay.total - settings.targetMonthly : 0;
              return (
                <button key={l.id} className={`lrow ${selected?.id === l.id ? 'is-sel' : ''}`} onClick={() => setSelected(l)}>
                  <div className="lrow__photo">
                    {l.photos?.[0]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={l.photos[0]} alt={l.address} />
                      : <div className="lrow__nophoto"><MaterialIcon icon="home" className="text-[30px] opacity-30" /></div>}
                  </div>
                  <div className="lrow__body">
                    <div className="lrow__paylabel">Estimated monthly payment</div>
                    <div className="lrow__pay">{pay ? `~${fmtMo(pay.total)}` : 'Contact for price'}</div>
                    <div className="lrow__addr">{l.address}</div>
                    <div className="lrow__facts">
                      {price > 0 && <span className="lrow__price">${price.toLocaleString()}</span>}
                      {price > 0 && <span className="lrow__est">· estimated with your settings</span>}
                    </div>
                    <div className="lrow__specs">
                      {l.beds != null && <span>{l.beds} bd</span>}
                      {l.baths != null && <span>{l.baths} ba</span>}
                      {l.sqft != null && <span>{l.sqft.toLocaleString()} sqft</span>}
                    </div>
                    {pay && (
                      <div className="lrow__tags">
                        {overUnder <= 0
                          ? <span className="ltag ltag--ok"><MaterialIcon icon="check_circle" className="text-[13px]" /> {overUnder === 0 ? 'Fits target' : `$${Math.abs(Math.round(overUnder)).toLocaleString()}/mo under target`}</span>
                          : <span className="ltag ltag--over"><MaterialIcon icon="north_east" className="text-[13px]" /> ${Math.round(overUnder).toLocaleString()}/mo over target</span>}
                        {settings.loanType === 'va' && <span className="ltag">VA-friendly</span>}
                      </div>
                    )}
                  </div>
                  <div className="lrow__cta">
                    <Link href={`/listings/${l.id}`} className="lrow__view" onClick={(e) => e.stopPropagation()}>View details</Link>
                  </div>
                </button>
              );
            })}
            {!loading && listings.length === 0 && (
              <div className="lb__empty">
                <MaterialIcon icon="home" className="text-[40px] opacity-40" />
                <p>{q ? 'No listings match that search.' : 'No listings yet — be the first.'}</p>
                <Link href="/listings/new" className="lb__post">Post your listing — free</Link>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT — market snapshot + offer context + payment fit */}
        <aside className="lb__right">
          <MarketSidebar
            city={marketCity}
            settings={settings}
            selected={selected ? { price: selected.price ?? 0, sqft: selected.sqft ?? null } : null}
          />
        </aside>
      </div>

      <ListingsStyles />
    </div>
  );
}

function ListingsStyles() {
  return (
    <style>{`
      .lb { min-height: 100svh; background: linear-gradient(180deg, #eef4fd 0%, #f6f9ff 100%); }
      .lb__cols { display: grid; grid-template-columns: 300px minmax(0,1fr) 320px; gap: 20px;
        max-width: 1440px; margin: 0 auto; padding: 20px; align-items: start; }
      @media (max-width: 1200px) { .lb__cols { grid-template-columns: minmax(0,1fr) 300px; } .lb__left { display: none; } }
      @media (max-width: 900px) { .lb__cols { grid-template-columns: 1fr; } .lb__right { display: none; } }
      .lb__left, .lb__right { position: sticky; top: 20px; }
      .lb__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
      .lb__h { font-size: 2rem; font-weight: 800; color: #0d1b3e; letter-spacing: -0.02em; }
      .lb__sub { margin-top: 2px; color: #5a6a8c; font-size: 0.98rem; }
      .lb__post { display: inline-flex; align-items: center; gap: 5px; padding: 10px 16px; border-radius: 11px;
        background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 13.5px; white-space: nowrap; }
      .lb__hint { display: flex; align-items: flex-start; gap: 7px; margin-top: 12px; padding: 10px 14px;
        border-radius: 11px; background: rgba(19,73,212,0.06); color: #3a4a72; font-size: 13px; line-height: 1.4; }
      .lb__hint .material-symbols-rounded, .lb__hint .material-icons { color: #1349d4; }
      .lb__search { display: flex; align-items: center; gap: 8px; margin-top: 14px; background: #fff;
        border: 1.5px solid rgba(19,73,212,0.14); border-radius: 14px; padding: 0 12px; }
      .lb__search-ic { color: rgba(19,73,212,0.5); }
      .lb__search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 14px 0; font-size: 15px; color: #0f2b6b; }
      .lb__settings-btn { display: none; color: #1349d4; }
      @media (max-width: 1200px) { .lb__settings-btn { display: grid; place-items: center; } }
      .lb__count { margin: 14px 2px 10px; font-size: 13.5px; font-weight: 600; color: #5a6a8c; }
      .lb__list { display: flex; flex-direction: column; gap: 14px; padding-bottom: 60px; }
      .lrow { display: grid; grid-template-columns: 190px 1fr auto; gap: 16px; background: #fff; border-radius: 16px;
        border: 1px solid rgba(19,73,212,0.08); box-shadow: 0 6px 20px -14px rgba(20,50,120,0.4);
        text-align: left; overflow: hidden; transition: box-shadow .15s, border-color .15s; align-items: stretch; }
      .lrow:hover { box-shadow: 0 14px 30px -16px rgba(20,50,120,0.5); }
      .lrow.is-sel { border-color: rgba(19,73,212,0.6); box-shadow: 0 0 0 2px rgba(19,73,212,0.25); }
      .lrow__photo { background: #e6eefb; }
      .lrow__photo img { width: 100%; height: 100%; object-fit: cover; }
      .lrow__nophoto { width: 100%; height: 100%; min-height: 150px; display: grid; place-items: center; }
      .lrow__body { padding: 14px 4px; min-width: 0; }
      .lrow__paylabel { font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #8792ad; }
      .lrow__pay { font-size: 1.7rem; font-weight: 800; color: #1349d4; line-height: 1.05; }
      .lrow__addr { margin-top: 6px; font-weight: 700; color: #1a2333; font-size: 15px; }
      .lrow__facts { margin-top: 2px; font-size: 13px; color: #6b7699; }
      .lrow__price { font-weight: 700; color: #35405c; }
      .lrow__specs { display: flex; gap: 12px; margin-top: 6px; color: #5a6a8c; font-size: 13.5px; }
      .lrow__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .ltag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px;
        font-size: 11.5px; font-weight: 700; background: #eef3fd; color: #1349d4; }
      .ltag--ok { background: rgba(26,143,76,0.12); color: #1a8f4c; }
      .ltag--over { background: rgba(214,120,20,0.12); color: #c0721a; }
      .lrow__cta { display: flex; align-items: center; padding: 14px 16px 14px 0; }
      .lrow__view { padding: 9px 14px; border-radius: 10px; border: 1.5px solid rgba(19,73,212,0.25);
        color: #1349d4; font-weight: 700; font-size: 13.5px; white-space: nowrap; }
      .lb__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 70px 20px; color: #6b7699; text-align: center; }
      @media (max-width: 640px) { .lrow { grid-template-columns: 1fr; } .lrow__photo { min-height: 180px; } .lrow__cta { padding: 0 16px 16px; } }
    `}</style>
  );
}
