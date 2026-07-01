'use client';

// StatePosition — the buyer states their position, one question at a time.
// Stated-only (no verification, no sensitive data → no regulation). Occupation
// + location is the HERO signal (a Corcoran CO / NAS Lemoore LT is self-
// qualifying to any local lender). Everything else is optional depth. Trust
// comes from the agent-vouch + the market (first offer), not from Plot.
// See memory/project_buyer_financial_capture + project_position_job_posting_architecture.

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ShareBullpen from './ShareBullpen';
import type { AgentInvite } from '@/lib/bullpen/invite';

type Kind = 'text' | 'choice' | 'money' | 'optional-upload' | 'multi';

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
  // ── who you are (first name — humanizes the link, never load-bearing) ──
  {
    id: 'buyerName',
    q: 'First, what’s your name?',
    help: 'Just a first name is perfect. It’s what people will see when your link gets shared — “help Maria get her home.”',
    kind: 'text',
    placeholder: 'Maria',
  },
  // ── the hero signal ──
  {
    id: 'occupation',
    q: 'What do you do, and where?',
    help: 'This is the one that matters most. A lender who knows your area can read your line and already know you’re real — “Correctional Officer, Corcoran” or “LT at NAS Lemoore” tells them plenty.',
    kind: 'text',
    placeholder: 'e.g. Correctional Officer, Corcoran · LT at NAS Lemoore · Nurse, Adventist Health',
  },
  {
    id: 'city',
    q: 'What area are you buying in?',
    help: 'The city or area. This is how the right local lenders — the ones who serve your market — find you on the board.',
    kind: 'text',
    placeholder: 'Lemoore, CA · Hanford · Kings County',
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
    id: 'headline',
    q: 'In your words — what are you looking for?',
    help: 'One plain line. This is what lenders see first on the board. Say it like you’d say it to a friend.',
    kind: 'text',
    placeholder: 'Looking for a 3bd in Lemoore, move-in by fall',
    optional: true,
  },
  {
    id: 'price',
    q: 'What are you looking to spend on a home?',
    help: 'A range is fine — you’re not locked in.',
    kind: 'text',
    placeholder: '$380,000 – $420,000',
  },
  {
    id: 'monthly',
    q: 'A monthly payment you’d be comfortable with? (optional)',
    help: 'Roughly what you’d want your house payment to be. It helps lenders bring you options that actually fit.',
    kind: 'text',
    placeholder: '~$2,200/mo',
    optional: true,
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

  // ── the crew you need (buyer assembles a competing team) ──
  {
    id: 'needs',
    q: 'Who do you want to come compete for you?',
    help: 'Pick everyone you’ll need. Each one competes for your business — you choose who to work with. (Lenders are live now; the rest are joining.)',
    kind: 'multi',
    choices: [
      { id: 'lender', label: 'Lender', note: 'Your loan + rate' },
      { id: 'inspector', label: 'Inspector', note: 'Checks the home' },
      { id: 'insurance', label: 'Insurance', note: 'Homeowner’s policy' },
      { id: 'contractor', label: 'Contractor', note: 'Repairs / work' },
      { id: 'escrow', label: 'Escrow / Title', note: 'Closes the deal' },
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

  // ── your agent (their info rides IN the post — it carries the vouch) ──
  {
    id: 'hasAgent',
    q: 'Are you working with an agent?',
    help: 'If you are, their name goes on your link. When a lender sees a familiar agent behind it, they trust it’s real — and your agent can share it into their own circle of lenders.',
    kind: 'choice',
    choices: [
      { id: 'yes', label: 'Yes — I have an agent', note: 'We’ll add them to your link.' },
      { id: 'no', label: 'Not yet', note: 'No problem — you can share it yourself.' },
    ],
  },
  {
    id: 'agentName',
    q: 'What’s your agent’s name?',
    kind: 'text',
    placeholder: 'e.g. Greg Franklin',
    showWhen: (a) => a.hasAgent === 'yes',
  },
  {
    id: 'agentContact',
    q: 'Their email or phone? (optional)',
    help: 'So lenders and interested folks can reach your agent directly. Optional — a name alone is fine.',
    kind: 'text',
    placeholder: 'greg@position.realty · (559) 555-0134',
    optional: true,
    showWhen: (a) => a.hasAgent === 'yes',
  },

  // ── how you want to appear (your choice — visibility is the point) ──
  {
    id: 'displayMode',
    q: 'How do you want to show up on the board?',
    help: 'Your position is public either way — that’s how the market finds you. This is just whether your name shows, or only your work and area. Your contact details stay private no matter what.',
    kind: 'choice',
    choices: [
      { id: 'anonymous', label: 'Just my work and area', note: '“Correctional Officer, Corcoran” — no name shown.' },
      { id: 'named', label: 'Show my name', note: 'Be fully seen — some folks prefer it.' },
    ],
  },
  {
    id: 'profileNote',
    q: 'Anything you’d like them to know? (optional)',
    help: 'A line about you or your search — first-time buyer, growing family, relocating for work. Shows on your profile. Skip if you’d rather keep it simple.',
    kind: 'text',
    placeholder: 'First home for our growing family — ready when the right one comes.',
    optional: true,
    showWhen: (a) => a.displayMode === 'named',
  },
];

// Split "email or phone" into the two DB fields, and map the credit choice id
// to a readable band.
function agentEmailPhone(v?: string): { email: string | null; phone: string | null } {
  if (!v) return { email: null, phone: null };
  return v.includes('@') ? { email: v, phone: null } : { email: null, phone: v };
}

// The agent-invite steps we skip when a buyer arrived via an agent's link
// (the agent's info is already known from the invite).
const AGENT_STEP_IDS = new Set(['hasAgent', 'agentName', 'agentContact']);

export default function StatePosition({ agentPrefill }: { agentPrefill?: AgentInvite | null } = {}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When an agent invited this buyer, drop the agent questions — we already
  // have the agent from the invite. (memory/project_agent_branded_template)
  const steps = useMemo(
    () => (agentPrefill ? STEPS.filter((s) => !AGENT_STEP_IDS.has(s.id)) : STEPS),
    [agentPrefill],
  );
  const visible = useMemo(() => steps.filter((s) => !s.showWhen || s.showWhen(answers)), [steps, answers]);
  const clamped = Math.min(idx, visible.length - 1);
  const step = visible[clamped];
  const set = (id: string, v: string) => setAnswers((p) => ({ ...p, [id]: v }));

  const canNext =
    step?.optional ||
    step?.kind === 'optional-upload' ||
    (step?.kind === 'multi' ? !!answers[step.id]?.trim() : !!answers[step?.id ?? '']?.trim());
  const isLast = clamped >= visible.length - 1;

  // Toggle a value in a comma-joined multi-select answer.
  const toggleMulti = (id: string, val: string) => {
    setAnswers((p) => {
      const cur = (p[id] ? p[id].split(',') : []).filter(Boolean);
      const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
      return { ...p, [id]: next.join(',') };
    });
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    const { email, phone } = agentEmailPhone(answers.agentContact);
    const needs = (answers.needs ? answers.needs.split(',') : []).filter(Boolean);
    const payload = {
      buyerName: answers.buyerName || null,
      occupation: answers.occupation,
      city: answers.city || null,
      headline: answers.headline || null,
      monthly: answers.monthly || null,
      needs: needs.length ? needs : ['lender'],
      displayMode: answers.displayMode === 'named' ? 'named' : 'anonymous',
      profileNote: answers.displayMode === 'named' ? (answers.profileNote || null) : null,
      military: answers.military || null,
      militaryDetail: answers.military_detail || null,
      priceRange: answers.price || null,
      downPayment: answers.down || null,
      loanType: answers.loanType || null,
      timeline: answers.timeline || null,
      income: answers.income || null,
      debts: answers.debts || null,
      creditBand: answers.credit || null,
      proofNote: answers.proof || null,
      // Agent: from the invite when present (auto-attached), else what the
      // buyer answered themselves.
      agentName: agentPrefill ? agentPrefill.agentName : (answers.hasAgent === 'yes' ? (answers.agentName || null) : null),
      agentEmail: agentPrefill ? agentPrefill.agentEmail : (answers.hasAgent === 'yes' ? email : null),
      agentPhone: agentPrefill ? agentPrefill.agentPhone : (answers.hasAgent === 'yes' ? phone : null),
    };
    try {
      const res = await fetch('/api/bullpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.slug) throw new Error(data.error || 'Something went wrong');
      setSlug(data.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Posted → the share screen (the heart of the agent tool).
  if (slug) {
    return (
      <div className="sp">
        <ShareBullpen
          slug={slug}
          buyerName={answers.buyerName}
          hasAgent={!!agentPrefill || answers.hasAgent === 'yes'}
          agentName={agentPrefill?.agentName ?? (answers.hasAgent === 'yes' ? answers.agentName : undefined)}
        />
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
          {step.kind === 'multi' && (
            <div className="sp-choices">
              {step.choices!.map((c) => {
                const on = (answers[step.id]?.split(',') ?? []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleMulti(step.id, c.id)}
                    className={`sp-choice sp-choice--multi ${on ? 'is-active' : ''}`}
                  >
                    <span className="sp-choice__check">
                      <MaterialIcon icon={on ? 'check_box' : 'check_box_outline_blank'} className="text-[18px]" />
                    </span>
                    <span className="sp-choice__label">{c.label}</span>
                    {c.note && <span className="sp-choice__note">{c.note}</span>}
                  </button>
                );
              })}
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

        {error && <p className="sp-error"><MaterialIcon icon="error_outline" className="text-[16px]" /> {error}</p>}

        <div className="sp-nav">
          <button className="sp-back" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={clamped === 0 || submitting}>
            ← Back
          </button>
          <button
            className="sp-next"
            disabled={!canNext || submitting}
            onClick={() => { if (isLast) submit(); else setIdx((i) => i + 1); }}
          >
            {submitting
              ? 'Posting…'
              : `${isLast ? 'Post my position' : (step.optional ? 'Skip / Continue' : 'Continue')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
