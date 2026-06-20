'use client';

// ── RpaFlow — the Purchase Offer as a negotiation instrument ──────────
//
// Plot's OWN offer flow (authored from scratch, not CAR's RPA). Built from
// docs/rpa-teardown.md. The mechanic: capture the agent's OBJECTIVE first,
// then for every money field distinguish REQUIRED (the enforceable
// backbone) from VOLUNTEERED (a card that sends a message), and coach —
// in plain playground language — what each choice gives away.
//
// v1 = the opener (objective) + page-1 money section with the
// required/volunteered coaching. The remaining pages get wired as the
// teardown continues.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

type Objective = 'win-certainty' | 'keep-room' | null;

const PANEL =
  'rounded-2xl p-5 md:p-6 relative overflow-hidden';
const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(34,44,68,0.92), rgba(13,20,36,0.96))',
  border: '1px solid rgba(125,168,255,0.16)',
  boxShadow:
    '0 18px 40px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,210,255,0.14)',
};

export default function RpaFlow() {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<Objective>(null);

  return (
    <div className="space-y-6">
      {/* title */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.4em] text-[rgba(0,242,255,0.7)] font-bold">
          Purchase Offer · the negotiation
        </div>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-white mt-1.5 [text-shadow:0_2px_24px_rgba(0,242,255,0.18)]">
          Let&apos;s build your offer.
        </h1>
        <p className="text-sm text-[rgba(200,215,255,0.65)] mt-2">
          This isn&apos;t a form. Every line is a card. We&apos;ll show you
          which ones to play.
        </p>
      </div>

      {/* progress dots */}
      <div className="flex items-center gap-2">
        {['Objective', 'The money', 'Next pages'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? 28 : 16,
                background: i <= step ? '#00f2ff' : 'rgba(125,168,255,0.25)',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── STEP 0 — objective first ── */}
      {step === 0 && (
        <div className={PANEL} style={PANEL_STYLE}>
          <h2 className="font-headline text-xl font-bold text-white">
            First — what are you trying to win here?
          </h2>
          <p className="text-sm text-[rgba(200,215,255,0.7)] mt-2 leading-relaxed">
            Before a single number goes down, decide your goal. The{' '}
            <span className="text-white font-semibold">same</span> finances get
            presented differently depending on what you want. This choice
            quietly shapes every disclosure ahead.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <ObjectiveCard
              active={objective === 'win-certainty'}
              onClick={() => setObjective('win-certainty')}
              icon="verified"
              title="Win on certainty"
              body="Beat other offers. Show strength, signal you'll close, make the seller feel safe picking you."
              accent="#5ed6a8"
            />
            <ObjectiveCard
              active={objective === 'keep-room'}
              onClick={() => setObjective('keep-room')}
              icon="open_in_full"
              title="Keep your room"
              body="Leave space to renegotiate after inspection and don't invite a higher counter. Show only what forms the contract."
              accent="#fbc64f"
            />
          </div>

          <div className="flex justify-end mt-6">
            <NextButton
              disabled={!objective}
              onClick={() => setStep(1)}
              label="Build the money →"
            />
          </div>
        </div>
      )}

      {/* ── STEP 1 — the money, required vs volunteered ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className={PANEL} style={PANEL_STYLE}>
            <div className="flex items-start gap-3">
              <MaterialIcon
                icon={objective === 'win-certainty' ? 'verified' : 'open_in_full'}
                className="text-[22px] mt-0.5"
              />
              <div>
                <h2 className="font-headline text-xl font-bold text-white">
                  The money — and what it tells them
                </h2>
                <p className="text-sm text-[rgba(200,215,255,0.7)] mt-1.5 leading-relaxed">
                  {objective === 'win-certainty'
                    ? "You're going for certainty — so we'll let you show strength on purpose. But you still choose each card."
                    : "You're keeping your room — so we'll fill only what makes the contract real, and flag every extra that sends a message."}
                </p>
              </div>
            </div>
          </div>

          {/* Required — the backbone */}
          <FieldGroup
            kind="required"
            heading="Required — this is what makes the offer real"
            note="No law makes you say more than this. Price, how you're paying, and the bar that lets you walk."
          >
            <FieldRow label="Purchase price" placeholder="$429,000" />
            <FieldRow label="Cash or financed?" placeholder="Financed — conventional" />
            <FieldRow
              label="Close of escrow"
              placeholder="30 days after acceptance"
            />
          </FieldGroup>

          {/* Volunteered — the cards */}
          <FieldGroup
            kind="volunteered"
            heading="Optional — these are cards. Play them on purpose."
            note="None of these are required by law. Each one tells the other side something. We'll tell you what."
          >
            <CardField
              label="Loan rate ceiling ('not to exceed __%')"
              tell="Tells their agent how tight your loan qualification is. A low cap reads as 'stretched.'"
              recommend={objective === 'win-certainty'}
            />
            <CardField
              label="Exact cash-to-close / reserves"
              tell={
                objective === 'win-certainty'
                  ? 'A big number says "I\'m strong, you can count on me." That helps you here.'
                  : 'A big number invites them to push you on repairs; a thin one says "squeeze me." Either way it\'s a message.'
              }
              recommend={objective === 'win-certainty'}
            />
            <CardField
              label="Points / rate-buydown detail"
              tell="Extra granularity about your financing. Rarely helps you; mostly just shows your hand."
              recommend={false}
            />
          </FieldGroup>

          <div className="flex justify-between items-center">
            <BackButton onClick={() => setStep(0)} />
            <NextButton
              onClick={() => setStep(2)}
              label="Continue the teardown →"
            />
          </div>
        </div>
      )}

      {/* ── STEP 2 — placeholder for the rest ── */}
      {step === 2 && (
        <div className={PANEL} style={PANEL_STYLE}>
          <h2 className="font-headline text-xl font-bold text-white">
            More pages, same lens.
          </h2>
          <p className="text-sm text-[rgba(200,215,255,0.7)] mt-2 leading-relaxed">
            Next we tear down the contingencies — inspection, loan, appraisal —
            where the real outs live. Every one is an exit you keep or hand
            over. We&apos;ll build those the same way: your objective, then the
            cards, in plain English.
          </p>
          <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.2)' }}>
            <p className="text-xs text-[rgba(0,242,255,0.85)] uppercase tracking-[0.2em] font-bold">
              In progress
            </p>
            <p className="text-sm text-[rgba(200,215,255,0.7)] mt-1.5">
              Page 1 is wired. We continue page by page from the teardown — then
              e-signature wraps the whole instrument.
            </p>
          </div>
          <div className="flex justify-start mt-6">
            <BackButton onClick={() => setStep(1)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectiveCard({
  active,
  onClick,
  icon,
  title,
  body,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-4 transition-all duration-200"
      style={{
        background: active
          ? `linear-gradient(160deg, ${accent}26, ${accent}10)`
          : 'rgba(11,16,32,0.6)',
        border: `1px solid ${active ? accent + '88' : 'rgba(125,168,255,0.18)'}`,
        boxShadow: active ? `0 0 24px -8px ${accent}99` : 'none',
      }}
    >
      <span style={{ color: accent }}>
        <MaterialIcon icon={icon} className="text-[22px]" />
      </span>
      <div className="font-bold text-white mt-2">{title}</div>
      <div className="text-xs text-[rgba(200,215,255,0.65)] mt-1 leading-snug">
        {body}
      </div>
    </button>
  );
}

function FieldGroup({
  kind,
  heading,
  note,
  children,
}: {
  kind: 'required' | 'volunteered';
  heading: string;
  note: string;
  children: React.ReactNode;
}) {
  const tint = kind === 'required' ? '#5ed6a8' : '#fbc64f';
  return (
    <div className={PANEL} style={PANEL_STYLE}>
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: `${tint}1f`,
            border: `1px solid ${tint}55`,
            color: tint,
          }}
        >
          {kind === 'required' ? 'Backbone' : 'Your cards'}
        </span>
        <h3 className="text-sm font-bold text-white">{heading}</h3>
      </div>
      <p className="text-xs text-[rgba(200,215,255,0.55)] mt-1.5 mb-4 leading-snug">
        {note}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">
        {label}
      </label>
      <input
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-[rgba(180,200,255,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,242,255,0.3)]"
        style={{
          background: 'rgba(11,16,32,0.7)',
          border: '1px solid rgba(125,168,255,0.22)',
        }}
      />
    </div>
  );
}

function CardField({
  label,
  tell,
  recommend,
}: {
  label: string;
  tell: string;
  recommend: boolean;
}) {
  const [show, setShow] = useState(recommend);
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: 'rgba(11,16,32,0.5)',
        border: '1px solid rgba(125,168,255,0.14)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-[rgba(255,210,140,0.85)] mt-1 leading-snug">
            <MaterialIcon icon="info" className="text-[12px] mr-1 align-middle" />
            {tell}
          </div>
        </div>
        <button
          onClick={() => setShow((s) => !s)}
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors"
          style={{
            background: show ? 'rgba(0,242,255,0.15)' : 'rgba(125,168,255,0.08)',
            border: `1px solid ${show ? 'rgba(0,242,255,0.45)' : 'rgba(125,168,255,0.2)'}`,
            color: show ? '#00f2ff' : 'rgba(180,200,255,0.7)',
          }}
        >
          {show ? 'Showing' : 'Hidden'}
        </button>
      </div>
      {recommend && (
        <div className="text-[10px] text-[rgba(94,214,168,0.9)] uppercase tracking-wider font-bold mt-2">
          Recommended for your objective
        </div>
      )}
    </div>
  );
}

function NextButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-2.5 rounded-full text-sm font-bold transition-all disabled:opacity-40"
      style={{
        background: 'linear-gradient(160deg, #00d8e6, #0095c9)',
        color: '#04121a',
        boxShadow: disabled ? 'none' : '0 8px 24px -8px rgba(0,242,255,0.6)',
      }}
    >
      {label}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 rounded-full text-sm font-semibold text-[rgba(180,200,255,0.7)] hover:text-white transition-colors"
    >
      ← Back
    </button>
  );
}
