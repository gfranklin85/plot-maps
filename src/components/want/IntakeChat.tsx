'use client';

// ── IntakeChat — Claude at the front door ─────────────────────────────
//
// The conversational intake ("Just tell me"): instead of the 7-step form,
// the person TALKS. The intake asks resolving follow-ups, answers "how does
// this work?" inline, and the live position card fills as it listens — the
// same trust artifact the wizard builds, watching your want take shape.
// Confirm & Post fires the same /api/move-request as the wizard.
// memory/the_thesis: THE INTAKE IS A CONVERSATION.

import { useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface ChatMsg { role: 'user' | 'assistant'; text: string }
interface Dest { label: string; lat?: number; lng?: number; family?: boolean }
interface Extracted {
  destinations?: Dest[];
  fromLabel?: string; fromLat?: number; fromLng?: number;
  occupation?: string; industry?: string;
  populationAnchor?: string; ownership?: string;
  acresMin?: number; bedsMin?: number;
  targetMonthly?: number; downPayment?: number; maxPrice?: number;
  financingType?: string; timing?: string;
  amenities?: string[]; moveCondition?: string;
  name?: string; contact?: string; status?: string;
}

const OPENER = "Hey — I'm the PlotMaps intake. No forms here; just tell me where you'd love to end up, and what would make the move worth it. You can also just ask me how this whole thing works.";

export default function IntakeChat({ onBack }: { onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'assistant', text: OPENER }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ex, setEx] = useState<Extracted>({});
  const [posting, setPosting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const d = await res.json();
      if (d.conversationId) setConversationId(d.conversationId);
      if (d.extracted) setEx(d.extracted as Extracted);
      setMsgs((m) => [...m, { role: 'assistant', text: d.reply || d.error || 'Hmm — say that again?' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Lost you for a second — try that again.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Confirm & Post → the SAME endpoint the wizard uses, then link the
  // conversation to the want (store it all, retrieve it all).
  const canPost = (ex.destinations?.length ?? 0) > 0;
  const post = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      const dests = ex.destinations ?? [];
      const primary = dests[0];
      const res = await fetch('/api/move-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toLabel: primary.label,
          toLat: primary.lat ?? null,
          toLng: primary.lng ?? null,
          toFuzzy: primary.lat == null,
          destinations: dests.slice(1),
          fromLabel: ex.fromLabel ?? null,
          fromLat: ex.fromLat ?? null,
          fromLng: ex.fromLng ?? null,
          occupation: ex.occupation ?? null,
          industry: ex.industry ?? null,
          populationAnchor: ex.populationAnchor ?? null,
          acresMin: ex.acresMin ?? null,
          bedsMin: ex.bedsMin ?? null,
          amenities: ex.amenities ?? [],
          targetMonthly: ex.targetMonthly ?? null,
          downPayment: ex.downPayment ?? null,
          maxPrice: ex.maxPrice ?? null,
          financingType: ex.financingType ?? null,
          timing: ex.timing ?? null,
          hasCurrentHome: ex.ownership === 'own',
          openToSellerCarry: ex.financingType === 'Seller financing',
          moveCondition: ex.moveCondition ?? null,
          name: ex.name ?? null,
          contact: ex.contact ?? null,
          criteriaNotes: [
            ex.ownership ? `ownership: ${ex.ownership}` : null,
            dests.some((d) => d.family)
              ? `family in: ${dests.filter((d) => d.family).map((d) => d.label).join(', ')}`
              : null,
            'source: conversational intake',
          ].filter(Boolean).join('; '),
        }),
      });
      const d = await res.json();
      if (d.id) {
        setPostedId(d.id);
        try { window.localStorage.setItem('plotmaps.moveRequestId', d.id); } catch { /* private mode */ }
        if (conversationId) {
          fetch('/api/intake', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId, wantId: d.id }),
          }).catch(() => {});
        }
      }
    } finally {
      setPosting(false);
    }
  };

  if (postedId) {
    return (
      <div className="mrq">
        <span className="mrq-badge is-green"><MaterialIcon icon="check_circle" className="text-[14px]" /> Move request posted</span>
        <h1 className="mrq-h1">Your position is on the map.</h1>
        <p className="mrq-sub">
          Saved as a <b>private draft</b> — structured for matching, visible only to
          you until you choose otherwise. We&apos;ll go find your property.
        </p>
        <div className="mrq-ctarow">
          <a className="mrq-btn mrq-btn--primary" href={`/my-request?id=${postedId}`}>
            Open My Move Request <MaterialIcon icon="arrow_forward" className="text-[17px]" />
          </a>
          <a className="mrq-btn" href="/connections">See the connection board</a>
        </div>
      </div>
    );
  }

  const needsBits: string[] = [];
  if (ex.acresMin) needsBits.push(`${ex.acresMin}+ acres`);
  if (ex.bedsMin) needsBits.push(`${ex.bedsMin}+ bd`);
  for (const a of (ex.amenities ?? []).slice(0, 3)) needsBits.push(a.replace(/-/g, ' '));

  return (
    <div className="mrq mrq--wide">
      <div className="mrq-cols mrq-cols--chat">
        <div className="mrq-main">
          <div className="mrq-card mrq-chatcard">
            <div className="mrq-chathead">
              <button className="mrq-chatback" onClick={onBack} aria-label="Back">
                <MaterialIcon icon="arrow_back" className="text-[17px]" />
              </button>
              <span className="mrq-badge"><MaterialIcon icon="forum" className="text-[14px]" /> Just tell us</span>
            </div>
            <div className="mrq-chatlog" ref={scrollRef}>
              {msgs.map((m, i) => (
                <div key={i} className={`mrq-msg ${m.role === 'user' ? 'is-user' : ''}`}>{m.text}</div>
              ))}
              {sending && <div className="mrq-msg is-typing"><span /><span /><span /></div>}
            </div>
            <div className="mrq-chatrow">
              <input
                ref={inputRef}
                className="mrq-input"
                placeholder="Say it like you'd say it to a person…"
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                disabled={sending}
              />
              <button className="mrq-btn mrq-btn--primary" onClick={send} disabled={sending || !input.trim()}>
                <MaterialIcon icon="send" className="text-[17px]" />
              </button>
            </div>
          </div>
        </div>

        {/* the live position card — the trust artifact: watch your want take
            shape as you talk */}
        <aside className="mrq-side">
          <div className="mrq-live">
            <div className="mrq-live__h">
              <MaterialIcon icon="description" className="text-[15px]" /> Your move request
              <em className="mrq-live__pill"><MaterialIcon icon="lock" className="text-[11px]" /> Private Draft</em>
            </div>
            <div className="mrq-live__row">
              <MaterialIcon icon="location_on" className="text-[14px]" />
              To: {(ex.destinations ?? []).map((d) => d.label).join(' · ') || '—'}
            </div>
            <div className="mrq-live__row">
              <MaterialIcon icon="landscape" className="text-[14px]" />
              Needs: {needsBits.length ? needsBits.join(' · ') : '—'}
            </div>
            {ex.fromLabel && <div className="mrq-live__row"><MaterialIcon icon="home" className="text-[14px]" /> From: {ex.fromLabel}</div>}
            {ex.occupation && <div className="mrq-live__row"><MaterialIcon icon="work" className="text-[14px]" /> Work: {ex.occupation}</div>}
            {ex.targetMonthly && <div className="mrq-live__row"><MaterialIcon icon="payments" className="text-[14px]" /> ~${Number(ex.targetMonthly).toLocaleString()}/mo</div>}
            {ex.timing && <div className="mrq-live__row"><MaterialIcon icon="schedule" className="text-[14px]" /> Timing: {ex.timing}</div>}
            {ex.moveCondition && <div className="mrq-live__row"><MaterialIcon icon="format_quote" className="text-[14px]" /> {ex.moveCondition}</div>}
            <div className="mrq-live__row"><MaterialIcon icon="lock" className="text-[14px]" /> Visibility: Private draft</div>
          </div>
          <button className="mrq-btn mrq-btn--primary mrq-postbtn" onClick={post} disabled={!canPost || posting}>
            {posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[17px]" />
          </button>
          {!canPost && <p className="mrq-help" style={{ marginTop: 8 }}>The card fills in as you talk — once there&apos;s a destination, you can post.</p>}
        </aside>
      </div>
    </div>
  );
}
