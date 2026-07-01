'use client';

// BuyerBoard — the public board of buyer positions (/buyers). The visibility
// platform: anyone browses, nobody is excluded (exclusion = favoring). Lender-
// facing hero ("the leads are free"), a filter bar, and a live list of buyer
// rows. A lender opens any row to make an NMLS-gated offer. REAL data only —
// no fake readiness. See memory/project_bullpen_board_design + project_bullpen_public_board.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import BuyerEmblem from './BuyerEmblem';
import type { BullpenBoardItem } from '@/lib/bullpen/types';

const LOAN_FILTERS: [string, string][] = [
  ['', 'All loans'], ['conventional', 'Conventional'], ['fha', 'FHA'], ['va', 'VA'], ['unsure', 'Open'],
];
const TIME_FILTERS: [string, string][] = [
  ['', 'Any time'], ['now', 'Ready now'], ['soon', 'Soon'], ['exploring', 'Exploring'],
];
const SORTS: [string, string][] = [['newest', 'Newest'], ['offers', 'Fewest offers'], ['most', 'Most offers']];

const NEED_LABEL: Record<string, string> = {
  lender: 'Lender', inspector: 'Inspector', insurance: 'Insurance',
  contractor: 'Contractor', escrow: 'Escrow', title: 'Title', agent: 'Agent',
};

function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const d = Math.max(0, Math.floor((now - then) / 86400000));
  if (d === 0) return 'Posted today';
  if (d === 1) return 'Posted yesterday';
  if (d < 7) return `Posted ${d} days ago`;
  const w = Math.floor(d / 7);
  return `Posted ${w} week${w > 1 ? 's' : ''} ago`;
}

export default function BuyerBoard() {
  const [items, setItems] = useState<BullpenBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [loan, setLoan] = useState('');
  const [time, setTime] = useState('');
  const [sort, setSort] = useState('newest');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (loan) params.set('loanType', loan);
    if (time) params.set('timeline', time);
    try {
      const res = await fetch(`/api/bullpen/board?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Reload on filter change (debounced for the text box).
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, loan, time]);

  const shown = useMemo(() => {
    const list = [...items];
    if (sort === 'most') list.sort((a, b) => b.offerCount - a.offerCount);
    else if (sort === 'offers') list.sort((a, b) => a.offerCount - b.offerCount);
    // 'newest' — API already returns created_at desc.
    return list;
  }, [items, sort]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/bullpen" className="hover:text-[#1349d4] transition-colors">State your position</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* the lender-facing hero — the leads are free */}
        <section className="bd-hero">
          <div className="bd-hero__eyebrow"><MaterialIcon icon="bolt" className="text-[13px]" /> No lead fees. Ever.</div>
          <h1 className="bd-hero__h">Everyone here is buying a home.<br /><span>The leads are free. Bring your best.</span></h1>
          <p className="bd-hero__sub">
            Real buyers, out in the open, asking for the right people. Answer for
            free — no gate, no favorites. Every licensed pro is welcome; buyers pick
            who they trust.
          </p>
          <div className="bd-hero__live">
            <span className="bd-hero__dot" />
            {loading ? 'Loading buyers…' : `${items.length} ${items.length === 1 ? 'buyer' : 'buyers'} on the board`}
          </div>
          <div className="bd-hero__cta">
            <Link href="/bullpen" className="bd-hero__btn">Buying a home? State your position →</Link>
          </div>
        </section>

        {/* filter bar */}
        <section className="mx-auto max-w-4xl px-6">
          <div className="bd-filters">
            <div className="bd-search">
              <MaterialIcon icon="search" className="text-[18px]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by area or occupation — “Lemoore”, “nurse”…"
              />
            </div>
            <Select value={loan} onChange={setLoan} opts={LOAN_FILTERS} />
            <Select value={time} onChange={setTime} opts={TIME_FILTERS} />
            <Select value={sort} onChange={setSort} opts={SORTS} />
          </div>
        </section>

        {/* the board */}
        <section className="mx-auto max-w-4xl px-6 pb-16 pt-2">
          {loading && <div className="bd-loading">Loading the board…</div>}

          {!loading && shown.length === 0 && (
            <div className="bd-empty">
              <MaterialIcon icon="groups" className="text-[34px]" />
              <b>No buyers match yet.</b>
              <p>Try widening your filters — or be the first to tell buyers you’re here.</p>
            </div>
          )}

          <div className="bd-list">
            {shown.map((it) => <BoardRow key={it.slug} it={it} />)}
          </div>

          {!loading && shown.length > 0 && (
            <p className="bd-more">More buyers joining every day.</p>
          )}
        </section>

        {/* the honest footer promise (matches the mockup) */}
        <section className="bd-promise">
          <MaterialIcon icon="verified_user" className="text-[18px]" />
          Verified pros only · license required · you answer for free · buyers pick who they trust.
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}

function BoardRow({ it }: { it: BullpenBoardItem }) {
  const isNew = (Date.now() - new Date(it.createdAt).getTime()) < 86400000;
  const headline = it.headline || `${it.occupation}${it.city ? ` · ${it.city}` : ''}`;

  return (
    <Link href={`/b/${it.slug}`} className="bd-row">
      <BuyerEmblem occupation={it.occupation} size={54} />

      <div className="bd-row__body">
        {isNew && <span className="bd-new">New today</span>}
        <div className="bd-row__headline">{headline}</div>

        <div className="bd-row__meta">
          {it.monthly && <span className="bd-row__money">{it.monthly}</span>}
          {it.priceRange && <span className="bd-row__price">{it.priceRange}</span>}
        </div>

        <div className="bd-row__where">
          <MaterialIcon icon="place" className="text-[14px]" />
          {it.city || 'Area not set'}
          <span className="bd-row__occ">· {it.occupation}</span>
        </div>

        {it.needs.length > 0 && (
          <div className="bd-needs">
            <span className="bd-needs__label">Needs</span>
            {it.needs.map((n) => (
              <span key={n} className="bd-chip">{NEED_LABEL[n] || n}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bd-row__side">
        {/* REAL signals only: the trust light + posted age */}
        {it.hasOffer ? (
          <div className="bd-ready bd-ready--go">
            <MaterialIcon icon="check_circle" className="text-[15px]" />
            {it.offerCount === 1 ? 'An offer is in' : `${it.offerCount} offers in`}
          </div>
        ) : (
          <div className="bd-ready bd-ready--open">
            <MaterialIcon icon="radio_button_unchecked" className="text-[15px]" />
            Open for offers
          </div>
        )}
        <div className="bd-posted">{ago(it.createdAt)}</div>
        <span className="bd-offer">Offer your estimate →</span>
        <span className="bd-private">Private to buyer</span>
      </div>
    </Link>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select className="bd-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}
