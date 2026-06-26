// /bullpen — The Buyer Bullpen. The entry point to Vendor's Got Talent:
// buyers get ON and get SEEN; the vendors come to THEM. OPEN platform — any
// buyer, even ones with their own agent; no required business, no fee that
// kills the point. The elevation is the principle, not bait.
// See memory/project_vendors_got_talent.

import type { Metadata } from 'next';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';

export const metadata: Metadata = {
  title: 'The Buyer Bullpen — Plot Maps',
  description:
    'Stop chasing lenders and quotes. Step into the Buyer Bullpen, get seen, and let qualified lenders, inspectors, insurers and escrow come compete for you — on your terms. Open to every buyer, even if you already have an agent. No fee, no catch.',
};

const ROSTER = [
  { icon: '🏦', label: 'Lenders', line: 'Real terms, shown plainly. No teaser-rate games, no 17-day mystery.' },
  { icon: '🔎', label: 'Inspectors', line: 'Their calendar and process, up front. You know exactly when and how.' },
  { icon: '🛡️', label: 'Insurance', line: 'Quotes brought to you — instead of “go find your own.”' },
  { icon: '🤝', label: 'Escrow', line: 'Clear, steady, and ready when you are.' },
];

export default function BullpenPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      {/* top bar */}
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
          <Link href="/map" className="hover:text-[#1349d4] transition-colors">Enter the map</Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl px-6 pt-16 md:pt-24 pb-10 text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
            The Buyer Bullpen
          </div>
          <h1 className="font-headline text-4xl md:text-6xl font-extrabold mt-4 leading-[1.04]">
            Stop chasing.<br />Get seen instead.
          </h1>
          <p className="text-lg md:text-xl mt-6 text-[#4a5568] leading-relaxed max-w-2xl mx-auto">
            For a hundred years, buyers went door to door — applying to lenders,
            begging for approval, hunting their own quotes, hoping someone would
            say yes. We flipped it. Step into the bullpen, get seen, and let the
            qualified people come compete for <em>you</em>.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup?intent=bullpen"
              className="px-7 py-3.5 rounded-full text-base font-bold transition-all"
              style={{ background: 'linear-gradient(160deg,#1349d4,#122d8d)', color: '#fff', boxShadow: '0 12px 28px -10px rgba(19,73,212,0.7)' }}
            >
              Claim your spot in the bullpen
            </Link>
            <Link
              href="/essays/the-manufactured-squabble"
              className="px-7 py-3.5 rounded-full text-base font-semibold transition-colors text-[#1349d4]"
              style={{ border: '1px solid rgba(19,73,212,0.3)' }}
            >
              Why we built this
            </Link>
          </div>
        </section>

        {/* ── The elevation visual (buyer up, responders reaching) ── */}
        <section className="mx-auto max-w-3xl px-6 py-10">
          <div
            className="rounded-3xl p-8 md:p-12 text-center"
            style={{ background: 'linear-gradient(180deg, rgba(19,73,212,0.06), rgba(224,231,251,0.4))', border: '1px solid rgba(19,73,212,0.14)' }}
          >
            <div className="inline-block rounded-2xl px-6 py-4 bg-white" style={{ boxShadow: '0 16px 40px -20px rgba(20,50,120,0.5)', border: '1px solid rgba(19,73,212,0.16)' }}>
              <div className="text-xs uppercase tracking-widest font-bold text-[#1349d4]">You’re up here</div>
              <div className="font-headline text-2xl font-extrabold mt-1">The Buyer</div>
            </div>
            <div className="text-2xl text-[#1349d4] my-4">↑↑↑</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Lender', 'Lender', 'Inspector', 'Insurance', 'Escrow'].map((r, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#6b7689]" style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.12)' }}>
                  {r} reaching up
                </span>
              ))}
            </div>
            <p className="text-sm mt-5 text-[#4a5568]">
              Everyone capable of serving you can see you. They come to you, on your terms.
            </p>
          </div>
        </section>

        {/* ── Who competes for you ── */}
        <section className="mx-auto max-w-3xl px-6 py-10">
          <h2 className="font-headline text-2xl font-bold text-center">Who competes for you</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {ROSTER.map((r) => (
              <div key={r.label} className="rounded-2xl p-5" style={{ background: 'rgba(19,73,212,0.04)', border: '1px solid rgba(19,73,212,0.12)' }}>
                <div className="text-2xl">{r.icon}</div>
                <div className="font-bold mt-2 text-[#0c1322]">{r.label}</div>
                <p className="text-sm mt-1 text-[#4a5568] leading-relaxed">{r.line}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-4 text-[#8a93a4]">
            Title runs quietly in the background as part of the process — no audition needed.
          </p>
        </section>

        {/* ── The open-platform promise (the principle, front and center) ── */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div
            className="rounded-3xl p-8 md:p-10"
            style={{ background: 'linear-gradient(160deg, rgba(27,158,106,0.08), rgba(27,158,106,0.03))', border: '1px solid rgba(27,158,106,0.25)' }}
          >
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#1b7a55]">
              Open to every buyer
            </div>
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold mt-2 text-[#0c1322]">
              This is yours, whether you’re my client or not.
            </h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#27313f]">
              <p>
                Already have an agent you love? Use this anyway — it’s built to work
                alongside them, not replace them. I’m not going to require your business
                to let you stand here.
              </p>
              <p>
                No fee to get in the bullpen. No catch that quietly undoes the whole
                point. I want every buyer to have this elevation — because putting the
                directing authority back with the person who came to buy something is
                the entire idea. Not a funnel. A principle.
              </p>
            </div>
            <Link
              href="/signup?intent=bullpen"
              className="inline-block mt-6 px-6 py-3 rounded-full text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(160deg,#1b9e6a,#15885a)', color: '#fff', boxShadow: '0 12px 28px -12px rgba(27,158,106,0.7)' }}
            >
              Step into the bullpen →
            </Link>
          </div>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
