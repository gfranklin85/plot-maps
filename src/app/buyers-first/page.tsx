// /buyers-first — the buyer-elevation landing. NOT a pitch. It reveals a
// plain fact: everything in this market only happens because of YOU — so you
// never had to chase. State what you want plainly and it comes to you.
// Voice = the cookout speech: humbling, factual, anti-hype, anti-division.
// See memory/feedback_reveal_facts_not_hype_voice + project_vendors_got_talent
// (the arm-up master sequence) + project_buyer_sovereignty_platform.
//
// HERO ART: placeholder below. Greg is making the real piece — faces TOWARD
// camera, a diverse MIX of people (not just young couples) standing elevated;
// responders below reaching up. See the art-brief comment at the hero.

import type { Metadata } from 'next';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionWordmark from '@/components/brand/PositionWordmark';
import PositionFooter from '@/components/public/PositionFooter';

export const metadata: Metadata = {
  title: 'You — Plot Maps',
  description:
    'The whole market only moves because of you. You never had to chase it. State what you want, plainly, and the people who can deliver come to you. For everyone trying to get somewhere — buyers, and sellers, who are buyers too.',
};

export default function BuyersFirstPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      {/* nav — Bullpen wired in (no longer an orphan) */}
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
          <span className="text-sm text-[#6b7689] flex items-center gap-1">
            by <PositionWordmark color="#1349d4" className="h-3.5 w-auto" />
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/bullpen" className="hover:text-[#1349d4] transition-colors">The Bullpen</Link>
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
          <Link href="/map" className="hover:text-[#1349d4] transition-colors">The map</Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── HERO — the plain fact ── */}
        <section className="mx-auto max-w-6xl px-6 pt-14 md:pt-20 pb-12 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
              A plain fact
            </div>
            <h1 className="font-headline text-5xl md:text-6xl font-extrabold mt-4 leading-[1.02]">
              It only happens<br />because of you.
            </h1>
            <p className="text-lg md:text-xl mt-6 text-[#4a5568] leading-relaxed">
              No buyer, no deal. No deal, no commission, no lender, no listing
              worth anything. The whole thing moves because someone decided to
              go get something. That someone is you — and it always was.
            </p>
            <p className="text-base mt-4 text-[#4a5568] leading-relaxed">
              So why have you been the one chasing? Going door to door, repeating
              your story, hoping for a yes? Only because no one ever showed you
              that you could just <span className="font-semibold text-[#0c1322]">say what you want, plainly</span> —
              and watch it come to you.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/bullpen"
                className="px-7 py-3.5 rounded-full text-base font-bold transition-all text-center"
                style={{ background: 'linear-gradient(160deg,#1349d4,#122d8d)', color: '#fff', boxShadow: '0 12px 28px -10px rgba(19,73,212,0.7)' }}
              >
                Say what you want →
              </Link>
              <Link
                href="/essays/the-manufactured-squabble"
                className="px-7 py-3.5 rounded-full text-base font-semibold transition-colors text-center text-[#1349d4]"
                style={{ border: '1px solid rgba(19,73,212,0.3)' }}
              >
                Why this is different
              </Link>
            </div>
          </div>

          {/* HERO ART PLACEHOLDER — Greg making the real piece.
              ART BRIEF: a diverse MIX of people (ages, families, singles,
              backgrounds — "this is all of you", not just young couples)
              standing elevated on a calm platform, FACES TOWARD CAMERA, at
              ease. Below them, responders (lender/inspector/insurer types)
              on lower tiers reaching UP with small offer bubbles. Light,
              airy, blue-accented to match. The elevation tells the story:
              you're up here, everything answers to you. */}
          <div
            className="rounded-3xl aspect-[4/3] flex items-center justify-center text-center p-8"
            style={{ background: 'linear-gradient(180deg, rgba(19,73,212,0.08), rgba(224,231,251,0.5))', border: '1px dashed rgba(19,73,212,0.3)' }}
          >
            <div className="text-[#1349d4]">
              <div className="text-4xl mb-3">🧍‍♀️🧍🧍‍♂️🧍‍♀️</div>
              <div className="text-2xl">↑↑↑</div>
              <div className="text-sm mt-3 font-semibold text-[#6b7689] max-w-xs mx-auto">
                Hero art (you, elevated · faces forward · the market reaching up).
                Greg is making the real piece.
              </div>
            </div>
          </div>
        </section>

        {/* ── THE COOKOUT TRUTH — everyone's the buyer; refuse the division ── */}
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#1349d4] text-center">
            And while we’re being plain
          </div>
          <h2 className="font-headline text-3xl md:text-4xl font-extrabold mt-3 text-center leading-tight">
            Selling? You’re a buyer too.
          </h2>
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-[#27313f]">
            <p>
              Nobody “sells” and walks off the field. You’re liquidating to go
              somewhere next — a bigger place, a smaller one, a new town, the next
              chapter. You’re mid-stride, and the stride lands on a purchase. So
              the old split — buyer over here, seller over there — was never real.
              Everyone in this is the same thing: a person trying to get somewhere.
            </p>
            <p>
              Which is why we don’t ask homeowners “thinking of selling?” That
              question turns a person into inventory. We ask <span className="font-semibold text-[#0c1322]">where are you
              trying to go</span> — and the sale becomes something that happens in
              service of your next move, not a thing we harvested off you.
            </p>
            <p>
              And don’t let anyone left-and-right you into camps over crumbs. The
              fine print that makes buyer and seller scrap over who pays the little
              fees is a grenade — built to keep you divided and predictable. We
              don’t play that. The deal pays its own costs. You just get where
              you’re going.
            </p>
          </div>
        </section>

        {/* ── ARM UP — crew + training before you shop ── */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <h2 className="font-headline text-3xl font-extrabold text-center">Get ready before you go looking.</h2>
          <p className="text-center text-[#4a5568] mt-3 max-w-xl mx-auto">
            By the time you fall for a place, you’re already a captain — not
            scrambling, not asking permission. You arm up two ways first.
          </p>
          <div className="grid md:grid-cols-2 gap-5 mt-8">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(19,73,212,0.04)', border: '1px solid rgba(19,73,212,0.12)' }}>
              <div className="text-2xl">🎤</div>
              <h3 className="font-headline text-xl font-bold mt-2">Your crew comes to you</h3>
              <p className="text-[15px] mt-2 text-[#4a5568] leading-relaxed">
                Step into the Bullpen and get seen. Lenders, inspectors, insurers
                and escrow come compete — bringing you real terms, their calendars,
                their process, up front. You review and pick. They came to you.
              </p>
              <Link href="/bullpen" className="inline-block mt-4 text-sm font-bold text-[#1349d4] hover:underline">
                Step into the Bullpen →
              </Link>
            </div>
            <div className="rounded-2xl p-6" style={{ background: 'rgba(27,158,106,0.05)', border: '1px solid rgba(27,158,106,0.2)' }}>
              <div className="text-2xl">🎓</div>
              <h3 className="font-headline text-xl font-bold mt-2">You actually understand it</h3>
              <p className="text-[15px] mt-2 text-[#4a5568] leading-relaxed">
                Plain-language walkthroughs of your rights, the process, and fair
                housing — no fine print you initial without reading. You come out
                knowing more than most people are ever told, with a certificate
                that says so.
              </p>
              <span className="inline-block mt-4 text-sm font-semibold text-[#6b7689]">Coming soon</span>
            </div>
          </div>
        </section>

        {/* ── open to everyone ── */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-3xl p-8 md:p-10 text-center" style={{ background: 'linear-gradient(160deg, rgba(27,158,106,0.08), rgba(27,158,106,0.03))', border: '1px solid rgba(27,158,106,0.25)' }}>
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-[#0c1322]">
              This is yours — client or not.
            </h2>
            <p className="text-[15px] mt-4 text-[#27313f] leading-relaxed max-w-2xl mx-auto">
              Already have an agent you trust? Use this anyway — it works alongside
              them. No fee to stand here. No catch that quietly undoes the point.
              Everyone trying to get somewhere deserves this. That’s the whole idea.
              It isn’t clever. It’s just right.
            </p>
            <Link
              href="/bullpen"
              className="inline-block mt-6 px-6 py-3 rounded-full text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(160deg,#1b9e6a,#15885a)', color: '#fff', boxShadow: '0 12px 28px -12px rgba(27,158,106,0.7)' }}
            >
              Get started →
            </Link>
          </div>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
