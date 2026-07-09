'use client';

// ── HaveProperty — "what you have," the constraint envelope ───────────
//
// The property door of the seller intake (memory/project_two_doors_to_qualify).
// The person states their current place, then EITHER uploads their mortgage
// statement (AI vision reads the four facts → /api/statement-read) OR types
// them straight in — "the best, no-BS way" (Greg 2026-07-08). From those
// facts, computeEnvelope derives the whole shape (equity, remaining term,
// payment ceiling) live, with pure math. memory/the_thesis (the HAVE side).

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import { computeEnvelope, type Envelope } from '@/lib/finance/envelope';

export interface HaveData {
  address: string | null;
  value: number | null;
  owed: number | null;
  ratePct: number | null;
  monthlyPI: number | null;
  loanType: string | null;
  assumable: boolean;
  openToCarry: boolean;
  openToTrade: boolean;
  envelope: Envelope | null;
}

const EMPTY: HaveData = {
  address: null, value: null, owed: null, ratePct: null, monthlyPI: null,
  loanType: null, assumable: false, openToCarry: false, openToTrade: false, envelope: null,
};

const num = (s: string): number | null => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export default function HaveProperty({
  value,
  onChange,
}: {
  value: HaveData | null;
  onChange: (d: HaveData) => void;
}) {
  const d = value ?? EMPTY;
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [readOk, setReadOk] = useState(false);

  // Recompute the envelope on every field change and push the whole object up.
  const update = (patch: Partial<HaveData>) => {
    const next = { ...d, ...patch };
    next.envelope = computeEnvelope({
      value: next.value, owed: next.owed, ratePct: next.ratePct,
      monthlyPI: next.monthlyPI, loanType: next.loanType, assumable: next.assumable,
    });
    onChange(next);
  };

  const onFile = async (file: File) => {
    setReading(true); setReadErr(null); setReadOk(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/statement-read', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { setReadErr(j.error || 'Could not read that — type it in below.'); return; }
      const f = j.facts as Record<string, number | string | undefined>;
      update({
        owed: typeof f.owed === 'number' ? f.owed : d.owed,
        ratePct: typeof f.ratePct === 'number' ? f.ratePct : d.ratePct,
        monthlyPI: typeof f.monthlyPI === 'number' ? f.monthlyPI : d.monthlyPI,
        loanType: typeof f.loanType === 'string' ? f.loanType : d.loanType,
        assumable: f.loanType === 'VA' || f.loanType === 'FHA' || d.assumable,
        address: typeof f.propertyAddress === 'string' ? f.propertyAddress : d.address,
      });
      setReadOk(true);
    } catch {
      setReadErr('Could not read that — type it in below.');
    } finally {
      setReading(false);
    }
  };

  const env = d.envelope;

  return (
    <div className="sp-card">
      <h2 className="sp-q">What do you have now?</h2>
      <p className="sp-help">This is the key to matching you within your payment or better. Give your address, then upload your mortgage statement (we read it for you) or just type the numbers — whatever&apos;s easier.</p>

      <div className="sp-answer">
        <div className="mrq-flabel">Your current property</div>
        <ProspectSearch compact placeholder="Your home address"
          onSelect={({ address }) => update({ address })} />
        {d.address && <div className="mrq-picked"><MaterialIcon icon="home" className="text-[15px]" /> {d.address}</div>}

        {/* upload the statement — AI reads it */}
        <div className="hp-upload">
          <label className="hp-drop">
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} hidden />
            {reading ? (
              <><span className="hp-spin" /> Reading your statement…</>
            ) : readOk ? (
              <><MaterialIcon icon="check_circle" className="text-[18px]" /> Read it — confirm the numbers below</>
            ) : (
              <><MaterialIcon icon="upload_file" className="text-[18px]" /> Upload mortgage statement (PDF, PNG, JPG)</>
            )}
          </label>
          {readErr && <p className="hp-err">{readErr}</p>}
          <span className="hp-or">or type it in</span>
        </div>

        {/* the four facts — typed or confirmed from the read */}
        <div className="hp-grid">
          <label><span>Home value</span>
            <input className="sp-input" inputMode="numeric" placeholder="$415,000"
              defaultValue={d.value ?? ''} onChange={(e) => update({ value: num(e.target.value) })} /></label>
          <label><span>Amount owed</span>
            <input className="sp-input" inputMode="numeric" placeholder="$145,000"
              value={d.owed ?? ''} onChange={(e) => update({ owed: num(e.target.value) })} /></label>
          <label><span>Interest rate</span>
            <input className="sp-input" inputMode="decimal" placeholder="3.25%"
              value={d.ratePct ?? ''} onChange={(e) => update({ ratePct: num(e.target.value) })} /></label>
          <label><span>Monthly payment (P&amp;I)</span>
            <input className="sp-input" inputMode="numeric" placeholder="$1,100"
              value={d.monthlyPI ?? ''} onChange={(e) => update({ monthlyPI: num(e.target.value) })} /></label>
        </div>

        <div className="hp-toggles">
          <label className="hp-check"><input type="checkbox" checked={d.assumable} onChange={(e) => update({ assumable: e.target.checked })} /> Assumable loan (VA / FHA)</label>
          <label className="hp-check"><input type="checkbox" checked={d.openToCarry} onChange={(e) => update({ openToCarry: e.target.checked })} /> Open to seller financing</label>
          <label className="hp-check"><input type="checkbox" checked={d.openToTrade} onChange={(e) => update({ openToTrade: e.target.checked })} /> Open to a trade</label>
        </div>

        {/* the ENVELOPE, computed live */}
        {env && (env.equity != null || env.glideNote) && (
          <div className="hp-env">
            <div className="hp-env__h"><MaterialIcon icon="shield" className="text-[16px]" /> Your envelope — what we&apos;ll keep you within</div>
            <div className="hp-env__rows">
              {env.equity != null && <div><span>Equity</span><b>${env.equity.toLocaleString()}</b></div>}
              {env.remainingYears != null && <div><span>Years left</span><b>~{env.remainingYears}</b></div>}
              {env.paymentCeiling != null && <div><span>Payment ceiling</span><b>${env.paymentCeiling.toLocaleString()}/mo</b></div>}
              {env.ltvPct != null && <div><span>Loan-to-value</span><b>{env.ltvPct}%</b></div>}
              {env.assumableLever && <div><span>Assumable</span><b>Yes — a match lever</b></div>}
            </div>
            <p className="hp-env__note">We&apos;ll rank matches by how they land against this: within it, a little over, or a better deal — with seller-carry and loan assumption as levers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
