'use client';

// ── IntakeChat — Claude at the front door ─────────────────────────────
//
// ONE page (Greg's locked mockup, 2026-07-08): headline + trust row up top,
// then the chat and the position card SIDE BY SIDE from second zero — the
// card filling in as you talk is the "not a lead form" proof. No intro page,
// no mode hop. "How does this work?" is a chip that fires INTO the chat —
// the demo is the product. The talk itself is the survey: every aside (kids,
// pets, why now) lands in notes and the stored transcript.
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
  name?: string; contact?: string; notes?: string; status?: string;
}

const OPENER =
  "Hey — I'm the PlotMaps intake. No forms here. Just tell me where you'd " +
  "seriously consider moving, what the property would need, and what would " +
  "make the move work. I'll turn it into a request and check for real matches.";

const STARTERS = ['Near a Navy base', '2+ acres', 'Lower payment', 'How does this work?'];

export default function IntakeChat({ onSteps }: { onSteps: () => void }) {
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

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
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
            ex.notes ? `notes: ${ex.notes}` : null,
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
  const destLine = (ex.destinations ?? []).map((d) => d.label).join(' · ');

  return (
    <div className="mrq mrq--wide mrq-onepage">
      {/* ── the pitch, one breath ── */}
      <span className="mrq-badge"><MaterialIcon icon="hub" className="text-[14px]" /> Real Estate Interconnector</span>
      <h1 className="mrq-h1">Post a move request.<br />Let the map check for real connections.</h1>
      <p className="mrq-sub">
        Talk to our AI like you would a person. Share where you&apos;d move, what you
        need, and what would make it work — PlotMaps turns that into a structured
        request and checks for real matches, not just listings.
      </p>
      <div className="mrq-trust">
        <div className="mrq-trust__c">
          <MaterialIcon icon="do_not_touch" className="text-[20px]" />
          <b>Not a lead form</b>
          <span>Your info stays private. We never sell or share it.</span>
        </div>
        <div className="mrq-trust__c">
          <MaterialIcon icon="lock" className="text-[20px]" />
          <b>Private at first</b>
          <span>You control what becomes visible.</span>
        </div>
        <div className="mrq-trust__c">
          <MaterialIcon icon="verified_user" className="text-[20px]" />
          <b>Verified before public</b>
          <span>A property only appears after authorization is confirmed.</span>
        </div>
      </div>

      {/* ── the conversation + the position card, side by side ── */}
      <div className="mrq-chatgrid">
        <div className="mrq-card mrq-chatcard">
          <div className="mrq-chathead">
            <span className="mrq-chathead__icon"><MaterialIcon icon="forum" className="text-[20px]" /></span>
            <span className="mrq-chathead__t">
              <b>PlotMaps Intake</b>
              <span>Your AI move partner</span>
            </span>
          </div>
          <div className="mrq-chatlog" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`mrq-msg ${m.role === 'user' ? 'is-user' : ''}`}>{m.text}</div>
            ))}
            {sending && <div className="mrq-msg is-typing"><span /><span /><span /></div>}
          </div>
          <div className="mrq-chatchips">
            {STARTERS.map((s) => (
              <button key={s} className="mrq-chip" disabled={sending} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
          <div className="mrq-chatrow">
            <input
              ref={inputRef}
              className="mrq-input"
              placeholder="Say it like you'd say it"
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={sending}
            />
            <button className="mrq-btn mrq-btn--primary" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">
              <MaterialIcon icon="arrow_upward" className="text-[17px]" />
            </button>
          </div>
          <p className="mrq-chatfoot">
            <MaterialIcon icon="lock" className="text-[12px]" /> Private by default. Only you decide what gets shared.
            <button className="mrq-chatfoot__steps" onClick={onSteps}>Prefer a form? Use the steps →</button>
          </p>
        </div>

        {/* the live position card — the trust artifact */}
        <aside className="mrq-side">
          <div className="mrq-live mrq-live--rows">
            <div className="mrq-live__h">
              <MaterialIcon icon="description" className="text-[15px]" /> Your move request
              <em className="mrq-live__pill"><MaterialIcon icon="lock" className="text-[11px]" /> Private Draft</em>
            </div>
            <div className="mrq-liverow"><span><MaterialIcon icon="location_on" className="text-[15px]" /> To</span><b>{destLine || '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="landscape" className="text-[15px]" /> Needs</span><b>{needsBits.length ? needsBits.join(', ') : '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="payments" className="text-[15px]" /> Payment</span><b>{ex.targetMonthly ? `~$${Number(ex.targetMonthly).toLocaleString()} / mo` : '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="schedule" className="text-[15px]" /> Timing</span><b>{ex.timing || '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="home" className="text-[15px]" /> From</span><b>{ex.fromLabel || '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="work" className="text-[15px]" /> Work</span><b>{ex.occupation || '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="house" className="text-[15px]" /> Property involved</span><b>{ex.ownership === 'own' ? 'Yes — verify later' : ex.ownership ? 'No' : '—'}</b></div>
            <div className="mrq-liverow"><span><MaterialIcon icon="lock" className="text-[15px]" /> Visibility</span><b>Private draft</b></div>
            {ex.moveCondition && (
              <div className="mrq-livequote"><MaterialIcon icon="format_quote" className="text-[14px]" /> {ex.moveCondition}</div>
            )}
          </div>
          <button className="mrq-btn mrq-btn--primary mrq-postbtn" onClick={post} disabled={!canPost || posting}>
            {posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[16px]" />
          </button>
          <p className="mrq-help">
            <MaterialIcon icon="info" className="text-[13px]" /> The card fills in as you
            talk — once there&apos;s a destination, you can post.
          </p>
        </aside>
      </div>
    </div>
  );
}
