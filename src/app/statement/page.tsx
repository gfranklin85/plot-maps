'use client';

// /statement — the live pre-close Buyer's Statement (the offer builder room).
// Seeded from realistic CA purchase data (mirrors the Kind Lending / Chicago
// Title samples) so it's viewable now; the real inputs come from the buyer's
// offer + the crew's submitted numbers. Area comps show as pending until the
// PlotMaps Import is reverified. See memory/project_live_buyers_statement.

import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import LiveBuyersStatement from '@/components/offer/LiveBuyersStatement';
import { DEFAULT_INPUTS, type OfferInputs } from '@/lib/offer/types';

// A realistic seeded offer (Lemoore-ish, FHA-adjacent conventional) so the
// room is populated. Real deals feed these from the RPA + the crew.
const SEED: OfferInputs = {
  ...DEFAULT_INPUTS,
  purchasePrice: 429000,
  listPrice: 435000,
  livingAreaSqft: 1850,
  downPaymentPct: 20,
  loanType: 'conventional',
  termYears: 30,
  closeOfEscrowDays: 30,
  interestRate: { value: 6.25, source: 'live-provider' },
  annualInsurance: { value: 1295, source: 'live-provider' },
  annualTaxRatePct: { value: 1.1, source: 'pending-application' },
  earnestDeposit: 5400,
  sellerCredit: 0,
  loanState: 'quoted-live',
  insuranceState: 'quoted-live',
};

// Responsible parties, as they'd appear on the statement once verified.
const PROVIDERS = {
  lender: 'Kind Lending, LLC',
  title: 'Chicago Title Company',
  insurance: 'USAA',
};

export default function StatementPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/buyers" className="hover:text-[#1349d4] transition-colors">Browse buyers</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          <div className="text-center mb-8">
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
              Your offer · the real numbers
            </div>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-3 leading-tight">
              See what this house actually costs — before you offer.
            </h1>
            <p className="text-[15px] mt-4 text-[#4a5568] leading-relaxed max-w-xl mx-auto">
              The same statement you&apos;d get at the closing table, live. Your true
              monthly payment, your cash to close, every line named and sourced.
              Know before you sign — not after.
            </p>
          </div>

          <LiveBuyersStatement inputs={SEED} providers={PROVIDERS} areaComps={null} />
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
