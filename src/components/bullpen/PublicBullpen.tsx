'use client';

// PublicBullpen — the view a shared link opens (/b/<slug>).
//
// Anyone can land here: a lender the agent knows, the buyer's coworker, an
// aunt who wants to help. They see the buyer's STATED position (occupation
// first — the hero signal) and, if they're a lender, drop an offer right in.
// Offers accumulate on a neutral timeline; Plot never ranks. The existence of
// an offer becomes the trust signal for every lender after
// (memory/project_position_job_posting_architecture + project_buyer_financial_capture).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { BullpenPost, BullpenOffer } from '@/lib/bullpen/types';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const MILITARY_LABEL: Record<string, string> = {
  active: 'Active duty',
  veteran: 'Veteran',
};

export default function PublicBullpen({ slug }: { slug: string }) {
  const [post, setPost] = useState<BullpenPost | null>(null);
  const [offers, setOffers] = useState<BullpenOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/bullpen/${slug}`, { cache: 'no-store' });
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      setPost(data.post);
      setOffers(data.offers ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/bullpen" className="hover:text-[#1349d4] transition-colors">State your position</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          {loading && <div className="pb-loading">Loading this position…</div>}

          {notFound && !loading && (
            <div className="pb-missing">
              <MaterialIcon icon="search_off" className="text-[40px]" />
              <h1>This position isn’t here.</h1>
              <p>The link may be mistyped, or the buyer may have closed it. If someone sent you this, ask them for a fresh link.</p>
              <Link href="/bullpen" className="pb-cta">State your own position →</Link>
            </div>
          )}

          {post && !loading && (
            <>
              {/* the buyer's position — occupation is the hero */}
              <div className="pb-hero">
                <div className="pb-hero__eyebrow">A home buyer’s position</div>
                <h1 className="pb-hero__name">
                  {post.buyerName ? post.buyerName : 'A serious buyer'} is looking for the right lender.
                </h1>
                <div className="pb-occ">
                  <MaterialIcon icon="badge" className="text-[20px]" />
                  <span>{post.occupation}</span>
                </div>
                {post.agentName && (
                  <div className="pb-agent">
                    Represented by <b>{post.agentName}</b>
                    {(post.agentEmail || post.agentPhone) && (
                      <span className="pb-agent__contact">
                        {' · '}{post.agentEmail || post.agentPhone}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* the trust light — market-generated, no lender named */}
              {offers.length > 0 && (
                <div className="pb-trust">
                  <MaterialIcon icon="verified" className="text-[18px]" />
                  <span>
                    A licensed lender has already put a real offer on this buyer.
                    {offers.length > 1 ? ` ${offers.length} lenders are competing.` : ''}
                  </span>
                </div>
              )}

              {/* the stated facts */}
              <div className="pb-facts">
                {post.priceRange && <Fact k="Looking to spend" v={post.priceRange} />}
                {post.downPayment && <Fact k="Down payment" v={post.downPayment} />}
                {post.loanType && <Fact k="Loan type" v={loanLabel(post.loanType)} />}
                {post.timeline && <Fact k="Timeline" v={timelineLabel(post.timeline)} />}
                {post.military && MILITARY_LABEL[post.military] && (
                  <Fact k="Service" v={post.militaryDetail || MILITARY_LABEL[post.military]} />
                )}
                {post.income && <Fact k="Income (stated)" v={post.income} />}
                {post.creditBand && <Fact k="Credit (self-reported)" v={creditLabel(post.creditBand)} />}
              </div>

              {post.proofNote && (
                <p className="pb-proof">
                  <MaterialIcon icon="link" className="text-[15px]" />
                  Buyer offered: {post.proofNote}
                </p>
              )}

              {/* the lender call-to-action */}
              <div className="pb-lender">
                <div className="pb-lender__head">
                  <div>
                    <div className="pb-lender__title">Are you a lender?</div>
                    <div className="pb-lender__sub">Put your best offer in. The buyer compares every offer side by side and chooses — sorted however they like. No offer is featured or favored.</div>
                  </div>
                  {!showForm && (
                    <button className="pb-lender__open" onClick={() => setShowForm(true)}>
                      Make an offer
                    </button>
                  )}
                </div>

                {showForm && (
                  <OfferForm slug={slug} onPosted={() => { setShowForm(false); load(); }} />
                )}
              </div>

              {/* offers so far — neutral timeline (buyer does the sorting on /compare) */}
              {offers.length > 0 && (
                <div className="pb-offers">
                  <div className="pb-offers__title">Offers in, as they arrived</div>
                  {offers.map((o) => (
                    <div key={o.id} className="pb-offer">
                      <div className="pb-offer__top">
                        <span className="pb-offer__lender">{o.lenderName}</span>
                        {o.ratePct != null && <span className="pb-offer__rate">{fmtRate(o.ratePct)}%</span>}
                      </div>
                      <div className="pb-offer__line">
                        {o.monthlyPI != null && <span>{money(o.monthlyPI)}/mo</span>}
                        {o.aprPct != null && <span>{fmtRate(o.aprPct)}% APR</span>}
                        {o.estCost5yr != null && <span>{money(o.estCost5yr)} over 5 yrs</span>}
                      </div>
                      {o.note && <p className="pb-offer__note">“{o.note}”</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* everyone else: pass it along */}
              <p className="pb-pass">
                Not a lender? You can still help. Send this link to a great lender
                you know — or to anyone who might. Every share brings {post.buyerName || 'this buyer'} a better deal.
              </p>
            </>
          )}
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}

function OfferForm({ slug, onPosted }: { slug: string; onPosted: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function post() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/bullpen/${slug}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lenderName: f.lenderName,
          lenderEmail: f.lenderEmail,
          lenderNmls: f.lenderNmls,
          loanType: f.loanType,
          ratePct: f.ratePct,
          aprPct: f.aprPct,
          points: f.points,
          lenderFees: f.lenderFees,
          credit: f.credit,
          monthlyPI: f.monthlyPI,
          estCost5yr: f.estCost5yr,
          note: f.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not post');
      onPosted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post your offer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-form">
      <div className="pb-form__row">
        <Field label="Your name or company *" v={f.lenderName} onChange={(v) => set('lenderName', v)} placeholder="Valley First Lending" />
        <Field label="NMLS # (optional)" v={f.lenderNmls} onChange={(v) => set('lenderNmls', v)} placeholder="123456" />
      </div>
      <div className="pb-form__row">
        <Field label="Loan type" v={f.loanType} onChange={(v) => set('loanType', v)} placeholder="30-yr fixed conventional" />
        <Field label="Your email (optional)" v={f.lenderEmail} onChange={(v) => set('lenderEmail', v)} placeholder="you@lender.com" />
      </div>
      <div className="pb-form__row">
        <Field label="Rate %" v={f.ratePct} onChange={(v) => set('ratePct', v)} placeholder="6.25" num />
        <Field label="APR %" v={f.aprPct} onChange={(v) => set('aprPct', v)} placeholder="6.31" num />
        <Field label="Monthly (P&I)" v={f.monthlyPI} onChange={(v) => set('monthlyPI', v)} placeholder="1971" num />
      </div>
      <div className="pb-form__row">
        <Field label="Points" v={f.points} onChange={(v) => set('points', v)} placeholder="0" num />
        <Field label="Lender fees $" v={f.lenderFees} onChange={(v) => set('lenderFees', v)} placeholder="900" num />
        <Field label="Lender credit $" v={f.credit} onChange={(v) => set('credit', v)} placeholder="1500" num />
      </div>
      <div className="pb-form__row">
        <Field label="Est. 5-year cost $ (optional)" v={f.estCost5yr} onChange={(v) => set('estCost5yr', v)} placeholder="118760" num />
      </div>
      <Field label="A line for the buyer (optional)" v={f.note} onChange={(v) => set('note', v)} placeholder="No points, a credit toward closing — what you see is what you pay." />

      {err && <p className="pb-form__err">{err}</p>}
      <button className="pb-form__submit" onClick={post} disabled={busy || !f.lenderName?.trim()}>
        {busy ? 'Posting…' : 'Post my offer'}
      </button>
      <p className="pb-form__fine">Stated only — Plot doesn’t verify or rank offers. The buyer sees your name and your numbers, and decides.</p>
    </div>
  );
}

function Field({ label, v, onChange, placeholder, num }: {
  label: string; v?: string; onChange: (v: string) => void; placeholder?: string; num?: boolean;
}) {
  return (
    <label className="pb-field">
      <span className="pb-field__label">{label}</span>
      <input
        className="pb-field__input"
        value={v ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={num ? 'decimal' : undefined}
      />
    </label>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="pb-fact">
      <div className="pb-fact__k">{k}</div>
      <div className="pb-fact__v">{v}</div>
    </div>
  );
}

const fmtRate = (n: number) => n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
function loanLabel(v: string) {
  return { conventional: 'Conventional', fha: 'FHA', va: 'VA', unsure: 'Open to options' }[v] || v;
}
function timelineLabel(v: string) {
  return { now: 'Ready now (1–2 months)', soon: 'Soon (a few months)', exploring: 'Exploring' }[v] || v;
}
function creditLabel(v: string) {
  return { '760': '760+', '720': '720–759', '680': '680–719', below: 'Under 680', unsure: 'Not sure' }[v] || v;
}
