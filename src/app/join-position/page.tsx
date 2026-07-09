'use client';

// /join-position — Join Position: the doorway for licensed CA agents.
//
// Rewritten 2026-07-09 to the brand palette (fp / --plot-brand) + AppHeader,
// plain confident voice (never crusading — memory/the_facts VOICE lock).
// Position is a licensed CA brokerage now (Corp #02446130). The form logic
// is unchanged (posts to /api/public/agent-inquiry → Greg). This is a real
// intake, not a recruiting machine.

import { useState } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function JoinPositionPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
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
    <div className="fp">
      <AppHeader variant="public" />

      <section className="pos-hero">
        <div className="pos-wrap" style={{ maxWidth: 760 }}>
          <div className="fp-eyebrow" style={{ textAlign: 'left' }}>Join Position</div>
          <h1 className="pos-h1">Hang your license somewhere that hands you the tools.</h1>
          <p className="pos-lede">
            Position Realty is a licensed California brokerage that runs on the
            PlotMaps platform: map-based prospecting, a team that competes for
            every client, guided disclosures, and offers built with the real
            numbers. If that&apos;s the way you want to work, let&apos;s talk.
          </p>

          <ul className="pos-list" style={{ marginTop: 22 }}>
            <li><MaterialIcon icon="check" className="text-[16px]" /> Prospect from the map — see a house, reach the owner, send a real letter.</li>
            <li><MaterialIcon icon="check" className="text-[16px]" /> Build a competing team for each client — lenders and pros come to you.</li>
            <li><MaterialIcon icon="check" className="text-[16px]" /> Disclosures and offers flow through the platform, not hand-built forms.</li>
          </ul>

          {status === 'sent' ? (
            <div className="pos-license" style={{ marginTop: 32, textAlign: 'center' }}>
              <b>Thanks — we got it.</b>
              <span style={{ marginTop: 8 }}>Greg will reach out directly. No automated drip, no leaderboard pitch — a real conversation.</span>
              <div style={{ marginTop: 16 }}><a className="fp-cta fp-cta--primary" href="/map?view=3d">Explore PlotMaps</a></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pos-form">
              <div className="pos-form__grid">
                <Field name="name" label="Name" required />
                <Field name="email" label="Email" type="email" required />
                <Field name="phone" label="Phone" type="tel" />
                <Field name="license_number" label="CA DRE license #" required />
                <Field name="market" label="Primary market / county" placeholder="e.g. Kings County" />
                <Field name="current_brokerage" label="Current brokerage" />
              </div>
              <label className="pos-field">
                <span>What are you looking for in a brokerage?</span>
                <textarea name="what_building" rows={4} className="sp-input"
                  placeholder="Short is fine — what kind of practice you run or want to run." />
              </label>
              {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
              <div className="pos-form__foot">
                <button type="submit" disabled={status === 'sending'} className="fp-cta fp-cta--primary">
                  {status === 'sending' ? 'Sending…' : 'Request a conversation'}
                </button>
                <span>Goes straight to Greg — a real person, no drip campaign.</span>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ name, label, type = 'text', required, placeholder }: {
  name: string; label: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="pos-field">
      <span>{label}{required && <em> *</em>}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="sp-input" />
    </label>
  );
}
