'use client';

// ── EmptyStateGrowth — the "nobody's home yet" growth loop ────────────
//
// Greg 2026-07-08: when a search finds no match (the launch reality), don't
// dead-end them. Every empty search becomes a GROWTH action — the user
// becomes the crawler. Three paths, all live:
//   1. SEED — route to their target area, send PostGrid postcards to homes
//      there ("thinking of selling? someone wants to move here").
//   2. SHARE — a recruit link that invites others to post their status.
//   3. NOTIFY — the calm fallback: we email you the moment a match appears.
// This is how a two-sided market cold-starts. memory/the_thesis.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function EmptyStateGrowth({
  wantId,
  toLabel,
  toLat,
  toLng,
  contact,
  onContactSaved,
}: {
  wantId: string;
  toLabel: string | null;
  toLat: number | null;
  toLng: number | null;
  contact: string | null;
  onContactSaved: (c: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(!!contact);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?ref=${wantId}`
    : `/join?ref=${wantId}`;

  const seedHref = toLat != null && toLng != null
    ? `/seed?want=${wantId}&lat=${toLat}&lng=${toLng}&label=${encodeURIComponent(toLabel ?? '')}`
    : `/seed?want=${wantId}&label=${encodeURIComponent(toLabel ?? '')}`;

  const share = async () => {
    const text = `I'm looking to make a move on PlotMaps — post where YOU'd go (and what you've got) and we might connect. `;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PlotMaps — post your move', text, url: shareUrl });
        return;
      }
    } catch { /* fall through to copy */ }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  };

  const saveNotify = () => {
    if (!email.trim()) return;
    onContactSaved(email.trim());
    setSaved(true);
  };

  return (
    <div className="esg">
      <div className="esg-head">
        <MaterialIcon icon="radar" className="text-[24px]" />
        <h3>No match yet — so let&apos;s go find one.</h3>
        <p>The network grows every day, but you don&apos;t have to wait. Here&apos;s how to make your move happen faster:</p>
      </div>

      <div className="esg-cards">
        {/* 1 — SEED: postcards into the target area */}
        <a className="esg-card esg-card--primary" href={seedHref}>
          <span className="esg-card__ic"><MaterialIcon icon="mail" className="text-[22px]" /></span>
          <b>Seed your area{toLabel ? ` — ${toLabel}` : ''}</b>
          <span className="esg-card__d">
            Send a postcard to homes where you want to land: &ldquo;Someone&apos;s
            looking to move here — thinking of selling?&rdquo; Turn your want into
            real doors knocked.
          </span>
          <span className="esg-card__go">Pick homes &amp; send <MaterialIcon icon="arrow_forward" className="text-[15px]" /></span>
        </a>

        {/* 2 — SHARE: recruit more posters */}
        <button className="esg-card" onClick={share}>
          <span className="esg-card__ic"><MaterialIcon icon="ios_share" className="text-[22px]" /></span>
          <b>Share your search</b>
          <span className="esg-card__d">
            Pull people in. Every friend, neighbor, or group that posts their
            move makes a connection more likely — for you and for them.
          </span>
          <span className="esg-card__go">{copied ? 'Link copied!' : 'Share link'} <MaterialIcon icon={copied ? 'check' : 'link'} className="text-[15px]" /></span>
        </button>

        {/* 3 — NOTIFY: the calm fallback */}
        <div className="esg-card esg-card--notify">
          <span className="esg-card__ic"><MaterialIcon icon="notifications_active" className="text-[22px]" /></span>
          <b>Or just wait — we&apos;ll find it</b>
          {saved ? (
            <span className="esg-card__d esg-saved">
              <MaterialIcon icon="check_circle" className="text-[16px]" /> We&apos;ll email you the moment a match appears.
            </span>
          ) : (
            <>
              <span className="esg-card__d">We&apos;ll email you the moment a direct connection or move path appears.</span>
              <div className="esg-notify">
                <input className="sp-input" placeholder="Email or phone" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="mrq-btn mrq-btn--primary" onClick={saveNotify} disabled={!email.trim()}>Notify me</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
