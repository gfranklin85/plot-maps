'use client';

// ── FormFlow — the negotiation-instrument ENGINE ──────────────────────
//
// Renders ANY PlotFlow spec (lib/forms/flowSpec) into the proven flow:
//   objective-first opener → sections (REQUIRED backbone + VOLUNTEERED
//   cards with "what this tells them" coaching) → review & e-sign.
// One engine powers all five forms. The hand-built RpaFlow proved the
// pattern; this generalizes it so content lives in data, not code.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { PlotFlow, FlowSection, RequiredField } from '@/lib/forms/flowSpec';

const PANEL = 'rounded-2xl p-5 md:p-6 relative overflow-hidden';
const PANEL_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(19,73,212,0.10)',
  boxShadow: '0 12px 30px -22px rgba(20,50,120,0.4)',
};

export default function FormFlow({ flow }: { flow: PlotFlow }) {
  const hasObjective = !!(flow.objectives && flow.objectives.length);
  // step 0 = objective (if any); then one step per section; last = review.
  const sectionStart = hasObjective ? 1 : 0;
  const reviewStep = sectionStart + flow.sections.length;
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<string | null>(null);

  // Field/card values keyed by id (kept simple — strings + on/off).
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const labels = [
    ...(hasObjective ? ['Objective'] : []),
    ...flow.sections.map((s) => s.title),
    'Review & sign',
  ];

  const activeObjective = flow.objectives?.find((o) => o.key === objective);

  return (
    <div className="space-y-6">
      {/* title */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
          {flow.eyebrow}
        </div>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-1.5 text-[#0c1322]">
          {flow.title}
        </h1>
        <p className="text-sm mt-2 text-[#4a5568]">{flow.tagline}</p>
      </div>

      {/* progress dots */}
      <div className="flex items-center gap-2">
        {labels.map((label, i) => (
          <div
            key={label + i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 28 : 16,
              background: i <= step ? '#1349d4' : 'rgba(19,73,212,0.18)',
            }}
          />
        ))}
      </div>

      {/* ── OBJECTIVE step ── */}
      {hasObjective && step === 0 && (
        <div className={PANEL} style={PANEL_STYLE}>
          <h2 className="font-headline text-xl font-bold text-[#0c1322]">
            {flow.objectivePrompt?.heading ?? 'First — what are you trying to win here?'}
          </h2>
          {flow.objectivePrompt?.body && (
            <p className="text-sm mt-2 leading-relaxed text-[#4a5568]">
              {flow.objectivePrompt.body}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {flow.objectives!.map((o) => (
              <ObjectiveCard
                key={o.key}
                active={objective === o.key}
                onClick={() => setObjective(o.key)}
                icon={o.icon}
                title={o.title}
                body={o.body}
                accent={o.accent}
              />
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <NextButton disabled={!objective} onClick={() => setStep(sectionStart)} label="Continue →" />
          </div>
        </div>
      )}

      {/* ── SECTION steps ── */}
      {flow.sections.map((section, idx) => {
        const myStep = sectionStart + idx;
        if (step !== myStep) return null;
        return (
          <SectionView
            key={section.id}
            section={section}
            objectiveKey={objective}
            values={values}
            setValues={setValues}
            shown={shown}
            setShown={setShown}
            activeObjectiveIcon={activeObjective?.icon}
            onBack={idx === 0 ? (hasObjective ? () => setStep(0) : undefined) : () => setStep(myStep - 1)}
            onNext={() => setStep(myStep + 1)}
          />
        );
      })}

      {/* ── REVIEW & SIGN ── */}
      {step === reviewStep && (
        <div className={PANEL} style={PANEL_STYLE}>
          <h2 className="font-headline text-xl font-bold text-[#0c1322]">
            Review &amp; sign.
          </h2>
          <p className="text-sm mt-2 leading-relaxed text-[#4a5568]">
            {flow.reviewNote ??
              'Here’s the whole instrument in plain English. Read it once more — then e-sign and it’s done.'}
          </p>
          <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(19,73,212,0.05)', border: '1px solid rgba(19,73,212,0.18)' }}>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#1349d4]">Coming next</p>
            <p className="text-sm mt-1.5 text-[#4a5568]">
              The review summary + e-signature wrap the instrument. The flow
              above is fully wired from the spec.
            </p>
          </div>
          <div className="flex justify-start mt-6">
            <BackButton onClick={() => setStep(reviewStep - 1)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section renderer ──────────────────────────────────────────────────
function SectionView({
  section, objectiveKey, values, setValues, shown, setShown, activeObjectiveIcon, onBack, onNext,
}: {
  section: FlowSection;
  objectiveKey: string | null;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  shown: Record<string, boolean>;
  setShown: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeObjectiveIcon?: string;
  onBack?: () => void;
  onNext: () => void;
}) {
  const intro = (objectiveKey && section.introByObjective?.[objectiveKey]) || section.intro;
  return (
    <div className="space-y-4">
      {(section.title || intro) && (
        <div className={PANEL} style={PANEL_STYLE}>
          <div className="flex items-start gap-3">
            {activeObjectiveIcon && <MaterialIcon icon={activeObjectiveIcon} className="text-[22px] mt-0.5" />}
            <div>
              <h2 className="font-headline text-xl font-bold text-[#0c1322]">{section.title}</h2>
              {intro && <p className="text-sm mt-1.5 leading-relaxed text-[#4a5568]">{intro}</p>}
            </div>
          </div>
        </div>
      )}

      {section.required.length > 0 && (
        <FieldGroup
          kind="required"
          heading={section.requiredHeading ?? 'Required — this is what makes it real'}
          note={section.requiredNote ?? 'No law makes you say more than this.'}
        >
          {section.required.map((f) => (
            <FieldRow key={f.id} field={f} value={values[f.id] ?? ''} onChange={(v) => setValues((p) => ({ ...p, [f.id]: v }))} />
          ))}
        </FieldGroup>
      )}

      {section.volunteered.length > 0 && (
        <FieldGroup
          kind="volunteered"
          heading={section.volunteeredHeading ?? 'Optional — these are cards. Play them on purpose.'}
          note={section.volunteeredNote ?? 'None of these are required. Each one tells the other side something.'}
        >
          {section.volunteered.map((c) => {
            const recommended = !!(objectiveKey && c.recommendWhen?.includes(objectiveKey));
            const tell = (objectiveKey && c.tellByObjective?.[objectiveKey]) || c.tell || '';
            const isShown = shown[c.id] ?? recommended;
            return (
              <CardField
                key={c.id}
                label={c.label}
                tell={tell}
                recommended={recommended}
                shown={isShown}
                onToggle={() => setShown((p) => ({ ...p, [c.id]: !isShown }))}
              />
            );
          })}
        </FieldGroup>
      )}

      <div className="flex justify-between items-center">
        {onBack ? <BackButton onClick={onBack} /> : <span />}
        <NextButton onClick={onNext} label="Continue →" />
      </div>
    </div>
  );
}

// ── Sub-components (lifted from the proven RpaFlow) ───────────────────
function ObjectiveCard({ active, onClick, icon, title, body, accent }: {
  active: boolean; onClick: () => void; icon: string; title: string; body: string; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-4 transition-all duration-200"
      style={{
        background: active ? `linear-gradient(160deg, ${accent}1f, ${accent}0a)` : '#ffffff',
        border: `1px solid ${active ? accent + '88' : 'rgba(19,73,212,0.12)'}`,
        boxShadow: active ? `0 12px 26px -16px ${accent}` : '0 8px 20px -18px rgba(20,50,120,0.4)',
      }}
    >
      <span style={{ color: accent }}><MaterialIcon icon={icon} className="text-[22px]" /></span>
      <div className="font-bold mt-2 text-[#0c1322]">{title}</div>
      <div className="text-xs mt-1 leading-snug text-[#4a5568]">{body}</div>
    </button>
  );
}

function FieldGroup({ kind, heading, note, children }: {
  kind: 'required' | 'volunteered'; heading: string; note: string; children: React.ReactNode;
}) {
  const tint = kind === 'required' ? '#1b9e6a' : '#b8860b';
  return (
    <div className={PANEL} style={PANEL_STYLE}>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${tint}16`, border: `1px solid ${tint}40`, color: tint }}>
          {kind === 'required' ? 'Backbone' : 'Your cards'}
        </span>
        <h3 className="text-sm font-bold text-[#0c1322]">{heading}</h3>
      </div>
      <p className="text-xs mt-1.5 mb-4 leading-snug text-[#6b7689]">{note}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ field, value, onChange }: { field: RequiredField; value: string; onChange: (v: string) => void; }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#0c1322]">{field.label}</label>
      {field.help && <p className="text-[11px] text-[#7a8494] mt-0.5">{field.help}</p>}
      {field.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)] text-[#0c1322]"
          style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.18)' }}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined}
          className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm placeholder:text-[#aab2c0] focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)] text-[#0c1322]"
          style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.18)' }}
        />
      )}
    </div>
  );
}

function CardField({ label, tell, recommended, shown, onToggle }: {
  label: string; tell: string; recommended: boolean; shown: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'rgba(19,73,212,0.03)', border: '1px solid rgba(19,73,212,0.10)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#0c1322]">{label}</div>
          {tell && (
            <div className="text-xs mt-1 leading-snug text-[#b8860b]">
              <MaterialIcon icon="info" className="text-[12px] mr-1 align-middle" />
              {tell}
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors"
          style={{
            background: shown ? 'rgba(19,73,212,0.12)' : 'rgba(19,73,212,0.05)',
            border: `1px solid ${shown ? 'rgba(19,73,212,0.40)' : 'rgba(19,73,212,0.16)'}`,
            color: shown ? '#1349d4' : '#6b7689',
          }}
        >
          {shown ? 'Showing' : 'Hidden'}
        </button>
      </div>
      {recommended && (
        <div className="text-[10px] uppercase tracking-wider font-bold mt-2 text-[#1b9e6a]">
          Recommended for your objective
        </div>
      )}
    </div>
  );
}

function NextButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean; }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-5 py-2.5 rounded-full text-sm font-bold transition-all disabled:opacity-40"
      style={{ background: 'linear-gradient(160deg, #1349d4, #122d8d)', color: '#fff', boxShadow: disabled ? 'none' : '0 10px 24px -10px rgba(19,73,212,0.7)' }}>
      {label}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-4 py-2.5 rounded-full text-sm font-semibold transition-colors text-[#6b7689]">
      ← Back
    </button>
  );
}
