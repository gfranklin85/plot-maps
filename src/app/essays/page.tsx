// /essays — the index of the ideas series. Light/blue locked theme.
// See memory/project_rollout_sequence_thinking.

import type { Metadata } from 'next';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import { ESSAYS } from '@/lib/essays';

export const metadata: Metadata = {
  title: 'Essays — Plot Maps',
  description:
    'Delete the structure, not the symptom. Plain-spoken essays on the manufactured frictions of real estate — and how to remove them at the root.',
};

export default function EssaysIndex() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
          <Link href="/map" className="hover:text-[#1349d4] transition-colors">Enter the map</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-16 md:py-24">
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
            Essays
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold mt-4 leading-[1.08]">
            Delete the structure,<br />not the symptom.
          </h1>
          <p className="text-lg mt-5 text-[#4a5568] leading-relaxed">
            Most of what feels broken in real estate isn’t human nature — it’s
            the forms, the conventions, and the fine print quietly manufacturing
            it. These are plain-spoken takes on where the real walls are, where
            the painted ones are, and how to remove the thing that creates the
            problem in the first place.
          </p>

          <div className="mt-12 space-y-4">
            {ESSAYS.map((e) => (
              <Link
                key={e.slug}
                href={`/essays/${e.slug}`}
                className="block rounded-2xl p-6 transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(19,73,212,0.04)', border: '1px solid rgba(19,73,212,0.12)' }}
              >
                <div className="text-xs uppercase tracking-wide font-semibold text-[#8a93a4]">
                  {e.date} · {e.readingMinutes} min
                </div>
                <h2 className="font-headline text-2xl font-bold mt-1.5 text-[#0c1322]">{e.title}</h2>
                <p className="text-[15px] mt-2 text-[#4a5568] leading-relaxed">{e.dek}</p>
                <div className="text-sm font-semibold mt-3 text-[#1349d4]">Read →</div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
