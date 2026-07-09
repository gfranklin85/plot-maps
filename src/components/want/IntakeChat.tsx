'use client';

// ── IntakeChat — Claude at the front door ─────────────────────────────
//
// The pure AI open (Greg, locked 2026-07-08): one question in the middle of
// an otherwise empty screen — time-of-day greeting, one big rounded input,
// a few rounded suggestions. NOTHING else until they start talking; then the
// conversation reads like a PAGE (plain text turns — no DM/phone bubbles),
// the input follows the conversation down, and the position card APPEARS
// underneath/beside only once there's real data to populate it. The talk is
// the survey; the card is the trust artifact.
// memory/the_thesis: THE INTAKE IS A CONVERSATION.

import { useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import USStateMap from '@/components/want/USStateMap';

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

// Worked examples of a COMPLETE ask (Greg 2026-07-08): a cold visitor doesn't
// know they're allowed to say this much, or in what shape. Show them. Each
// models a different real path — cash-down, take-over-payments, wide region
// vs. a specific home — and taps into the box as an editable starting draft.
// A marquee of these teaches the format by example, not by instruction.
const EXAMPLE_ASKS = [
  "I'd move to South Carolina — a city around 200k people with some tech industry. At least a half acre, could pay ~$1,500/mo, and put $200k down from selling my place.",
  "I've got a 1,900 sf home in Lemoore on a 7,500 sf lot near NAS and good schools. Owe about $150k — I'd let someone take over payments if I can get what I need on the other end.",
  "Nashville or Chattanooga, TN — 3+ bedrooms and a shop or some land, under $2,200/mo. I own here and can sell first or move fast, whichever helps.",
  "Pensacola or Jacksonville, FL — single story, no HOA, near a base. Around $350k, paying cash from the sale of my house.",
  "Boise area, remote worker. An acre or more for horses, up to $500k, and I'm open to seller financing or a trade.",
  "Norfolk / Virginia Beach — 4 bed near good schools, under $2,800/mo. Renting now, need to be in by summer, VA loan.",
];
// Short taps that still lead somewhere matchable — fill the box, don't send.
const QUICK_TAPS = ['I want acreage', 'Near a base', 'Cheaper than California'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning.' : h < 17 ? 'Afternoon.' : 'Evening.';
}

export default function IntakeChat({ onSteps }: { onSteps: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [ex, setEx] = useState<Extracted>({});
  const [posting, setPosting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [mapSel, setMapSel] = useState<{ abbr: string; name: string }[]>([]);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const toggleState = (s: { abbr: string; name: string }) =>
    setMapSel((cur) => (cur.some((x) => x.abbr === s.abbr) ? cur.filter((x) => x.abbr !== s.abbr) : [...cur, s]));

  // Tap an example / quick-word → drop it in the box, focus, cursor at end.
  // They can edit it or hit send — teaches the format without forcing a send.
  const fillBox = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (el) { el.focus(); el.setSelectionRange(text.length, text.length); }
    });
  };

  // Turn the free map clicks into the conversation's first message. A click
  // is the same signal as typing — the intake resolves it, then keeps going.
  const sendStates = () => {
    if (!mapSel.length || sending) return;
    const names = mapSel.map((s) => s.name);
    const list = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
    send(`I'd consider ${list}.`);
  };

  const talking = msgs.length > 0;

  useEffect(() => {
    if (talking) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, sending, talking]);

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
      boxRef.current?.focus();
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

  // The big rounded box — same component in both states.
  const box = (
    <div className="mrq-box">
      <textarea
        ref={boxRef}
        className="mrq-box__input"
        placeholder={talking ? 'Reply…' : 'e.g. “I own a 3-bed in Lemoore, owe ~$180k. Want Nashville area, 3+ acres, under $2,400/mo — could sell or trade.”'}
        rows={talking ? 1 : 2}
        maxLength={2000}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        disabled={sending}
        autoFocus
      />
      <button className="mrq-box__send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">
        <MaterialIcon icon="arrow_upward" className="text-[20px]" />
      </button>
    </div>
  );

  // ── FRESH — one question in the middle, nothing else ──
  if (!talking) {
    return (
      <div className="mrq-front">
        <h1 className="mrq-front__h">{greeting()} What&apos;s the move?</h1>
        <p className="mrq-front__lead">
          Tell me where you&apos;d go and what you&apos;ve got to work with — your place now,
          and what would make the move worth it. The more real you get, the better I
          can match you. Not sure how? Tap an example below to start from.
        </p>

        {/* worked examples — a marquee of COMPLETE asks that teach the format.
            Tap one to drop it in the box as an editable draft. */}
        <div className="mrq-marquee" aria-label="Example asks — tap one to start from">
          <div className="mrq-marquee__track">
            {[...EXAMPLE_ASKS, ...EXAMPLE_ASKS].map((ex, i) => (
              <button key={i} className="mrq-example" onClick={() => fillBox(ex)} tabIndex={i < EXAMPLE_ASKS.length ? 0 : -1}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {box}

        {/* short taps for the hesitant (fill the box, don't send) + map hint */}
        <div className="mrq-front__chips">
          {QUICK_TAPS.map((s) => (
            <button key={s} className="mrq-chip" onClick={() => fillBox(s + ' ')}>{s}</button>
          ))}
          <span className="mrq-front__ormap">or click the map ↓</span>
        </div>

        {/* the FREE structured "where" — click states, no AI token spent.
            Clicking one opens the conversation; the intake reacts to it. */}
        <div className="mrq-mapblock">
          <USStateMap selected={mapSel.map((s) => s.abbr)} onToggle={toggleState} />
          {mapSel.length > 0 && (
            <div className="mrq-mappills">
              {mapSel.map((s) => (
                <span key={s.abbr} className="mrq-dest">
                  <MaterialIcon icon="location_on" className="text-[13px]" /> {s.name}
                  <button aria-label={`Remove ${s.name}`} onClick={() => toggleState(s)}>
                    <MaterialIcon icon="close" className="text-[12px]" />
                  </button>
                </span>
              ))}
              <button className="mrq-btn mrq-btn--primary mrq-mapgo" onClick={sendStates} disabled={sending}>
                Start here <MaterialIcon icon="arrow_forward" className="text-[15px]" />
              </button>
            </div>
          )}
        </div>

        {/* the fine print, one quiet line at the very bottom */}
        <p className="mrq-front__trust">
          <MaterialIcon icon="lock" className="text-[13px]" />
          Private at first · Not a lead form · Free
          <button className="mrq-front__steps" onClick={onSteps}>Prefer a form?</button>
        </p>
      </div>
    );
  }

  // ── TALKING — the conversation as a page (no bubbles), the box following
  //    it down, and the position card appearing only once it has data ──
  const rows: { icon: string; label: string; value: string }[] = [];
  const destLine = (ex.destinations ?? []).map((d) => d.label).join(' · ');
  if (destLine) rows.push({ icon: 'location_on', label: 'To', value: destLine });
  const needsBits: string[] = [];
  if (ex.acresMin) needsBits.push(`${ex.acresMin}+ acres`);
  if (ex.bedsMin) needsBits.push(`${ex.bedsMin}+ bd`);
  for (const a of (ex.amenities ?? []).slice(0, 3)) needsBits.push(a.replace(/-/g, ' '));
  if (needsBits.length) rows.push({ icon: 'landscape', label: 'Needs', value: needsBits.join(', ') });
  if (ex.targetMonthly) rows.push({ icon: 'payments', label: 'Payment', value: `~$${Number(ex.targetMonthly).toLocaleString()} / mo` });
  if (ex.timing) rows.push({ icon: 'schedule', label: 'Timing', value: ex.timing });
  if (ex.fromLabel) rows.push({ icon: 'home', label: 'From', value: ex.fromLabel });
  if (ex.occupation) rows.push({ icon: 'work', label: 'Work', value: ex.occupation });
  if (ex.ownership) rows.push({ icon: 'house', label: 'Property involved', value: ex.ownership === 'own' ? 'Yes — verify later' : 'No' });
  const hasData = rows.length > 0;

  return (
    <div className={`mrq-talk ${hasData ? 'has-card' : ''}`}>
      <div className="mrq-stream">
        {msgs.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="mrq-turn mrq-turn--user">{m.text}</div>
            : <div key={i} className="mrq-turn mrq-turn--ai">{m.text}</div>
        ))}
        {sending && <div className="mrq-turn mrq-turn--thinking"><span /><span /><span /></div>}
        {box}
        <div ref={endRef} />
      </div>

      {hasData && (
        <aside className="mrq-sidecard">
          <div className="mrq-live mrq-live--rows">
            <div className="mrq-live__h">
              <MaterialIcon icon="description" className="text-[15px]" /> Your move request
              <em className="mrq-live__pill"><MaterialIcon icon="lock" className="text-[11px]" /> Private Draft</em>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="mrq-liverow">
                <span><MaterialIcon icon={r.icon} className="text-[15px]" /> {r.label}</span>
                <b>{r.value}</b>
              </div>
            ))}
            {ex.moveCondition && (
              <div className="mrq-livequote"><MaterialIcon icon="format_quote" className="text-[14px]" /> {ex.moveCondition}</div>
            )}
            <button className="mrq-btn mrq-btn--primary mrq-postbtn" onClick={post} disabled={!canPost || posting}>
              {posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[16px]" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
