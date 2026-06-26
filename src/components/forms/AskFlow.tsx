'use client';

// ── AskFlow — the comprehension engine ────────────────────────────────
//
// TurboTax for the offer. ASKS one question at a time in bus-stop language;
// makes it nearly impossible to NOT understand. The buyer authors their own
// offer. Signing becomes the residue of understanding, not ass-covering.
// See memory/project_comprehension_engine_offer.
//
// Rules enforced here:
//  · ONE question per screen.
//  · NO JARGON WITHOUT A SPONSOR — sponsored terms are underlined; tap reveals
//    the playground explanation + a real-numbers example inline.
//  · Every string is an i18n key → works in any language (toggle in-header).
//  · OT is present on every step (ask-about-this hook).

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { AskFlow as AskFlowSpec, AskStep, Term } from '@/lib/forms/askSpec';
import { t, hasKey, LANGS, type Lang } from '@/lib/forms/i18n';

const PANEL = 'rounded-2xl p-6 md:p-8 relative overflow-hidden';
const PANEL_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(19,73,212,0.10)',
  boxShadow: '0 16px 40px -26px rgba(20,50,120,0.5)',
};

export default function AskFlow({ flow }: { flow: AskFlowSpec }) {
  const [lang, setLang] = useState<Lang>('en');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Flatten sections → a single ordered list of steps, respecting showWhen.
  // The section `intro` rides on the section's FIRST step so the engine can
  // surface the framing (e.g. the ownership posture) when you enter it.
  const steps = useMemo(() => {
    const all: { step: AskStep; sectionTitle: string; sectionIntro?: string }[] = [];
    for (const section of flow.sections) {
      section.steps.forEach((step, i) => {
        all.push({ step, sectionTitle: section.title, sectionIntro: i === 0 ? section.intro : undefined });
      });
    }
    return all;
  }, [flow]);

  // visible steps given current answers (showWhen gating)
  const visible = steps.filter(({ step }) => !step.showWhen || step.showWhen(answers));
  const [idx, setIdx] = useState(0);
  const clampedIdx = Math.min(idx, Math.max(0, visible.length - 1));
  const current = visible[clampedIdx];

  const setAnswer = (id: string, v: string) => setAnswers((p) => ({ ...p, [id]: v }));
  const canAdvance = (() => {
    if (!current) return false;
    const { step } = current;
    if (step.kind === 'derived' || step.kind === 'confirm') return true;
    return !!answers[step.id]?.trim();
  })();

  return (
    <div className="space-y-6">
      {/* header: masthead + language toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
            {t(flow.eyebrow, lang)}
          </div>
          <h1 className="font-headline text-2xl md:text-3xl font-extrabold mt-1.5 text-[#0c1322]">
            {t(flow.title, lang)}
          </h1>
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {/* progress rail — one tick per visible step */}
      <div className="flex items-center gap-1.5">
        {visible.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === clampedIdx ? 26 : 12,
              background: i <= clampedIdx ? '#1349d4' : 'rgba(19,73,212,0.16)',
            }}
          />
        ))}
      </div>

      {/* section framing (e.g. the ownership posture) — only on entry */}
      {current?.sectionIntro && hasKey(current.sectionIntro) && (
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(160deg, rgba(19,73,212,0.08), rgba(18,45,141,0.05))', border: '1px solid rgba(19,73,212,0.18)' }}>
          <p className="text-sm md:text-[15px] leading-relaxed font-medium text-[#1a2c52]">
            {t(current.sectionIntro, lang)}
          </p>
        </div>
      )}

      {/* the one question */}
      {current && (
        <QuestionCard
          key={current.step.id}
          step={current.step}
          lang={lang}
          value={answers[current.step.id] ?? ''}
          answers={answers}
          onChange={(v) => setAnswer(current.step.id, v)}
        />
      )}

      {/* nav */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={clampedIdx === 0}
          className="px-4 py-2.5 rounded-full text-sm font-semibold text-[#6b7689] disabled:opacity-30"
        >
          ← {t('ui.back', lang)}
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(visible.length - 1, i + 1))}
          disabled={!canAdvance || clampedIdx >= visible.length - 1}
          className="px-6 py-2.5 rounded-full text-sm font-bold transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(160deg, #1349d4, #122d8d)',
            color: '#fff',
            boxShadow: canAdvance ? '0 10px 24px -10px rgba(19,73,212,0.7)' : 'none',
          }}
        >
          {t('ui.continue', lang)} →
        </button>
      </div>
    </div>
  );
}

// ── One question on screen ────────────────────────────────────────────
function QuestionCard({
  step, lang, value, answers, onChange,
}: {
  step: AskStep; lang: Lang; value: string;
  answers: Record<string, string>; onChange: (v: string) => void;
}) {
  return (
    <div className={PANEL} style={PANEL_STYLE}>
      <h2 className="font-headline text-xl md:text-2xl font-bold text-[#0c1322] leading-snug">
        <Sponsored text={t(step.question, lang)} terms={step.terms} lang={lang} />
      </h2>

      {hasKey(step.help) && (
        <p className="text-sm md:text-base mt-3 leading-relaxed text-[#4a5568]">
          {t(step.help!, lang)}
        </p>
      )}

      {hasKey(step.example) && (
        <div className="mt-4 rounded-xl p-3.5 text-sm" style={{ background: 'rgba(27,158,106,0.07)', border: '1px solid rgba(27,158,106,0.22)', color: '#1b7a55' }}>
          <MaterialIcon icon="lightbulb" className="text-[14px] mr-1.5 align-middle" />
          {t(step.example!, lang)}
        </div>
      )}

      {/* a SETTLED FACT reflected from the buyer's ready crew — a plan they
          already own, not a question. Backup quietly stands by. */}
      {hasKey(step.fact) && (
        <div className="mt-4 rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(19,73,212,0.06)', border: '1px solid rgba(19,73,212,0.22)' }}>
          <MaterialIcon icon="verified" className="text-[20px] mt-0.5" />
          <div>
            <div className="font-bold text-[#0c1322]">{t(step.fact!, lang)}</div>
            {hasKey(step.factSource) && (
              <div className="text-xs mt-0.5 font-semibold text-[#1349d4] uppercase tracking-wide">
                {t(step.factSource!, lang)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <AnswerControl step={step} lang={lang} value={value} answers={answers} onChange={onChange} />
      </div>

      {/* OT — always one tap away, every step */}
      <button
        className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1349d4] hover:underline"
        onClick={() => window.dispatchEvent(new CustomEvent('plot:summon-ot', { detail: { topic: step.id } }))}
      >
        <MaterialIcon icon="auto_awesome" className="text-[14px]" />
        {t('ui.askOt', lang)}
      </button>
    </div>
  );
}

// ── The answer control, by kind ───────────────────────────────────────
function AnswerControl({
  step, lang, value, answers, onChange,
}: {
  step: AskStep; lang: Lang; value: string;
  answers: Record<string, string>; onChange: (v: string) => void;
}) {
  const inputCls =
    'w-full px-4 py-3 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)] text-[#0c1322]';
  const inputStyle: React.CSSProperties = { background: '#fff', border: '1px solid rgba(19,73,212,0.18)' };

  switch (step.kind) {
    case 'choice':
      return (
        <div className="grid gap-2.5">
          {(step.choices ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className="text-left rounded-xl px-4 py-3.5 transition-all"
              style={{
                background: value === c.id ? 'linear-gradient(160deg,#1349d41f,#1349d40a)' : '#fff',
                border: `1px solid ${value === c.id ? 'rgba(19,73,212,0.5)' : 'rgba(19,73,212,0.14)'}`,
              }}
            >
              <div className="font-semibold text-[#0c1322]">{t(c.label, lang)}</div>
              {hasKey(c.note) && <div className="text-xs mt-0.5 text-[#6b7689]">{t(c.note!, lang)}</div>}
            </button>
          ))}
        </div>
      );
    case 'yesno':
      return (
        <div className="flex gap-3">
          {['yes', 'no'].map((v) => (
            <button
              key={v}
              onClick={() => onChange(v)}
              className="flex-1 py-3 rounded-xl font-bold capitalize transition-all"
              style={{
                background: value === v ? 'linear-gradient(160deg,#1349d4,#122d8d)' : '#fff',
                color: value === v ? '#fff' : '#0c1322',
                border: '1px solid rgba(19,73,212,0.18)',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      );
    case 'confirm':
      return (
        <button
          onClick={() => onChange('confirmed')}
          className="w-full py-3.5 rounded-xl font-bold transition-all"
          style={{
            background: value === 'confirmed' ? 'linear-gradient(160deg,#1b9e6a,#15885a)' : '#fff',
            color: value === 'confirmed' ? '#fff' : '#1b7a55',
            border: '1px solid rgba(27,158,106,0.4)',
          }}
        >
          {value === 'confirmed' ? '✓ ' : ''}{t('ui.understand', lang)}
        </button>
      );
    case 'derived':
      return <DerivedValue step={step} lang={lang} answers={answers} />; // answers reserved for derivation
    case 'money':
    case 'number':
    case 'months':
    default:
      return (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={step.kind === 'money' || step.kind === 'number' || step.kind === 'months' ? 'decimal' : undefined}
          placeholder={hasKey(step.placeholder) ? t(step.placeholder!, lang) : undefined}
          className={inputCls}
          style={inputStyle}
          autoFocus
        />
      );
  }
}

// ── Derived value (computed, shown, never entered) ────────────────────
// Real money math lands here as the spec grows; placeholder for now so the
// engine renders. The monthly-first derivation (monthly+term → price) wires
// in when we author the money section together.
function DerivedValue({ step, lang }: { step: AskStep; lang: Lang; answers: Record<string, string> }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(19,73,212,0.05)', border: '1px solid rgba(19,73,212,0.18)' }}>
      <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#1349d4]">
        {step.derive ?? 'result'}
      </p>
      <p className="text-sm mt-1.5 text-[#4a5568]">
        {t('ui.whatsThis', lang)} — derivation wires in with the money section.
      </p>
    </div>
  );
}

// ── Sponsored text: underline jargon, reveal plain explanation on tap ──
function Sponsored({ text, terms, lang }: { text: string; terms?: Term[]; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!terms || terms.length === 0) return <>{text}</>;

  // Split the text on each sponsored word (case-insensitive, first match each).
  const words = terms.map((tm) => ({ tm, w: t(tm.word, lang) })).filter((x) => x.w);
  let nodes: (string | JSX.Element)[] = [text];
  words.forEach(({ tm, w }, ti) => {
    const next: (string | JSX.Element)[] = [];
    nodes.forEach((node, ni) => {
      if (typeof node !== 'string') { next.push(node); return; }
      const i = node.toLowerCase().indexOf(w.toLowerCase());
      if (i === -1) { next.push(node); return; }
      next.push(node.slice(0, i));
      const key = `${ti}-${ni}`;
      next.push(
        <button
          key={key}
          onClick={() => setOpen(open === tm.word ? null : tm.word)}
          className="underline decoration-dotted decoration-2 underline-offset-4 text-[#1349d4] font-bold"
          style={{ textDecorationColor: 'rgba(19,73,212,0.5)' }}
        >
          {node.slice(i, i + w.length)}
        </button>,
      );
      next.push(node.slice(i + w.length));
    });
    nodes = next;
  });

  const openTerm = terms.find((tm) => tm.word === open);
  return (
    <>
      {nodes}
      {openTerm && (
        <span className="block mt-3 rounded-xl p-3.5 text-sm font-normal leading-relaxed"
          style={{ background: 'rgba(243,177,63,0.10)', border: '1px solid rgba(243,177,63,0.35)', color: '#8a5a06' }}>
          <span className="font-bold">{t('ui.whatsThis', lang)} </span>
          {t(openTerm.plain, lang)}
          {hasKey(openTerm.example) && (
            <span className="block mt-1.5 text-[13px] opacity-90">{t(openTerm.example!, lang)}</span>
          )}
        </span>
      )}
    </>
  );
}

// ── Language toggle ───────────────────────────────────────────────────
function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full p-1 shrink-0" style={{ background: 'rgba(19,73,212,0.06)', border: '1px solid rgba(19,73,212,0.12)' }}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
          style={{
            background: lang === l.code ? '#fff' : 'transparent',
            color: lang === l.code ? '#1349d4' : '#6b7689',
            boxShadow: lang === l.code ? '0 2px 8px -4px rgba(20,50,120,0.5)' : 'none',
          }}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}
