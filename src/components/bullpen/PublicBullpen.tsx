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
import BuyerEmblem from './BuyerEmblem';
import type { BullpenPost, BullpenOffer } from '@/lib/bullpen/types';
import {
  WORKSHEET, LOAN_HEADER, totalMonthly, totalClosing, cashToClose,
  type WLine, type WorksheetValues,
} from '@/lib/bullpen/worksheet';

const NEED_LABEL: Record<string, string> = {
  lender: 'Lender', inspector: 'Inspector', insurance: 'Insurance',
  contractor: 'Contractor', escrow: 'Escrow', title: 'Title', agent: 'Agent',
};

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
              {/* the buyer's position — emblem + occupation is the hero */}
              <div className="pb-hero">
                <div className="pb-hero__top">
                  <BuyerEmblem occupation={post.occupation} size={64} />
                  <div>
                    <div className="pb-hero__eyebrow">A home buyer’s position</div>
                    <h1 className="pb-hero__name">
                      {post.headline
                        ? post.headline
                        : `${post.buyerName ? post.buyerName : 'A serious buyer'} is looking for the right team.`}
                    </h1>
                  </div>
                </div>
                <div className="pb-occ">
                  <MaterialIcon icon="badge" className="text-[20px]" />
                  <span>{post.occupation}{post.city ? ` · ${post.city}` : ''}</span>
                </div>
                {post.profileNote && <p className="pb-profilenote">“{post.profileNote}”</p>}
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

              {/* the crew they're assembling */}
              {post.needs && post.needs.length > 0 && (
                <div className="pb-needs">
                  <span className="pb-needs__label">Looking for</span>
                  {post.needs.map((n) => (
                    <span key={n} className={`pb-needchip ${n === 'lender' ? 'is-live' : ''}`}>
                      {NEED_LABEL[n] || n}{n !== 'lender' && <em> · soon</em>}
                    </span>
                  ))}
                </div>
              )}

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
                        {o.totalMonthly ? <span>{money(o.totalMonthly)}/mo</span> : (o.monthlyPI != null && <span>{money(o.monthlyPI)}/mo</span>)}
                        {o.aprPct != null && <span>{fmtRate(o.aprPct)}% APR</span>}
                        {o.cashToClose ? <span>{money(o.cashToClose)} to close</span> : null}
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

  // Live totals as the lender types — the honest picture, summed the way the
  // real worksheet sums it.
  const monthly = totalMonthly(f);
  const closing = totalClosing(f);
  const cash = cashToClose(f);

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
          originatorName: f.originatorName,
          originatorPhone: f.originatorPhone,
          note: f.note,
          worksheet: f, // the full line-item blob
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

  const nmlsValid = /^\d{3,10}$/.test((f.lenderNmls || '').replace(/\D/g, ''));

  return (
    <div className="pb-form">
      {/* who you are — NMLS is the bar (licensed = in) */}
      <div className="pb-form__section">
        <div className="pb-form__sectitle">You (the lender)</div>
        <div className="pb-form__row">
          <Field label="Company / lender name *" v={f.lenderName} onChange={(v) => set('lenderName', v)} placeholder="American Pacific Mtg" />
          <Field label="NMLS # * (licensed = welcome)" v={f.lenderNmls} onChange={(v) => set('lenderNmls', v)} placeholder="229752" />
        </div>
        <div className="pb-form__row">
          <Field label="Originator name" v={f.originatorName} onChange={(v) => set('originatorName', v)} placeholder="Dustin Maciel" />
          <Field label="Phone" v={f.originatorPhone} onChange={(v) => set('originatorPhone', v)} placeholder="559-589-6044" />
          <Field label="Email" v={f.lenderEmail} onChange={(v) => set('lenderEmail', v)} placeholder="you@lender.com" />
        </div>
      </div>

      {/* the loan */}
      <WSectionFields title="The loan" lines={LOAN_HEADER} f={f} set={set} />

      {/* every worksheet section */}
      {WORKSHEET.map((s) => (
        <WSectionFields key={s.id} title={s.title} lines={s.lines} f={f} set={set} />
      ))}

      {/* a line for the buyer */}
      <div className="pb-form__section">
        <Field label="A line for the buyer (optional)" v={f.note} onChange={(v) => set('note', v)} placeholder="No points, a credit toward closing — what you see is what you pay." />
      </div>

      {/* live totals */}
      <div className="pb-totals">
        <Total k="Monthly payment" v={monthly} />
        <Total k="Total closing costs" v={closing} />
        <Total k="Cash to close" v={cash} strong />
      </div>

      {err && <p className="pb-form__err">{err}</p>}
      <button className="pb-form__submit" onClick={post} disabled={busy || !f.lenderName?.trim() || !nmlsValid}>
        {busy ? 'Posting…' : 'Post my worksheet'}
      </button>
      <p className="pb-form__fine">A valid NMLS ID is required — that’s the only bar. Every licensed lender is welcome; none is favored. The buyer sees your full worksheet and decides. Plot doesn’t rank.</p>
    </div>
  );
}

function WSectionFields({ title, lines, f, set }: {
  title: string; lines: WLine[]; f: WorksheetValues; set: (k: string, v: string) => void;
}) {
  return (
    <div className="pb-form__section">
      <div className="pb-form__sectitle">{title}</div>
      <div className="pb-form__grid">
        {lines.map((l) => (
          <Field
            key={l.id}
            label={l.kind === 'pct' ? `${l.label} (%)` : l.label}
            v={f[l.id]}
            onChange={(v) => set(l.id, v)}
            placeholder={l.hint}
            num={l.kind !== 'text'}
          />
        ))}
      </div>
    </div>
  );
}

function Total({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className={`pb-total ${strong ? 'is-strong' : ''}`}>
      <span>{k}</span>
      <b>{money(v)}</b>
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
