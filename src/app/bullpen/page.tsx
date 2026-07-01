// /bullpen — State your position. Repurposed from the old marketing landing
// into the REAL form: the buyer states their position, one question at a time.
// Stated-only (no verification, no sensitive data). Occupation is the hero
// signal; the agent-vouch + the first real offer are the trust.
// See memory/project_buyer_financial_capture + project_position_job_posting_architecture.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import StatePosition from '@/components/bullpen/StatePosition';
import type { AgentInvite } from '@/lib/bullpen/invite';

export default function BullpenPage() {
  // If the buyer arrived via an agent's invite link (?agent=<token>), pull the
  // agent's info + branding so we pre-fill + skip the agent questions and show
  // "brought to you by …". (memory/project_agent_branded_template)
  const [invite, setInvite] = useState<AgentInvite | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('agent');
    if (!token) { setChecked(true); return; }
    (async () => {
      try {
        const res = await fetch(`/api/agent-invite/${token}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.invite) setInvite(data.invite);
        }
      } catch { /* ignore — falls back to normal flow */ }
      finally { setChecked(true); }
    })();
  }, []);

  const firstName = invite?.agentName?.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/buyers" className="hover:text-[#1349d4] transition-colors">Browse buyers</Link>
          <Link href="/essays" className="hover:text-[#1349d4] transition-colors">Essays</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          {/* agent-branded banner when arriving via an invite */}
          {invite && (
            <div className="bp-agentbrand">
              {invite.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={invite.logoUrl} alt={invite.brokerage || invite.agentName} className="bp-agentbrand__logo" />
                : <div className="bp-agentbrand__mark"><MaterialIcon icon="real_estate_agent" className="text-[20px]" /></div>}
              <div>
                <div className="bp-agentbrand__by">Brought to you by</div>
                <div className="bp-agentbrand__name">
                  {invite.agentName}{invite.brokerage ? <span> · {invite.brokerage}</span> : null}
                </div>
              </div>
            </div>
          )}

          {/* warm header + the escalation promise */}
          <div className="text-center mb-8">
            <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
              State your position · free
            </div>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-3 leading-tight">
              {firstName
                ? `${firstName} set this up for you.`
                : 'Tell us the basics. Let the lenders come to you.'}
            </h1>
            <p className="text-[15px] mt-4 text-[#4a5568] leading-relaxed max-w-xl mx-auto">
              {firstName ? (
                <>Fill in a few plain facts — starting with what you do. When you&apos;re
                done, it goes on the board and lenders compete for your business. It&apos;s
                public and open on purpose — that&apos;s what gets you the best deal, and
                keeps everything above board.</>
              ) : (
                <>No forms to dread, no documents to dig up. Share a few plain facts —
                starting with what you do — and lenders reach out to earn your
                business. If one needs more, they&apos;ll ask you directly, and you
                decide what to share.</>
              )}
            </p>
            {!invite && (
              <Link href="/buyers" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold text-[#1349d4] hover:underline">
                See who&apos;s already looking →
              </Link>
            )}
          </div>

          {/* wait until we've checked for an invite so we don't flash the
              agent questions then hide them */}
          {checked && <StatePosition agentPrefill={invite} />}

          {/* stated-only, buyer-controlled — quietly */}
          <p className="mt-8 text-center text-xs text-[#8a93a4] max-w-md mx-auto flex items-center justify-center gap-1.5">
            <MaterialIcon icon="lock" className="text-[14px]" />
            No credit pull, no bank login, nothing to verify. You share only what
            you choose — and you get a link that&apos;s yours to send wherever you like.
          </p>
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}
