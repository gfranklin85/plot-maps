'use client';

// ── /join — the recruit landing (shared from an empty search) ─────────
//
// When someone shares their search (EmptyStateGrowth), the link lands here.
// It's the warm "someone you know is trying to move — post yours too" pitch,
// then routes into /post. ?ref=<wantId> credits the recruiter (attribution
// for the growth loop). memory/the_thesis (the user is the crawler).

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function JoinPage() {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ref');
    setRef(r);
    if (r) { try { window.localStorage.setItem('plotmaps.ref', r); } catch { /* private */ } }
  }, []);

  return (
    <div className="dsh min-h-screen">
      <header className="mrq-chrome">
        <a href="/" className="mrq-chrome__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" />
          <span>by{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/position-logo.svg" alt="Position" /></span>
        </a>
      </header>

      <div className="mrq-gate">
        <span className="mrq-badge"><MaterialIcon icon="hub" className="text-[14px]" /> Real Estate Interconnector</span>
        <h1 className="mrq-gate__h">Someone wants to connect with you.</h1>
        <p className="mrq-gate__sub">
          A person you know is trying to make a move — and the way this works,
          your move and theirs might fit together. Post where you&apos;d go and what
          you&apos;ve got, and the map checks for a real connection. Free, private
          until you say otherwise.
        </p>
        <a className="mrq-btn mrq-btn--primary mrq-gate__btn" href="/post">
          Post my move <MaterialIcon icon="arrow_forward" className="text-[18px]" />
        </a>
        <p className="mrq-gate__fine">
          <MaterialIcon icon="lock" className="text-[13px]" />
          It only works if more people post — that&apos;s how the connections get made.
        </p>
        {ref && <input type="hidden" value={ref} readOnly />}
      </div>
    </div>
  );
}
