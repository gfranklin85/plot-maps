'use client';

// /compare — the lender-comparison cockpit. Buyers see the offers that came
// to them and choose. PLOT NEVER RANKS — offers arrive on a neutral timeline;
// the BUYER sorts. Full honest breakdown per offer so junk fees are visible;
// we expose, we don't crown. Warm toward lenders — nobody's the enemy.
// See memory/project_position_job_posting_architecture ("we do not rank").

import { useState, useMemo } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { SAMPLE_OFFERS, SAMPLE_POSITION, type LenderOffer } from '@/lib/compare/sampleOffers';

type SortKey = 'timeline' | 'monthly' | 'total' | 'rate';

const money = (n: number) => `$${n.toLocaleString()}`;

export default function ComparePage() {
  // The buyer sorts for themselves. Default = timeline (arrival order) — the
  // neutral layout. Plot never pre-ranks.
  const [sort, setSort] = useState<SortKey>('timeline');
  const [chosen, setChosen] = useState<string | null>(null);

  const offers = useMemo(() => {
    const list = [...SAMPLE_OFFERS];
    switch (sort) {
      case 'monthly': return list.sort((a, b) => a.monthlyPI - b.monthlyPI);
      case 'total': return list.sort((a, b) => a.estCost5yr - b.estCost5yr);
      case 'rate': return list.sort((a, b) => a.ratePct - b.ratePct);
      case 'timeline':
      default: return list.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    }
  }, [sort]);

  const chosenOffer = SAMPLE_OFFERS.find((o) => o.id === chosen) || null;

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/bullpen" className="hover:text-[#1349d4] transition-colors">The Bullpen</Link>
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-10">
          {/* the buyer's posted position — the employer holding the room */}
          <div className="cmp-position">
            <div className="cmp-position__eyebrow">Your position</div>
            <h1 className="cmp-position__h">Here&apos;s what you shared — and who came to you.</h1>
            <div className="cmp-position__facts">
              <Fact k="Loan" v={SAMPLE_POSITION.loanType} />
              <Fact k="Price range" v={SAMPLE_POSITION.priceRange} />
              <Fact k="Down payment" v={SAMPLE_POSITION.downPayment} />
              <Fact k="Timeline" v={SAMPLE_POSITION.timeline} />
            </div>
          </div>

          {/* the neutral framing — Plot doesn't pick */}
          <p className="cmp-framing">
            No lender is featured or favored. These came to you — sort them
            however you like, compare the real numbers side by side, and choose
            the one that&apos;s right for you.
          </p>

          {/* the buyer-controlled sort (buyer ranks; Plot never does) */}
          <div className="cmp-sort">
            <span className="cmp-sort__label">Sort by</span>
            {([
              ['timeline', 'As they arrived'],
              ['monthly', 'Monthly payment'],
              ['total', '5-year total'],
              ['rate', 'Rate'],
            ] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`cmp-sort__btn ${sort === k ? 'is-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* the offers — a neutral timeline, no winner slot */}
          <div className="cmp-list">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                chosen={chosen === o.id}
                onChoose={() => setChosen(o.id)}
              />
            ))}
          </div>

          {/* chosen confirmation */}
          {chosenOffer && (
            <div className="cmp-chosen">
              <MaterialIcon icon="check_circle" className="text-[22px]" />
              <div>
                <b>You chose {chosenOffer.lenderName}.</b> They&apos;ll reach out to
                finish getting you qualified. Your profile will show you&apos;re
                qualified — never by whom, unless you choose to share it.
              </div>
            </div>
          )}
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="cmp-position__fact">
      <div className="cmp-position__factk">{k}</div>
      <div className="cmp-position__factv">{v}</div>
    </div>
  );
}

function OfferCard({ offer, chosen, onChoose }: { offer: LenderOffer; chosen: boolean; onChoose: () => void }) {
  const o = offer;
  return (
    <div className={`cmp-card ${chosen ? 'is-chosen' : ''}`}>
      {/* header: lender + their pitch */}
      <div className="cmp-card__head">
        <div>
          <div className="cmp-card__lender">{o.lenderName}</div>
          <div className="cmp-card__loan">{o.loanType}</div>
        </div>
        <div className="cmp-card__rate">
          <div className="cmp-card__rate-n">{o.ratePct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%</div>
          <div className="cmp-card__rate-l">rate · {o.aprPct}% APR</div>
        </div>
      </div>

      {o.note && <p className="cmp-card__note">“{o.note}”</p>}

      {/* the full honest breakdown — junk fees visible; buyer draws the conclusion */}
      <div className="cmp-card__grid">
        <Line k="Monthly (P&amp;I)" v={money(o.monthlyPI)} />
        <Line k="Points" v={o.points ? `${o.points} (${money(Math.round(o.points * 3800))})` : 'None'} />
        <Line k="Lender fees" v={money(o.lenderFees)} />
        <Line k="Lender credit" v={o.credit ? `− ${money(o.credit)}` : 'None'} good={!!o.credit} />
        <Line k="Est. 5-year cost" v={money(o.estCost5yr)} strong />
      </div>

      <button className="cmp-card__choose" onClick={onChoose} disabled={chosen}>
        {chosen ? '✓ Chosen' : 'Choose this lender'}
      </button>
    </div>
  );
}

function Line({ k, v, strong, good }: { k: string; v: string; strong?: boolean; good?: boolean }) {
  return (
    <div className={`cmp-line ${strong ? 'is-strong' : ''}`}>
      <span dangerouslySetInnerHTML={{ __html: k }} />
      <b style={good ? { color: '#1b7a55' } : undefined}>{v}</b>
    </div>
  );
}
