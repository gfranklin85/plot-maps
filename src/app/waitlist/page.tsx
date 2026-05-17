'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

// Two states this page handles:
//   1. Anonymous visitor → "Plot is in private beta. Leave your email."
//   2. Logged-in but not whitelisted → "You're on the waitlist; we'll
//      reach out when we open up." Plus a sign-out button so they're
//      not trapped.
//
// The middleware sends category-2 users here from anywhere they tried
// to go. Category-1 users land here via the /signup redirect.

export default function WaitlistPage() {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Need a real email.');
      return;
    }
    setSubmitting(true);
    const { error: dbError } = await supabase
      .from('waitlist')
      .insert({ email: email.trim().toLowerCase(), note: note.trim() || null });
    setSubmitting(false);
    if (dbError) {
      // Treat unique-constraint failures as success — they're already on the list.
      if (dbError.code === '23505') {
        setSubmitted(true);
        return;
      }
      setError(dbError.message);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <MaterialIcon icon="map" className="text-[28px]" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface">Plot is in private beta</h1>
          <p className="text-sm text-on-surface-variant">
            We&apos;re heads-down building. The map, the prospecting, the gameplay — all under active renovation. We&apos;ll open the doors when it&apos;s ready.
          </p>
        </div>

        {user ? (
          // Logged in but not whitelisted.
          <div className="glass-card rounded-2xl p-6 space-y-4 text-center">
            <p className="text-sm text-on-surface">
              You&apos;re on the list as <span className="font-semibold">{user.email}</span>. We&apos;ll reach out when we let you in.
            </p>
            <button
              onClick={signOut}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : submitted ? (
          // Anonymous submitted.
          <div className="glass-card rounded-2xl p-6 text-center space-y-2">
            <MaterialIcon icon="check_circle" className="text-[40px] text-emerald-500" />
            <p className="text-sm text-on-surface font-semibold">You&apos;re on the list.</p>
            <p className="text-xs text-on-surface-variant">We&apos;ll email when we open access.</p>
          </div>
        ) : (
          // Anonymous, signup form.
          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">What you do (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="agent, investor, etc."
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Join the waitlist'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
