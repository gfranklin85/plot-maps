// /essays/[slug] — a single essay. Pure idea up top; a quiet founder doorway
// at the bottom (the flare lands on a real position, not a floating hot take).
// Light/blue locked theme. See memory/project_rollout_sequence_thinking.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import { findEssay, ESSAYS } from '@/lib/essays';

export function generateStaticParams() {
  return ESSAYS.map((e) => ({ slug: e.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const essay = findEssay(params.slug);
  if (!essay) return { title: 'Essay — Plot Maps' };
  return {
    title: `${essay.title} — Plot Maps`,
    description: essay.dek,
    openGraph: { title: essay.title, description: essay.dek, type: 'article' },
  };
}

export default function EssayPage({ params }: { params: { slug: string } }) {
  const essay = findEssay(params.slug);
  if (!essay) return notFound();

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
        <article className="mx-auto max-w-2xl px-6 py-14 md:py-20">
          {/* eyebrow */}
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
            Essays · Delete the structure, not the symptom
          </div>

          {/* title + dek */}
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold mt-4 leading-[1.08]">
            {essay.title}
          </h1>
          <p className="text-lg md:text-xl mt-4 text-[#4a5568] leading-relaxed">
            {essay.dek}
          </p>
          <div className="text-xs mt-4 text-[#8a93a4] uppercase tracking-wide font-semibold">
            {essay.date} · {essay.readingMinutes} min read
          </div>

          {/* body */}
          <div className="mt-10 space-y-6">
            {essay.body.map((block, i) => {
              switch (block.kind) {
                case 'h2':
                  return (
                    <h2 key={i} className="font-headline text-2xl font-bold pt-4 text-[#0c1322]">
                      {block.text}
                    </h2>
                  );
                case 'quote':
                  return (
                    <blockquote
                      key={i}
                      className="my-2 pl-5 py-3 text-lg font-semibold text-[#122d8d]"
                      style={{ borderLeft: '3px solid #1349d4', background: 'rgba(19,73,212,0.04)' }}
                    >
                      {block.text}
                    </blockquote>
                  );
                case 'hr':
                  return <hr key={i} className="my-8 border-[rgba(19,73,212,0.14)]" />;
                case 'p':
                default:
                  return (
                    <p key={i} className="text-[17px] leading-[1.75] text-[#27313f]">
                      {block.text}
                    </p>
                  );
              }
            })}
          </div>

          {/* ── the founder doorway — earns the look without showing the hand ── */}
          <div
            className="mt-14 rounded-2xl p-6 md:p-8"
            style={{ background: 'linear-gradient(160deg, rgba(19,73,212,0.07), rgba(18,45,141,0.04))', border: '1px solid rgba(19,73,212,0.16)' }}
          >
            <p className="text-[15px] leading-relaxed text-[#27313f]">
              This isn’t a thought I had on a coffee break. There’s a working tool that
              builds an offer this way — plain language, the buyer in the driver’s seat —
              and a brokerage built on this whole way of thinking. If any of it lands
              with you, come see it.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm">
                <div className="font-bold text-[#0c1322]">Gregory Franklin</div>
                <div className="text-[#6b7689]">Broker · Position Realty · CA DRE #02090737</div>
              </div>
              <div className="sm:ml-auto flex gap-3">
                <Link
                  href="/position"
                  className="px-4 py-2 rounded-full text-sm font-bold transition-all"
                  style={{ background: 'linear-gradient(160deg,#1349d4,#122d8d)', color: '#fff', boxShadow: '0 10px 24px -10px rgba(19,73,212,0.7)' }}
                >
                  See Position →
                </Link>
                <Link
                  href="/join-position"
                  className="px-4 py-2 rounded-full text-sm font-bold transition-colors text-[#1349d4]"
                  style={{ border: '1px solid rgba(19,73,212,0.3)' }}
                >
                  For agents
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Link href="/essays" className="text-sm font-semibold text-[#1349d4] hover:underline">
              ← More essays
            </Link>
          </div>
        </article>
      </main>

      <PositionFooter />
    </div>
  );
}
