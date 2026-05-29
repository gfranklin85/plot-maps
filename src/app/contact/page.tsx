// /contact — the public contact path.
//
// Locked 2026-05-29. The lightweight consumer-facing route to reach
// Greg / Position Realty about a property, a market, or working with
// the brokerage. Lives outside the map app so a curious visitor can
// reach a human without having to learn the spatial UI.
//
// See:
//   memory/project_plot_maps_position_hierarchy.md
//   memory/project_landing_search_first_no_gate.md

'use client';

import { useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/public/contact', {
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
          <Link href="/contact" className="text-amber-200">Contact</Link>
        </nav>
      </header>

      <section className="relative flex-1 px-6 md:px-10 pt-32 pb-20">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,214,107,0.08),transparent_55%)]" />
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">

          {/* ── left: identity ──────────────────────────── */}
          <div className="md:col-span-2 space-y-6">
            <div className="text-xs uppercase tracking-[0.32em] text-amber-300/80">
              Get in touch
            </div>
            <h1 className="font-headline text-4xl md:text-5xl font-light tracking-tight text-zinc-50 leading-[1.05]">
              Talk to Greg directly.
            </h1>
            <p className="text-zinc-400 leading-relaxed">
              About a property you saw on Plot Maps, a market you&apos;re
              moving to, working with Position Realty, or anything else.
              No call center — you reach a California-licensed broker
              who also built this platform.
            </p>

            <div className="pt-6 border-t border-zinc-800 space-y-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Email</div>
                <a href="mailto:gregfranklin523@gmail.com" className="text-zinc-100 hover:text-amber-200">
                  gregfranklin523@gmail.com
                </a>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Phone</div>
                <a href="tel:+15598167780" className="text-zinc-100 hover:text-amber-200">
                  559-816-7780
                </a>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Broker</div>
                <div className="text-zinc-100">Gregory M. Franklin · CA DRE #02090737</div>
              </div>
            </div>
          </div>

          {/* ── right: form ──────────────────────────────── */}
          <div className="md:col-span-3">
            {status === 'sent' ? (
              <div className="rounded-2xl bg-zinc-900/60 border border-amber-300/35 p-8 text-center space-y-3">
                <div className="text-amber-200 text-sm font-medium tracking-wide uppercase">
                  Message received
                </div>
                <p className="text-zinc-300">
                  Greg will get back to you directly. Usually within a
                  business day.
                </p>
                <div className="pt-2">
                  <Link
                    href="/map"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700 text-zinc-300 hover:text-amber-200 hover:border-amber-300/40 px-5 py-2.5 text-sm transition-colors"
                  >
                    Back to Plot Maps →
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field name="name" label="Name" required />
                  <Field name="email" label="Email" type="email" required />
                  <Field name="phone" label="Phone" type="tel" />
                  <Field name="topic" label="About" placeholder="A property / a market / Position Realty / other" />
                </div>
                <FieldArea name="message" label="Message" required />
                {error && <p className="text-xs text-rose-300">{error}</p>}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="rounded-full bg-amber-300 text-zinc-950 px-5 py-2.5 text-sm font-semibold tracking-wide hover:bg-amber-200 disabled:opacity-50 transition-colors"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send Message'}
                  </button>
                  <p className="text-[11px] text-zinc-500">
                    Reaches Greg directly.
                  </p>
                </div>
              </form>
            )}
          </div>
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
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.18em] text-zinc-400 mb-1.5">
        {label}{required && <span className="text-amber-300/90"> *</span>}
      </span>
      <textarea
        name={name}
        rows={5}
        required={required}
        className="w-full rounded-lg bg-zinc-900/70 border border-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/30 transition-colors resize-y"
      />
    </label>
  );
}
