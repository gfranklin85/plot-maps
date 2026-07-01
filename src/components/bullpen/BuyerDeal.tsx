'use client';

// ── BuyerDeal (/deal/[slug]) — the buyer's home base ──────────────────
//
// The hub the buyer returns to. Leads with the "Make an Offer" FORK: Build
// Your Team (solicit real rates/quotes) or Continue with Team (I already have
// my people — go straight to building). From inside the offer builder they can
// still go get a rate. The offer builder is the OfferInstrument: slide the
// PRICE, the lender's RATE (the key) answers it live, at any hour.
// See memory/project_navigation_three_hubs + project_rate_not_scenario_keystone.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import OfferInstrument from '@/components/offer/OfferInstrument';
import type { BullpenPost, BullpenOffer } from '@/lib/bullpen/types';
import type { OfferInputs } from '@/lib/offer/types';

type Stage = 'fork' | 'build';

// The best real rate the crew has put in the buyer's hand becomes the KEY.
function keysFromOffers(offers: BullpenOffer[]): Partial<OfferInputs> {
  const withRate = offers.filter((o) => o.ratePct != null);
  if (!withRate.length) return {};
  // lowest rate offered = the strongest key in hand (buyer still chooses whom
  // to work with on /compare; this powers the instrument).
  const best = withRate.reduce((a, b) => ((b.ratePct ?? 99) < (a.ratePct ?? 99) ? b : a));
  return {
    interestRate: { value: best.ratePct as number, source: 'live-provider' },
  };
}

export default function BuyerDeal({ slug }: { slug: string }) {
  const [post, setPost] = useState<BullpenPost | null>(null);
  const [offers, setOffers] = useState<BullpenOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>('fork');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/bullpen/${slug}/offers`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setPost(data.post ?? null);
          setOffers(data.offers ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [slug]);

  const keys = keysFromOffers(offers);
  const hasTeam = offers.length > 0;
  const firstName = post?.buyerName?.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href={`/b/${slug}`} className="hover:text-[#1349d4] transition-colors">My position</Link>
          <Link href="/buyers" className="hover:text-[#1349d4] transition-colors">The board</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          <div className="hub">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
                {firstName ? `${firstName}'s deal` : 'Your deal'}
              </div>
            </div>

            {stage === 'fork' && (
              <div className="hub-fork">
                <div className="hub-fork__q">Ready to make an offer?</div>
                <p className="hub-fork__sub">
                  You need a real rate in your hand — then every price answers itself,
                  the moment you decide. Do you have your team, or should we get it?
                </p>
                <div className="hub-fork__cards">
                  <div
                    className={`hub-forkcard ${hasTeam ? '' : 'hub-forkcard--primary'}`}
                    onClick={() => (window.location.href = `/b/${slug}`)}
                    role="button"
                  >
                    <div className="hub-forkcard__icon"><MaterialIcon icon="groups" className="text-[20px]" /></div>
                    <div className="hub-forkcard__title">Build your team</div>
                    <div className="hub-forkcard__body">
                      Get real rates + quotes from licensed pros who compete for you.
                      {hasTeam ? ` ${offers.length} already in.` : ' The board is open.'}
                    </div>
                  </div>
                  <div
                    className={`hub-forkcard ${hasTeam ? 'hub-forkcard--primary' : ''}`}
                    onClick={() => setStage('build')}
                    role="button"
                  >
                    <div className="hub-forkcard__icon"><MaterialIcon icon="edit_document" className="text-[20px]" /></div>
                    <div className="hub-forkcard__title">Continue with your team</div>
                    <div className="hub-forkcard__body">
                      Already have a lender? Build your offer now — slide the price, see
                      your true cost at any hour.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stage === 'build' && (
              <>
                <button className="hub-back" onClick={() => setStage('fork')}>
                  <MaterialIcon icon="arrow_back" className="text-[16px]" /> Back
                </button>
                <div className="text-center mb-6">
                  <h1 className="font-headline text-2xl md:text-3xl font-extrabold leading-tight">
                    Build your offer.
                  </h1>
                  <p className="text-[14px] mt-3 text-[#4a5568] max-w-lg mx-auto leading-relaxed">
                    Slide the price to any offer you&apos;re weighing. Your true monthly
                    payment and cash to close answer instantly — no callback, no waiting.
                  </p>
                </div>
                {loading ? (
                  <div className="text-center text-[#8a93a4] py-10">Loading your numbers…</div>
                ) : (
                  <OfferInstrument
                    initial={keys}
                    providers={{ lender: 'Your lender', title: 'Escrow', insurance: 'Your insurer' }}
                    areaComps={null}
                    onBuildTeam={() => (window.location.href = `/b/${slug}`)}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
