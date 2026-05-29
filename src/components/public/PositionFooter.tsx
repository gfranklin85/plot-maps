// PositionFooter — the compliance + trust layer that appears on every
// public-facing page of Plot Maps. Establishes that Position Realty
// (a CA-licensed brokerage) is the operator responsible for the
// brokerage activity surfaced through the platform.
//
// Locked 2026-05-29. See:
//   memory/project_plot_maps_position_hierarchy.md
//   memory/project_landing_search_first_no_gate.md
//
// Three audience cues live here:
//   1. Brokerage identity (Position Realty, broker name, DRE)
//   2. Compliance chrome (EHO, MLS/IDX disclaimer, listing attribution)
//   3. Contact path (email + phone) and links to the brand pages
//
// Tone: quiet, present, not flashy. The footer is legitimacy, not pitch.

import Link from 'next/link';
import PositionWordmark from '@/components/brand/PositionWordmark';

export default function PositionFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-800/60 bg-zinc-950 text-zinc-400">
      <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">

        {/* Brand block */}
        <div className="space-y-3">
          <div className="text-zinc-100 font-semibold tracking-tight">Plot Maps</div>
          <p className="text-zinc-400 leading-relaxed">
            A spatial real-estate platform operated by Position Realty,
            a California-licensed brokerage.
          </p>
        </div>

        {/* Brokerage block — the Position wordmark replaces the typeset
            "Position Realty" header so the locked logomark gets its own
            quiet placement on every public page footer.
            Color is themed via --plot-text so it inverts with the theme. */}
        <div className="space-y-3">
          <Link href="/position" aria-label="Position Realty" className="inline-block">
            <PositionWordmark
              color="var(--plot-text)"
              className="h-5 w-auto opacity-90 hover:opacity-100 transition-opacity"
            />
          </Link>
          <p>
            <Link href="/position" className="hover:text-zinc-100 underline-offset-2 hover:underline">
              About Position
            </Link>
          </p>
          <p>
            <Link href="/join-position" className="hover:text-zinc-100 underline-offset-2 hover:underline">
              Agent inquiries
            </Link>
          </p>
          <p>
            <Link href="/contact" className="hover:text-zinc-100 underline-offset-2 hover:underline">
              Contact Greg
            </Link>
          </p>
        </div>

        {/* Compliance block */}
        <div className="space-y-2 text-xs">
          <div className="text-zinc-100 font-semibold tracking-tight text-sm">Compliance</div>
          <p>
            Gregory M. Franklin, Broker<br />
            CA DRE&nbsp;#02090737
          </p>
          <p>Equal Housing Opportunity</p>
          <p className="text-zinc-500 leading-relaxed">
            Listing data, when displayed, is provided by the originating
            MLS and the listing brokerage. Plot Maps and Position Realty
            do not warrant the accuracy of third-party listing data.
          </p>
        </div>

        {/* Contact block */}
        <div className="space-y-2 text-xs">
          <div className="text-zinc-100 font-semibold tracking-tight text-sm">Contact</div>
          <p>
            <a href="mailto:gregfranklin523@gmail.com" className="hover:text-zinc-100">
              gregfranklin523@gmail.com
            </a>
          </p>
          <p>
            <a href="tel:+15598167780" className="hover:text-zinc-100">
              559-816-7780
            </a>
          </p>
          <p className="pt-3 text-zinc-500">
            Plot Solutions LLC operates the platform infrastructure.{' '}
            <a
              href="https://plot.solutions"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 underline-offset-2 hover:underline"
            >
              plot.solutions →
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] text-zinc-500">
          <div>© {year} Plot Solutions LLC. All rights reserved.</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
            <Link href="/cookies" className="hover:text-zinc-300">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
