// /bullpen — State your position. Repurposed from the old marketing landing
// into the REAL form: the buyer states their position, one question at a time.
// Stated-only (no verification, no sensitive data). Occupation is the hero
// signal; the agent-vouch + the first real offer are the trust.
// See memory/project_buyer_financial_capture + project_position_job_posting_architecture.

'use client';

import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import StatePosition from '@/components/bullpen/StatePosition';

export default function BullpenPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/buyers" className="hover:text-[#1349d4] transition-colors">Browse buyers</Link>
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          {/* warm header + the escalation promise */}
          <div className="text-center mb-8">
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
              State your position · free
            </div>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-3 leading-tight">
              Tell us the basics. Let the lenders come to you.
            </h1>
            <p className="text-[15px] mt-4 text-[#4a5568] leading-relaxed max-w-xl mx-auto">
              No forms to dread, no documents to dig up. Share a few plain facts —
              starting with what you do — and lenders reach out to earn your
              business. If one needs more, they&apos;ll ask you directly, and you
              decide what to share.
            </p>
            <Link href="/buyers" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold text-[#1349d4] hover:underline">
              See who&apos;s already looking →
            </Link>
          </div>

          <StatePosition />

          {/* stated-only, buyer-controlled — quietly */}
          <p className="mt-8 text-center text-xs text-[#8a93a4] max-w-md mx-auto flex items-center justify-center gap-1.5">
            <MaterialIcon icon="lock" className="text-[14px]" />
            No credit pull, no bank login, nothing to verify. You share only what
            you choose — and you get a link that&apos;s yours to send wherever you like.
          </p>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
