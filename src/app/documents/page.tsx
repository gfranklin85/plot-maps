'use client';

// ── /documents — the CLIENT's review-and-sign hub ─────────────────────
//
// The buyer's view of their transaction documents: a guided checklist, not a
// dense PDF pile. Each doc opens a clean plain-language walkthrough (built one
// by one at /forms/<slug>). This is the EXECUTION surface (sign + complete) —
// distinct from /forms (the agent's authoring library) and the Library/Learning
// pages (understand the instruments). memory: the_thesis (meet the person),
// the_facts (document platform, audience-aware).

import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { CLIENT_DOCS, CLIENT_DOC_STATUS } from '@/lib/forms/formCatalog';

export default function ClientDocumentsPage() {
  const total = CLIENT_DOCS.length;
  const done = CLIENT_DOCS.filter((d) => d.status === 'completed').length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="dsh min-h-screen">
      <div className="cdoc__wrap">
        {/* ── title band + progress ── */}
        <div className="cdoc__head">
          <div>
            <div className="dsh-intro__eyebrow">Your documents</div>
            <h1 className="cdoc__h">Documents to review and sign.</h1>
            <p className="cdoc__sub">
              Review each item in plain language, complete guided steps, and sign
              electronically when you&apos;re ready.
            </p>
          </div>
          <div className="cdoc__prog">
            <div className="cdoc__prog-top">
              <span className="cdoc__prog-count">{done} of {total} completed</span>
              <span className="cdoc__prog-pct">{pct}%</span>
            </div>
            <div className="cdoc__prog-bar"><span style={{ width: `${pct}%` }} /></div>
          </div>
        </div>

        <div className="cdoc__body">
          {/* ── the document list ── */}
          <div className="cdoc__list">
            {CLIENT_DOCS.map((d) => {
              const s = CLIENT_DOC_STATUS[d.status];
              const primary = d.status === 'ready-to-sign';
              return (
                <Link
                  key={d.slug}
                  href={`/documents/${d.slug}`}
                  className={`cdoc-row ${d.mostImportant ? 'is-important' : ''}`}
                >
                  <span className="cdoc-row__icon" style={{ background: s.bg, color: s.tint }}>
                    <MaterialIcon icon={d.icon} className="text-[20px]" />
                  </span>
                  <span className="cdoc-row__body">
                    <span className="cdoc-row__title">
                      {d.name}
                      {d.mostImportant && (
                        <span className="cdoc-row__star"><MaterialIcon icon="star" className="text-[14px]" /> Most important</span>
                      )}
                    </span>
                    <span className="cdoc-row__blurb">{d.blurb}</span>
                  </span>
                  <span className="cdoc-row__status" style={{ background: s.bg, color: s.tint }}>
                    {s.label}{d.status === 'completed' && <MaterialIcon icon="check" className="text-[13px]" />}
                  </span>
                  <span className={`cdoc-row__action ${primary ? 'is-primary' : ''}`}>{s.action}</span>
                  <MaterialIcon icon="chevron_right" className="cdoc-row__chev text-[18px]" />
                </Link>
              );
            })}
          </div>

          {/* ── right rail ── */}
          <aside className="cdoc__rail">
            {/* signing progress */}
            <div className="cdoc-card">
              <h2 className="cdoc-card__h">Your signing progress</h2>
              <ol className="cdoc-steps">
                {[
                  { t: 'Review', s: 'Read each document in plain language.', done: true },
                  { t: 'Answer guided prompts', s: "We'll ask a few simple questions.", done: true },
                  { t: 'Sign electronically', s: 'Sign securely in just a few clicks.', done: false },
                  { t: 'Submit', s: "We'll send everything to your agent.", done: false },
                ].map((step, i) => (
                  <li key={step.t} className={`cdoc-step ${step.done ? 'is-done' : ''}`}>
                    <span className="cdoc-step__dot">
                      {step.done ? <MaterialIcon icon="check" className="text-[13px]" /> : i + 1}
                    </span>
                    <span className="cdoc-step__body">
                      <span className="cdoc-step__t">{i + 1}. {step.t}</span>
                      <span className="cdoc-step__s">{step.s}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* how documents work */}
            <div className="cdoc-card">
              <h2 className="cdoc-card__h">How documents work here</h2>
              <div className="cdoc-how">
                <div className="cdoc-how__nav">
                  {['Introduction', 'Key terms', 'Your answers', 'Signature'].map((n, i) => (
                    <span key={n} className={i === 1 ? 'is-active' : ''}>{n}</span>
                  ))}
                </div>
                <div className="cdoc-how__preview">
                  <div className="cdoc-how__preview-h">Key terms in plain language</div>
                  <div className="cdoc-how__line" />
                  <div className="cdoc-how__line" style={{ width: '80%' }} />
                  <div className="cdoc-how__check"><MaterialIcon icon="check_box" className="text-[13px]" /></div>
                </div>
              </div>
              <p className="cdoc-how__note">
                Each document opens in a clean, guided walkthrough — not a dense PDF.
              </p>
              <span className="cdoc-how__link">See example walkthrough <MaterialIcon icon="open_in_new" className="text-[13px]" /></span>
            </div>

            {/* your agent */}
            <div className="cdoc-card">
              <h2 className="cdoc-card__h">Your agent</h2>
              <div className="cdoc-agent">
                <span className="cdoc-agent__avatar"><MaterialIcon icon="person" className="text-[22px]" /></span>
                <div>
                  <div className="cdoc-agent__name">Maria Hernandez</div>
                  <div className="cdoc-agent__firm">Horizon Real Estate</div>
                </div>
              </div>
              <div className="cdoc-agent__contact">
                <span><MaterialIcon icon="call" className="text-[14px]" /> (310) 555-0147</span>
                <span><MaterialIcon icon="mail" className="text-[14px]" /> maria@horizonre.com</span>
              </div>
              <button className="cdoc-agent__msg"><MaterialIcon icon="chat_bubble" className="text-[15px]" /> Message your agent</button>
            </div>
          </aside>
        </div>

        {/* ── security footer ── */}
        <div className="cdoc__secure">
          <span className="cdoc__secure-left">
            <MaterialIcon icon="verified_user" className="text-[18px]" />
            <span>
              <b>Your information is secure.</b><br />
              Documents are encrypted and stored safely.
            </span>
          </span>
          <span className="cdoc__secure-link">Learn more about eSign security <MaterialIcon icon="open_in_new" className="text-[13px]" /></span>
        </div>
      </div>
    </div>
  );
}
