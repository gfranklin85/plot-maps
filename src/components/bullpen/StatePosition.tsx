'use client';

// StatePosition — the buyer states their position, one question at a time.
// Stated-only (no verification, no sensitive data → no regulation). Occupation
// + location is the HERO signal (a Corcoran CO / NAS Lemoore LT is self-
// qualifying to any local lender). Everything else is optional depth. Trust
// comes from the agent-vouch + the market (first offer), not from Plot.
// See memory/project_buyer_financial_capture + project_position_job_posting_architecture.

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

type Kind = 'text' | 'choice' | 'money' | 'optional-upload';

interface Step {
  id: string;
  q: string;
  help?: string;
  kind: Kind;
  placeholder?: string;
  choices?: { id: string; label: string; note?: string }[];
  optional?: boolean;
  showWhen?: (a: Record<string, string>) => boolean;
}

// The flow — occupation-hero, light basics, optional depth, optional proof.
const STEPS: Step[] = [
  // ── the hero signal ──
  {
    id: 'occupation',
    q: 'What do you do, and where?',
    help: 'This is the one that matters most. A lender who knows your area can read your line and already know you’re real — “Correctional Officer, Corcoran” or “LT at NAS Lemoore” tells them plenty.',
    kind: 'text',
    placeholder: 'e.g. Correctional Officer, Corcoran · LT at NAS Lemoore · Nurse, Adventist Health',
  },
  {
    id: 'military',
    q: 'Are you military?',
    help: 'If you are, we’ll factor your housing allowance (BAH) — it’s real income lenders count.',
    kind: 'choice',
    choices: [
      { id: 'active', label: 'Yes — active duty', note: 'Branch, rank + base help lenders read your pay.' },
      { id: 'veteran', label: 'Veteran', note: 'You may have VA loan options.' },
      { id: 'no', label: 'No' },
    ],
  },
  {
    id: 'military_detail',
    q: 'Branch, rank, and base?',
    help: 'e.g. “Navy, LT, NAS Lemoore.” This alone tells a lender your pay grade and BAH.',
    kind: 'text',
    placeholder: 'Navy · LT · NAS Lemoore',
    showWhen: (a) => a.military === 'active' || a.military === 'veteran',
  },

  // ── the light basics: what you're after ──
  {
    id: 'price',
    q: 'What are you looking to spend on a home?',
    help: 'A range is fine — you’re not locked in.',
    kind: 'text',
    placeholder: '$380,000 – $420,000',
  },
  {
    id: 'down',
    q: 'How much do you have for a down payment?',
    help: 'A dollar amount or a percent — whatever you know.',
    kind: 'text',
    placeholder: '$80,000 · or 20%',
  },
  {
    id: 'loanType',
    q: 'What kind of loan are you thinking?',
    kind: 'choice',
    choices: [
      { id: 'conventional', label: 'Conventional', note: 'The most common.' },
      { id: 'fha', label: 'FHA', note: 'Lower down, a few extra rules.' },
      { id: 'va', label: 'VA', note: 'For those who served.' },
      { id: 'unsure', label: 'Not sure yet', note: 'Lenders can walk you through it.' },
    ],
  },
  {
    id: 'timeline',
    q: 'When are you hoping to buy?',
    kind: 'choice',
    choices: [
      { id: 'now', label: 'Ready now — the next month or two' },
      { id: 'soon', label: 'Soon — the next few months' },
      { id: 'exploring', label: 'Exploring — getting my footing first' },
    ],
  },

  // ── optional depth (the more you share, the more they can bring you) ──
  {
    id: 'income',
    q: 'What’s your income? (optional)',
    help: 'Skip it if you like — your work line already says a lot. Sharing it just lets a lender be more precise.',
    kind: 'text',
    placeholder: '$95,000 / year',
    optional: true,
  },
  {
    id: 'debts',
    q: 'Any monthly debts? (optional)',
    help: 'Car payment, cards, student loans — the rough total. It helps a lender picture your budget. Skip if you’d rather not.',
    kind: 'text',
    placeholder: '$650 / month',
    optional: true,
  },
  {
    id: 'credit',
    q: 'Roughly where’s your credit? (optional)',
    help: 'A ballpark is plenty — no pull, no check. Just your own read.',
    kind: 'choice',
    optional: true,
    choices: [
      { id: '760', label: '760+' },
      { id: '720', label: '720 – 759' },
      { id: '680', label: '680 – 719' },
      { id: 'below', label: 'Under 680' },
      { id: 'unsure', label: 'Not sure' },
    ],
  },

  // ── optional role-proof (the speed bump for the aimless) ──
  {
    id: 'proof',
    q: 'Want to show you’re the real deal? (optional)',
    help: 'Totally optional. Drop a work email, a badge, a LinkedIn — anything that says “yep, that’s me.” It just tells lenders you’re serious. Skip it and your work line still speaks for itself.',
    kind: 'optional-upload',
    optional: true,
  },
];

export default function StatePosition() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  const visible = useMemo(() => STEPS.filter((s) => !s.showWhen || s.showWhen(answers)), [answers]);
  const clamped = Math.min(idx, visible.length - 1);
  const step = visible[clamped];
  const set = (id: string, v: string) => setAnswers((p) => ({ ...p, [id]: v }));

  const canNext = step?.optional || step?.kind === 'optional-upload' || !!answers[step?.id ?? '']?.trim();
  const isLast = clamped >= visible.length - 1;

  if (done) {
    return (
      <div className="sp">
        <div className="sp-done">
          <MaterialIcon icon="verified" className="text-[40px]" />
          <h2>Your position is posted.</h2>
          <p>
            Lenders can now see what you shared and reach out to earn your business.
            If one wants more to firm up your numbers, they&apos;ll ask you directly —
            and you decide what to share. The moment one puts out a real estimate,
            your profile shows you&apos;re a serious buyer, and more come compete.
          </p>
          <a href="/compare" className="sp-cta">See offers as they come in →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="sp">
      {/* progress */}
      <div className="sp-progress">
        {visible.map((_, i) => (
          <span key={i} className="sp-tick" style={{ width: i === clamped ? 26 : 12, background: i <= clamped ? '#1349d4' : 'rgba(19,73,212,0.16)' }} />
        ))}
      </div>

      <div className="sp-card">
        <h2 className="sp-q">
          {step.q}
          {step.optional && <span className="sp-optional"> · optional</span>}
        </h2>
        {step.help && <p className="sp-help">{step.help}</p>}

        <div className="sp-answer">
          {step.kind === 'text' && (
            <input
              value={answers[step.id] ?? ''}
              onChange={(e) => set(step.id, e.target.value)}
              placeholder={step.placeholder}
              className="sp-input"
              autoFocus
            />
          )}
          {step.kind === 'choice' && (
            <div className="sp-choices">
              {step.choices!.map((c) => (
                <button
                  key={c.id}
                  onClick={() => set(step.id, c.id)}
                  className={`sp-choice ${answers[step.id] === c.id ? 'is-active' : ''}`}
                >
                  <span className="sp-choice__label">{c.label}</span>
                  {c.note && <span className="sp-choice__note">{c.note}</span>}
                </button>
              ))}
            </div>
          )}
          {step.kind === 'optional-upload' && (
            <input
              value={answers[step.id] ?? ''}
              onChange={(e) => set(step.id, e.target.value)}
              placeholder="Work email, LinkedIn, or a note — anything (optional)"
              className="sp-input"
            />
          )}
        </div>

        <div className="sp-nav">
          <button className="sp-back" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={clamped === 0}>
            ← Back
          </button>
          <button
            className="sp-next"
            disabled={!canNext}
            onClick={() => { if (isLast) setDone(true); else setIdx((i) => i + 1); }}
          >
            {isLast ? 'Post my position' : (step.optional ? 'Skip / Continue' : 'Continue')} →
          </button>
        </div>
      </div>
    </div>
  );
}
