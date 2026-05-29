// /position — Position Realty's brokerage identity page inside Plot Maps.
//
// Locked 2026-05-29. See:
//   memory/project_plot_maps_position_hierarchy.md
//   memory/project_brokerage_position.md
//   memory/project_operator_tier_culture_thesis.md
//
// Job of this page:
//   1. Make clear who is responsible for the brokerage activity inside
//      Plot Maps (Position Realty, Gregory Franklin, CA DRE)
//   2. Give consumers a path to reach Greg directly for buyer/seller help
//   3. Provide a quiet "agent inquiries" link to /join-position for
//      operator-tier agents (NOT a prestige recruiting pitch)
//
// Tone: professional, direct, not prestige-gimmicky. "We help people
// transact real estate with better tools and clearer data" — not
// "We are an elite boutique brokerage."

import type { Metadata } from 'next';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';

export const metadata: Metadata = {
  title: 'Position Realty — Plot Maps',
  description:
    'Position Realty is the California-licensed brokerage operating inside Plot Maps. Buyer and seller representation, listing services, and land/commercial advisory — all built around better tools, clearer data, and direct operator-level service.',
};

export default function PositionPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#F5EDD8" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
          <Link href="/map" className="hover:text-white transition-colors">Enter Map</Link>
          <Link href="/position" className="text-amber-200 transition-colors">Position Realty</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative px-6 md:px-10 pt-32 pb-16">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,214,107,0.08),transparent_55%)]" />
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="text-xs uppercase tracking-[0.32em] text-amber-300/80">
            Operated by · CA DRE #02090737
          </div>
          <h1 className="mt-4 font-headline text-4xl md:text-6xl font-light tracking-tight text-zinc-50 leading-[1.05]">
            Position Realty
          </h1>
          <p className="mt-6 text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
            A California brokerage built around better tools, clearer
            data, and direct operator-level service. We help buyers,
            sellers, landowners, and investors navigate real estate
            through the Plot Maps experience.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-amber-300 text-zinc-950 px-5 py-3 text-sm font-semibold hover:bg-amber-200 transition-colors"
            >
              Contact Greg
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/45 text-amber-200 px-5 py-3 text-sm font-medium hover:bg-amber-300/10 transition-colors"
            >
              Open Plot Maps →
            </Link>
          </div>
        </div>
      </section>

      {/* ── BROKER IDENTITY ─────────────────────────────────── */}
      <section className="px-6 md:px-10 py-14 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-2">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">Broker</div>
            <h2 className="text-2xl font-light text-zinc-50 tracking-tight">Gregory M. Franklin</h2>
            <div className="text-sm text-zinc-400 leading-relaxed">
              California Real Estate Broker<br />
              DRE #02090737
            </div>
            <div className="pt-3 text-xs text-zinc-500 leading-relaxed">
              Naval Aviation Air Operations Center background.
              Builds the platform that the brokerage operates on.
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-zinc-300 leading-relaxed">
            <Detail label="Entity" value="Position Realty LLC" sub="California LLC (pending SOS post-amendment from Franklin Equities LLC, 05/28/2026)" />
            <Detail label="Office" value="Lemoore, California" sub="Serving Kings, Tulare, Fresno counties — expanding" />
            <Detail label="Operates inside" value="Plot Maps" sub="Spatial real-estate platform — search, fly, discover" />
            <Detail label="Infrastructure" value="Plot Solutions LLC" sub="The operator company behind the platform" />
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────── */}
      <section className="px-6 md:px-10 py-16 border-t border-zinc-900 bg-zinc-925/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs uppercase tracking-[0.32em] text-amber-300/70 text-center">
            What we do
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-light tracking-tight text-zinc-50 text-center">
            Real estate services, operator-grade.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <ServiceCard
              title="Buyer representation"
              body="Find homes spatially. Tour neighborhoods from the air before flying to see them in person."
            />
            <ServiceCard
              title="Seller / listing services"
              body="List with a broker who renders your property in 3D and reaches buyers through Plot Maps and the MLS."
            />
            <ServiceCard
              title="Land & commercial advisory"
              body="Parcel-level intelligence, zoning context, and aerial framing for land and commercial transactions."
            />
            <ServiceCard
              title="Relocation scouting"
              body="Moving to a new area? Scout your future neighborhood, commute, schools, and base from your couch first."
            />
          </div>
        </div>
      </section>

      {/* ── HOW PLOT MAPS CHANGES THE EXPERIENCE ─────────────── */}
      <section className="px-6 md:px-10 py-20 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto space-y-6 text-zinc-300 leading-relaxed">
          <div className="text-xs uppercase tracking-[0.32em] text-amber-300/70">
            How Plot Maps changes the client experience
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight text-zinc-50">
            Better tools mean better decisions.
          </h2>
          <p className="text-lg">
            Most real estate platforms show you photos and floor plans.
            Plot Maps gives you the lived experience of the neighborhood
            — the actual commute, the actual schools, the actual vibe
            — in a spatial 3D world you can fly through with a controller
            or a mouse.
          </p>
          <p>
            When you find a property you want help with, you reach a
            real California-licensed broker — not a faceless inquiry form.
            That broker is Greg Franklin, the same person who built the
            platform. The tooling and the representation are the same operation.
          </p>
        </div>
      </section>

      {/* ── AGENT INQUIRIES (quiet doorway, not headline) ───── */}
      <section className="px-6 md:px-10 py-14 border-t border-zinc-900 bg-zinc-925/30">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            Agent inquiries
          </div>
          <h3 className="text-xl md:text-2xl font-light text-zinc-100 tracking-tight">
            Position Realty is preparing a selective expansion as Plot Maps develops.
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Licensed California agents interested in future opportunities
            may request a conversation. We&apos;re not running a recruiting
            machine; we&apos;re choosing operators carefully.
          </p>
          <div className="pt-2">
            <Link
              href="/join-position"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/45 text-amber-200 px-5 py-2.5 text-sm font-medium hover:bg-amber-300/10 transition-colors"
            >
              Join Position →
            </Link>
          </div>
        </div>
      </section>

      <PositionFooter />
    </div>
  );
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className="mt-1 text-zinc-100 font-medium">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500 leading-relaxed">{sub}</div>}
    </div>
  );
}

function ServiceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 hover:border-amber-300/40 transition-colors">
      <div className="text-sm font-semibold text-amber-200 tracking-tight">{title}</div>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}
