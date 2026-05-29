// /join-position — the quiet agent doorway into Position Realty.
//
// Locked 2026-05-29. Tone is deliberately UN-prestige. See:
//   memory/project_operator_tier_culture_thesis.md (anti-prestige posture)
//   memory/project_plot_maps_position_hierarchy.md (sits below /position)
//   memory/project_landing_search_first_no_gate.md (never headlined on /)
//
// What this page is NOT:
//   - A recruiting machine
//   - A splits negotiation
//   - A top-producer leaderboard pitch
//   - A "join the prestigious next-generation brokerage" manifesto
//
// What it IS:
//   - A controlled doorway for licensed CA agents who already understand
//     the operator-tier framing and want a conversation
//   - A soft intake that captures enough signal to evaluate the agent
//     without committing either side to anything
//
// Form posts to /api/public/agent-inquiry (built separately). For
// initial launch, the endpoint can write to a simple table and email
// Greg; the full agent CRM is post-launch work.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';

export default function JoinPositionPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/public/agent-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('failed');
        setError(data?.error || 'Submission failed. Please try again.');
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('failed');
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="absolute top-0 left-0 right-0 z-30 px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#F5EDD8" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
          <Link href="/map" className="hover:text-white transition-colors">Enter Map</Link>
          <Link href="/position" className="hover:text-white transition-colors">Position Realty</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>
      </header>

      <section className="relative flex-1 px-6 md:px-10 pt-32 pb-20">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,214,107,0.08),transparent_55%)]" />
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="text-xs uppercase tracking-[0.32em] text-amber-300/80">
            Agent inquiries
          </div>
          <h1 className="mt-4 font-headline text-4xl md:text-5xl font-light tracking-tight text-zinc-50 leading-[1.05]">
            Join Position
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed">
            A brokerage for real-estate operators building with better
            tools, clearer data, and fewer old industry habits.
          </p>

          <div className="mt-10 space-y-5 text-sm text-zinc-300 leading-relaxed border-l-2 border-amber-300/35 pl-5">
            <p>
              Position Realty operates inside Plot Maps — a spatial
              real-estate platform built for search, prospecting,
              property intelligence, and client experience.
            </p>
            <p>
              We&apos;re building for agents who want more than a desk, a
              logo, and another production meeting. Position is for
              operators, builders, local experts, and agents who want
              to work with better infrastructure.
            </p>
            <p className="text-zinc-400 text-xs">
              Position Realty is currently accepting conversations with
              select California agents as Plot Maps expands.
            </p>
          </div>

          {/* ── form ──────────────────────────────────────── */}
          {status === 'sent' ? (
            <div className="mt-12 rounded-2xl bg-zinc-900/60 border border-amber-300/35 p-8 text-center space-y-3">
              <div className="text-amber-200 text-sm font-medium tracking-wide uppercase">
                Inquiry received
              </div>
              <p className="text-zinc-300">
                Thanks — Greg will be in touch directly. There&apos;s no
                automated follow-up sequence; this goes to a real person.
              </p>
              <div className="pt-2">
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 text-zinc-300 hover:text-amber-200 hover:border-amber-300/40 px-5 py-2.5 text-sm transition-colors"
                >
                  Explore Plot Maps →
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-12 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field name="name" label="Name" required />
                <Field name="email" label="Email" type="email" required />
                <Field name="phone" label="Phone" type="tel" />
                <Field name="license_number" label="CA DRE license #" required />
                <Field name="market" label="Primary market / county" placeholder="e.g. Kings County" />
                <Field name="current_brokerage" label="Current brokerage" />
              </div>
              <FieldArea
                name="what_building"
                label="What are you trying to build?"
                placeholder="Short is fine. Tell us what kind of real-estate practice you're operating or want to operate."
              />
              {error && (
                <p className="text-xs text-rose-300">{error}</p>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="rounded-full bg-amber-300 text-zinc-950 px-5 py-2.5 text-sm font-semibold tracking-wide hover:bg-amber-200 disabled:opacity-50 transition-colors"
                >
                  {status === 'sending' ? 'Sending…' : 'Request a Conversation'}
                </button>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Goes directly to Greg. No automated drip campaign.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      <PositionFooter />
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400 mb-1.5">
        {label}{required && <span className="text-amber-300/90"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg bg-zinc-900/70 border border-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/30 transition-colors"
      />
    </label>
  );
}

function FieldArea({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400 mb-1.5">
        {label}
      </span>
      <textarea
        name={name}
        rows={4}
        placeholder={placeholder}
        className="w-full rounded-lg bg-zinc-900/70 border border-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/30 transition-colors resize-y"
      />
    </label>
  );
}
