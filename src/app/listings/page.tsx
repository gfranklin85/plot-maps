'use client';

// ── /listings — BUYER-FIRST browse ────────────────────────────────────
//
// "Don't just show buyers the price. Show them what the price means."
// (Greg 2026-07-13). Three columns: Buyer Settings (left) → payment-first
// cards (center) → Market Snapshot + Offer Context + Payment Fit (right).
// Every listing leads with the estimated MONTHLY payment under the buyer's
// own settings, price second.
//
// Design pass (Greg: "too basic, make it original"): the page lives in the
// Floating-Plots sky — a layered atmospheric ground (light falling into the
// brand's pale sky blue, one whisper of the world's golden sun), plat-tile
// placeholders where photos are missing (surveyor lot lines + the reticle —
// literally PlotMaps), payment numerals in tabular figures, layered card
// shadows with hover lift, small-caps eyebrows. Flat brand blue throughout —
// no button gradients (memory/feedback_brand_fidelity).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMarkLive from '@/components/ui/PlotMarkLive';
import BuyerSettingsPanel from '@/components/listings/BuyerSettingsPanel';
import MarketSidebar from '@/components/listings/MarketSidebar';
import PlatTile from '@/components/listings/PlatTile';
import ListingsMap from '@/components/listings/ListingsMap';
import { loadSettings, paymentFor, type BuyerSettings, DEFAULT_SETTINGS } from '@/lib/listings/buyerSettings';

interface Listing {
  id: string; address: string; city: string | null; state: string | null; zip?: string | null;
  price: number | null; beds: number | null; baths: number | null; sqft: number | null;
  lot_sqft?: number | null; year_built?: number | null; dom?: number | null;
  property_type: string | null; photos: string[]; status: string;
  lat?: number | null; lng?: number | null;
}

type Sort = 'pay' | 'priceAsc' | 'priceDesc' | 'sqft';
type View = 'list' | 'map';

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('pay');
  const [settings, setSettings] = useState<BuyerSettings>(DEFAULT_SETTINGS);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [mobileSettings, setMobileSettings] = useState(false);
  const [view, setView] = useState<View>('list');

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

  // sorted view — "Payment (low → high)" is the buyer-first default
  const sorted = useMemo(() => {
    const pay = (l: Listing) => (l.price && l.price > 0 ? paymentFor(settings, l.price).total : Infinity);
    const arr = [...listings];
    switch (sort) {
      case 'pay': arr.sort((a, b) => pay(a) - pay(b)); break;
      case 'priceAsc': arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
      case 'priceDesc': arr.sort((a, b) => (b.price ?? -1) - (a.price ?? -1)); break;
      case 'sqft': arr.sort((a, b) => (b.sqft ?? -1) - (a.sqft ?? -1)); break;
    }
    return arr;
  }, [listings, sort, settings]);

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

  // one card row, shared by the list view and the map view's side column
  const renderRow = (l: Listing) => {
    const price = l.price ?? 0;
    const pay = price > 0 ? paymentFor(settings, price) : null;
    const overUnder = pay ? pay.total - settings.targetMonthly : 0;
    const ppsf = price > 0 && l.sqft ? Math.round(price / l.sqft) : null;
    const isComp = l.id.startsWith('comp:');
    return (
      <button key={l.id} className={`lrow ${selected?.id === l.id ? 'is-sel' : ''}`} onClick={() => setSelected(l)}>
        <div className="lrow__photo">
          {l.photos?.[0]
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={l.photos[0]} alt={l.address} />
            : <PlatTile seed={l.id} />}
        </div>
        <div className="lrow__body">
          <div className="lrow__paylabel">Estimated monthly payment</div>
          <div className="lrow__pay">
            {pay
              ? <><i>~</i>${Math.round(pay.total).toLocaleString()}<em>/mo</em></>
              : 'Contact for price'}
          </div>
          <div className="lrow__addr">{l.address}</div>
          <div className="lrow__facts">
            {price > 0 && <span className="lrow__price">${price.toLocaleString()}</span>}
            {price > 0 && <span className="lrow__est"> · estimated with your settings</span>}
          </div>
          <div className="lrow__specs">
            {l.beds != null && <span>{l.beds} bd</span>}
            {l.baths != null && <span>{l.baths} ba</span>}
            {l.sqft != null && <span>{l.sqft.toLocaleString()} sqft</span>}
            {ppsf != null && <span>${ppsf}/sqft</span>}
            {l.year_built != null && <span>built {l.year_built}</span>}
            {l.dom != null && l.dom > 0 && <span>{l.dom}d on market</span>}
          </div>
          {pay && (
            <div className="lrow__tags">
              {overUnder <= 0
                ? <span className="ltag ltag--ok"><MaterialIcon icon="check_circle" className="text-[13px]" /> {Math.abs(overUnder) < 1 ? 'Fits target' : `$${Math.abs(Math.round(overUnder)).toLocaleString()}/mo under target`}</span>
                : <span className="ltag ltag--over"><MaterialIcon icon="north_east" className="text-[13px]" /> ${Math.round(overUnder).toLocaleString()}/mo over target</span>}
              {settings.loanType === 'va' && <span className="ltag">VA-friendly</span>}
            </div>
          )}
        </div>
        <div className="lrow__cta">
          {isComp
            ? <span className="lrow__hint">Select to compare</span>
            : <Link href={`/listings/${l.id}`} className="lrow__view" onClick={(e) => e.stopPropagation()}>View details</Link>}
        </div>
      </button>
    );
  };

  // ═══ MAP VIEW — the inventory ON the map (Greg 2026-07-14 mockup):
  // our map + $X/mo pins beside the cards; click a home → mini card with
  // SEND POSTCARD. Settings edit via the drawer overlay. ═══
  if (view === 'map') {
    return (
      <div className="lb">
        <div className="fp" style={{ flex: 'none' }}>
          <AppHeader variant="public" />
        </div>

        <div className="lb__mapwrap">
          <div className="lb__maphead">
            <div className="lb__search lb__search--map">
              <MaterialIcon icon="search" className="text-[20px] lb__search-ic" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address, neighborhood, or keyword" />
            </div>
            <button className="lb__setstrip" onClick={() => setMobileSettings(true)}>
              <MaterialIcon icon="tune" className="text-[16px]" />
              <b>Buyer settings</b>
              <span>
                {settings.ratePct.toFixed(2)}% ·{' '}
                {settings.downType === 'percent' ? `${settings.downPercent}% down` : `$${settings.downDollar.toLocaleString()} down`} ·{' '}
                target ${settings.targetMonthly.toLocaleString()}/mo
              </span>
              <em>Edit</em>
            </button>
            <ViewToggle view={view} onView={setView} />
          </div>

          <div className="lmv">
            <div className="lmv__map">
              <ListingsMap
                listings={sorted}
                settings={settings}
                selected={selected}
                onSelect={(l) => setSelected(l as Listing | null)}
              />
            </div>
            <div className="lmv__side">
              <div className="lb__count-row" style={{ margin: '0 2px 10px' }}>
                <span className="lb__count">{loading ? 'Loading…' : `${sorted.length} home${sorted.length === 1 ? '' : 's'}`}</span>
                <label className="lb__sort">
                  Sort
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="pay">Payment (low → high)</option>
                    <option value="priceAsc">Price (low → high)</option>
                    <option value="priceDesc">Price (high → low)</option>
                    <option value="sqft">Square feet</option>
                  </select>
                </label>
              </div>
              <div className="lmv__cards">{sorted.map(renderRow)}</div>
            </div>
          </div>
        </div>

        {/* settings drawer — overlay at every width in map view */}
        <aside
          className={`lb__left lb__left--overlay ${mobileSettings ? 'is-open' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) setMobileSettings(false); }}
        >
          <div className="lb__left-inner">
            <div className="lb__drawer-bar" style={{ display: 'flex' }}>
              <span>Your buying settings</span>
              <button onClick={() => setMobileSettings(false)} aria-label="Close settings">
                <MaterialIcon icon="close" className="text-[20px]" />
              </button>
            </div>
            <BuyerSettingsPanel settings={settings} onChange={setSettings} />
          </div>
        </aside>

        <ListingsStyles />
      </div>
    );
  }

  return (
    <div className="lb">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>

      <div className="lb__cols">
        {/* LEFT — Buyer Settings (fixed drawer on narrow screens) */}
        <aside
          className={`lb__left ${mobileSettings ? 'is-open' : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget) setMobileSettings(false); }}
        >
          <div className="lb__left-inner">
            <div className="lb__drawer-bar">
              <span>Your buying settings</span>
              <button onClick={() => setMobileSettings(false)} aria-label="Close settings">
                <MaterialIcon icon="close" className="text-[20px]" />
              </button>
            </div>
            <BuyerSettingsPanel settings={settings} onChange={setSettings} />
          </div>
        </aside>

        {/* CENTER — listings */}
        <main className="lb__center">
          <div className="lb__head">
            <div>
              <span className="lb__eyebrow"><PlotMarkLive size={15} /> Free to post · Free to browse</span>
              <h1 className="lb__h font-headline">Listings</h1>
              <p className="lb__sub">See what each home means for your monthly payment.</p>
            </div>
            <Link href="/listings/new" className="lb__post"><MaterialIcon icon="add" className="text-[18px]" /> Post free</Link>
          </div>
          <p className="lb__hint"><MaterialIcon icon="tune" className="text-[15px]" /> Set your rate, down payment, and payment target on the left. We translate every listing into your estimated monthly payment.</p>

          <div className="lb__search">
            <MaterialIcon icon="search" className="text-[20px] lb__search-ic" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address, neighborhood, or keyword" />
            <button className="lb__settings-btn" onClick={() => setMobileSettings(true)} aria-label="Buyer settings"><MaterialIcon icon="tune" className="text-[20px]" /></button>
          </div>

          <div className="lb__count-row">
            <span className="lb__count">{loading ? 'Loading…' : `${sorted.length} home${sorted.length === 1 ? '' : 's'}`}</span>
            <div className="lb__count-tools">
              <ViewToggle view={view} onView={setView} />
              <label className="lb__sort">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="pay">Payment (low → high)</option>
                  <option value="priceAsc">Price (low → high)</option>
                  <option value="priceDesc">Price (high → low)</option>
                  <option value="sqft">Square feet</option>
                </select>
              </label>
            </div>
          </div>

          <div className="lb__list">
            {sorted.map(renderRow)}
            {!loading && sorted.length === 0 && (
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

// List | Map — the two ways of seeing the inventory
function ViewToggle({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <div className="lb__viewtog">
      <button className={view === 'list' ? 'is-on' : ''} onClick={() => onView('list')}>
        <MaterialIcon icon="view_agenda" className="text-[15px]" /> List
      </button>
      <button className={view === 'map' ? 'is-on' : ''} onClick={() => onView('map')}>
        <MaterialIcon icon="map" className="text-[15px]" /> Map
      </button>
    </div>
  );
}

function ListingsStyles() {
  return (
    <style>{`
      .lb { min-height: 100svh; position: relative; color: #0d1b3e; }
      /* the atmosphere — light falling into the brand's pale sky, two faint
         blue glows + one whisper of the Floating-Plots golden sun. Fixed so
         it holds while the list scrolls. */
      .lb::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
        background:
          radial-gradient(1100px 540px at 14% -10%, rgba(255,255,255,0.95), transparent 60%),
          radial-gradient(700px 420px at 78% -4%, rgba(245,196,110,0.05), transparent 60%),
          radial-gradient(950px 520px at 92% 4%, rgba(19,73,212,0.05), transparent 58%),
          radial-gradient(1300px 720px at 50% 122%, rgba(112,152,224,0.20), transparent 62%),
          linear-gradient(180deg, #fafcff 0%, #eef4fd 34%, #dfeafb 72%, #d3e2f7 100%); }

      .lb__cols { display: grid; grid-template-columns: 300px minmax(0,1fr) 320px; gap: 22px;
        max-width: 1440px; margin: 0 auto; padding: 22px 20px; align-items: start; }
      .lb__left, .lb__right { position: sticky; top: 20px; }
      .lb__drawer-bar { display: none; }

      /* head */
      .lb__eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800;
        letter-spacing: 0.18em; text-transform: uppercase; color: var(--plot-brand-deep, #122d8d); }
      .lb__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
      .lb__h { margin-top: 4px; font-size: 2.35rem; font-weight: 800; color: #0d1b3e; letter-spacing: -0.025em; line-height: 1; }
      .lb__sub { margin-top: 6px; color: #4d5d82; font-size: 1rem; }
      .lb__post { display: inline-flex; align-items: center; gap: 5px; padding: 11px 18px; border-radius: 12px;
        background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 13.5px; white-space: nowrap;
        box-shadow: 0 10px 24px -12px rgba(19,73,212,0.55); transition: background .15s, transform .15s; }
      .lb__post:hover { background: var(--plot-brand-deep, #122d8d); transform: translateY(-1px); }
      .lb__hint { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; padding: 11px 14px;
        border-radius: 12px; background: rgba(255,255,255,0.55); border: 1px solid rgba(19,73,212,0.10);
        color: #3a4a72; font-size: 13px; line-height: 1.45; }
      .lb__hint .material-symbols-rounded, .lb__hint .material-icons { color: var(--plot-brand, #1349d4); }

      /* search */
      .lb__search { display: flex; align-items: center; gap: 8px; margin-top: 14px; background: #fff;
        border: 1px solid rgba(19,73,212,0.12); border-radius: 14px; padding: 0 14px;
        box-shadow: 0 1px 2px rgba(13,27,62,0.04), 0 10px 28px -22px rgba(19,73,212,0.35);
        transition: border-color .15s, box-shadow .15s; }
      .lb__search:focus-within { border-color: rgba(19,73,212,0.45); box-shadow: 0 0 0 3px rgba(19,73,212,0.10); }
      .lb__search-ic { color: rgba(19,73,212,0.5); }
      .lb__search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 14px 0; font-size: 15px; color: #0f2b6b; }
      .lb__search input::placeholder { color: #8a96b5; }
      .lb__settings-btn { display: none; color: var(--plot-brand, #1349d4); }

      /* count + sort */
      .lb__count-row { display: flex; align-items: center; justify-content: space-between; margin: 16px 2px 12px; }
      .lb__count { font-size: 13px; font-weight: 700; color: #4d5d82; }
      .lb__sort { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #4d5d82; }
      .lb__sort select { border: 1px solid rgba(19,73,212,0.16); border-radius: 9px; padding: 6px 8px;
        font-size: 12.5px; font-weight: 700; color: var(--plot-brand, #1349d4); background: #fff; outline: none; }

      /* cards */
      .lb__list { display: flex; flex-direction: column; gap: 14px; padding-bottom: 70px; }
      .lrow { display: grid; grid-template-columns: 200px 1fr auto; gap: 18px; background: #fff; border-radius: 18px;
        border: 1px solid rgba(19,73,212,0.10); text-align: left; overflow: hidden; align-items: stretch;
        box-shadow: 0 1px 2px rgba(13,27,62,0.04), 0 14px 34px -24px rgba(19,73,212,0.35);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
      .lrow:hover { transform: translateY(-2px); border-color: rgba(19,73,212,0.22);
        box-shadow: 0 2px 4px rgba(13,27,62,0.05), 0 22px 44px -22px rgba(19,73,212,0.42); }
      .lrow.is-sel { border-color: rgba(19,73,212,0.55); box-shadow: 0 0 0 3px rgba(19,73,212,0.14), 0 18px 40px -22px rgba(19,73,212,0.45); }
      @media (prefers-reduced-motion: reduce) { .lrow, .lrow:hover, .lb__post:hover { transform: none; transition: none; } }
      .lrow__photo { position: relative; background: #e9f0fc; border-right: 1px solid rgba(19,73,212,0.06); }
      .lrow__photo img { width: 100%; height: 100%; object-fit: cover; }
      .lrow__body { padding: 16px 4px 16px 0; min-width: 0; }
      .lrow__paylabel { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #8a96b5; }
      .lrow__pay { margin-top: 2px; font-size: 1.95rem; font-weight: 800; color: var(--plot-brand, #1349d4);
        line-height: 1.05; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
      .lrow__pay i { font-style: normal; font-size: 1.25rem; font-weight: 700; color: rgba(19,73,212,0.55); margin-right: 1px; }
      .lrow__pay em { font-style: normal; font-size: 1rem; font-weight: 700; color: #4d5d82; margin-left: 2px; }
      .lrow__addr { margin-top: 8px; font-weight: 700; color: #1a2333; font-size: 15px; }
      .lrow__facts { margin-top: 2px; font-size: 13px; color: #6b7699; }
      .lrow__price { font-weight: 700; color: #35405c; font-variant-numeric: tabular-nums; }
      .lrow__specs { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 7px; color: #4d5d82; font-size: 13px;
        font-variant-numeric: tabular-nums; }
      .lrow__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
      .ltag { display: inline-flex; align-items: center; gap: 4px; padding: 3.5px 10px; border-radius: 999px;
        font-size: 11.5px; font-weight: 700; background: #eef3fd; color: var(--plot-brand, #1349d4); }
      .ltag--ok { background: rgba(21,122,67,0.10); color: #157a43; }
      .ltag--over { background: rgba(214,138,32,0.13); color: #a96410; }
      .lrow__cta { display: flex; align-items: center; padding: 16px 18px 16px 0; }
      .lrow__view { padding: 9px 15px; border-radius: 10px; border: 1.5px solid rgba(19,73,212,0.28);
        color: var(--plot-brand, #1349d4); font-weight: 700; font-size: 13.5px; white-space: nowrap;
        transition: background .15s, border-color .15s; }
      .lrow__view:hover { background: rgba(19,73,212,0.06); border-color: rgba(19,73,212,0.5); }
      .lrow__hint { font-size: 12px; font-weight: 700; color: #8a96b5; white-space: nowrap; }
      .lb__empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 70px 20px;
        color: #6b7699; text-align: center; }

      /* ── MAP VIEW ── */
      .lb__viewtog { display: inline-flex; border: 1px solid rgba(19,73,212,0.16); border-radius: 10px; overflow: hidden; background: #fff; }
      .lb__viewtog button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 13px;
        font-size: 12.5px; font-weight: 800; color: #6b7699; background: none; border: none; cursor: pointer; }
      .lb__viewtog button.is-on { background: var(--plot-brand, #1349d4); color: #fff; }
      .lb__count-tools { display: inline-flex; align-items: center; gap: 12px; }

      .lb__mapwrap { max-width: 1560px; margin: 0 auto; padding: 16px 20px 20px;
        height: calc(100svh - 70px); display: flex; flex-direction: column; }
      .lb__maphead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .lb__search--map { flex: 1; min-width: 260px; margin-top: 0; }
      .lb__setstrip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px;
        background: #fff; border: 1px solid rgba(19,73,212,0.14); cursor: pointer; font-size: 12.5px; color: #4d5d82;
        box-shadow: 0 1px 2px rgba(13,27,62,0.04); white-space: nowrap; }
      .lb__setstrip .material-symbols-rounded, .lb__setstrip .material-symbols-outlined { color: var(--plot-brand, #1349d4); }
      .lb__setstrip b { color: var(--plot-brand-deep, #122d8d); font-weight: 800; }
      .lb__setstrip em { font-style: normal; font-weight: 800; color: var(--plot-brand, #1349d4); }

      .lmv { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, 1fr);
        gap: 16px; margin-top: 14px; }
      .lmv__map { min-height: 0; }
      .lmv__map > * { height: 100%; }
      .lmv__side { min-height: 0; display: flex; flex-direction: column; }
      .lmv__cards { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
        padding-right: 4px; padding-bottom: 10px; }
      .lmv .lrow { grid-template-columns: 150px 1fr; }
      .lmv .lrow__cta { display: none; }

      /* the settings drawer as an overlay at every width (map view) */
      .lb__left--overlay { display: none; position: fixed; inset: 0; z-index: 90;
        background: rgba(13,27,62,0.42); overflow: auto; padding: 16px; }
      .lb__left--overlay.is-open { display: block; }
      .lb__left--overlay .lb__left-inner { max-width: 380px; margin: 8px auto 40px; }

      @media (max-width: 900px) {
        .lmv { grid-template-columns: 1fr; }
        .lmv__side { display: none; } /* mobile map view: map + mini card only */
        .lb__mapwrap { height: calc(100svh - 64px); padding: 10px 12px 12px; }
      }

      /* responsive: settings become a drawer, right rail drops */
      @media (max-width: 1200px) {
        .lb__cols { grid-template-columns: minmax(0,1fr) 300px; }
        .lb__settings-btn { display: grid; place-items: center; }
        .lb__left { display: none; position: fixed; inset: 0; z-index: 90; background: rgba(13,27,62,0.42); overflow: auto; padding: 16px; }
        .lb__left.is-open { display: block; }
        .lb__left-inner { max-width: 380px; margin: 8px auto 40px; }
        .lb__drawer-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
          color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .lb__drawer-bar button { color: #fff; display: grid; place-items: center; width: 34px; height: 34px;
          border-radius: 10px; background: rgba(255,255,255,0.14); }
      }
      @media (max-width: 900px) { .lb__cols { grid-template-columns: 1fr; } .lb__right { display: none; } }
      @media (max-width: 640px) {
        .lb__h { font-size: 1.9rem; }
        .lrow { grid-template-columns: 1fr; gap: 0; }
        .lrow__photo { min-height: 170px; border-right: none; border-bottom: 1px solid rgba(19,73,212,0.06); }
        .lrow__body { padding: 14px 16px 0; }
        .lrow__cta { padding: 12px 16px 16px; }
      }
    `}</style>
  );
}
