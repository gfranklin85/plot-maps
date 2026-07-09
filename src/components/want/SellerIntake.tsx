'use client';

// ── SellerIntake — the seller states their move, one question at a time ──
//
// Greg 2026-07-08 (reversed the AI-chat front door): /post is a clean
// ONE-QUESTION-AT-A-TIME questionnaire, mirroring the proven /bullpen
// StatePosition engine — distinct questions into known slots, no chat, no BS.
// Examples are read-only illustrations, never tappable.
//
// WANT is basically two questions:
//   1. Where do you want to go? (chips + states + city autocomplete, MULTIPLE)
//   2. What do you want there? (concrete chips + free amenity/keyword field)
//
// Then the HAVE pivot with the TWO DOORS TO QUALIFY, side by side
// (memory/project_two_doors_to_qualify):
//   • Post what you HAVE → prove ownership → a tradeable node (feeds the
//     envelope; mortgage statement upload → /api/statement-read, or type it).
//   • Qualify with a LENDER → keeping your place, buy as a funded buyer →
//     routes to the EXISTING /bullpen (don't rebuild).

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import USStateMap from '@/components/want/USStateMap';
import HaveProperty, { type HaveData } from '@/components/want/HaveProperty';

interface Dest { label: string; lat: number | null; lng: number | null }

// Concrete "what do you want" chips — real, matchable features (NOT moods).
const WANT_CHIPS = [
  'Single story', '3+ bedrooms', '2+ baths', 'Big lot', 'Acreage', 'Pool',
  'Shop / garage', 'Vaulted ceilings', 'Updated kitchen', 'No HOA',
  'Near a base', 'Good schools', 'Mountain view', 'Waterfront', 'RV parking',
];

// Read-only illustrations of a strong ask (NOT tappable — Greg).
const ILLUSTRATIONS = [
  'Nashville or Chattanooga, TN — 3+ beds, a shop or some land, single story.',
  'Pensacola or Jacksonville, FL — near a base, no HOA, big lot.',
  'A ~200k-person city in South Carolina with a tech scene, half acre minimum.',
];

type Door = 'have' | 'lender' | null;

export default function SellerIntake() {
  const [step, setStep] = useState(0);          // 0 where · 1 what · 2 door · 3 have-detail
  const [dests, setDests] = useState<Dest[]>([]);
  const [mapSel, setMapSel] = useState<{ abbr: string; name: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [door, setDoor] = useState<Door>(null);
  const [have, setHave] = useState<HaveData | null>(null);
  const [posting, setPosting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);

  const addDest = (d: Dest) =>
    setDests((cur) => (cur.some((x) => x.label === d.label) ? cur : [...cur, d].slice(0, 12)));
  const removeDest = (label: string) => setDests((cur) => cur.filter((d) => d.label !== label));
  const toggleState = (s: { abbr: string; name: string }) => {
    setMapSel((cur) => (cur.some((x) => x.abbr === s.abbr) ? cur.filter((x) => x.abbr !== s.abbr) : [...cur, s]));
    setDests((cur) => (cur.some((d) => d.label === s.name)
      ? cur.filter((d) => d.label !== s.name)
      : [...cur, { label: s.name, lat: null, lng: null }].slice(0, 12)));
  };
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const canNext = useMemo(() => {
    if (step === 0) return dests.length > 0;
    if (step === 1) return true; // needs are optional depth
    return true;
  }, [step, dests.length]);

  // Slugify a want chip/keyword to the amenity vocabulary convention.
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function post() {
    if (posting || dests.length === 0) return;
    setPosting(true);
    try {
      const primary = dests[0];
      const amenities = Array.from(new Set([
        ...tags.map(slug),
        ...keywords.split(',').map((k) => slug(k.trim())).filter(Boolean),
      ]));
      const res = await fetch('/api/move-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toLabel: primary.label,
          toLat: primary.lat,
          toLng: primary.lng,
          toFuzzy: primary.lat == null,
          destinations: dests.slice(1),
          amenities,
          criteriaNotes: keywords ? `keywords: ${keywords}` : null,
          // HAVE side (envelope facts) when they posted a property
          hasCurrentHome: door === 'have',
          fromLabel: have?.address ?? null,
          currentHomeValue: have?.value ?? null,
          equity: have && have.value != null && have.owed != null ? have.value - have.owed : null,
          openToSellerCarry: have?.openToCarry ?? false,
          openToTrade: have?.openToTrade ?? false,
          moveCondition: have?.envelope?.glideNote
            ? `stay within my envelope: ${have.envelope.glideNote}`
            : null,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setPostedId(data.id);
        try { window.localStorage.setItem('plotmaps.moveRequestId', data.id); } catch { /* private */ }
      }
    } finally {
      setPosting(false);
    }
  }

  // ── POSTED ──
  if (postedId) {
    return (
      <div className="sp">
        <div className="sp-card sp-card--done">
          <span className="mrq-badge is-green"><MaterialIcon icon="check_circle" className="text-[14px]" /> Move request posted</span>
          <h2 className="sp-q">Your position is on the map.</h2>
          <p className="sp-help">Saved as a private draft — structured for matching, visible only to you until you choose otherwise. We&apos;ll work the map for a connection.</p>
          <div className="sp-nav">
            <a className="sp-next" href={`/my-request?id=${postedId}`}>Find my connections <MaterialIcon icon="arrow_forward" className="text-[16px]" /></a>
          </div>
        </div>
      </div>
    );
  }

  const STEP_LABELS = ['Where', 'What', 'What you have'];
  const shown = step > 2 ? 2 : step;

  return (
    <div className="sp">
      <div className="sp-progress">
        {STEP_LABELS.map((_, i) => (
          <span key={i} className="sp-tick" style={{ width: i === shown ? 26 : 12, background: i <= shown ? 'var(--plot-brand)' : 'rgba(19,73,212,0.16)' }} />
        ))}
      </div>

      {/* STEP 0 — WHERE */}
      {step === 0 && (
        <div className="sp-card">
          <h2 className="sp-q">Where do you want to go?</h2>
          <p className="sp-help">Add every place you&apos;d truly consider — a city, a state, or a few. Type a city or click states on the map.</p>
          <div className="sp-answer">
            <ProspectSearch compact placeholder="City, base, or region"
              onSelect={({ lat, lng, address }) => addDest({ label: address.split(',').slice(0, 2).join(',').trim(), lat, lng })} />
            {dests.length > 0 && (
              <div className="mrq-dests" style={{ marginTop: 12 }}>
                {dests.map((d) => (
                  <span key={d.label} className="mrq-dest">
                    <MaterialIcon icon="location_on" className="text-[13px]" /> {d.label}
                    <button aria-label={`Remove ${d.label}`} onClick={() => removeDest(d.label)}><MaterialIcon icon="close" className="text-[12px]" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="sp-map"><USStateMap selected={mapSel.map((s) => s.abbr)} onToggle={toggleState} /></div>
          </div>
        </div>
      )}

      {/* STEP 1 — WHAT */}
      {step === 1 && (
        <div className="sp-card">
          <h2 className="sp-q">What do you want in your next place?</h2>
          <p className="sp-help">Pick the concrete things that matter. Add anything specific below — &ldquo;orange trees,&rdquo; &ldquo;workshop with 220v,&rdquo; whatever it is.</p>
          <div className="sp-answer">
            <div className="mrq-chips">
              {WANT_CHIPS.map((c) => (
                <button key={c} className={`mrq-chip ${tags.includes(c) ? 'is-on' : ''}`} onClick={() => toggleTag(c)}>{c}</button>
              ))}
            </div>
            <div className="mrq-flabel" style={{ marginTop: 16 }}>Anything specific? (comma-separated)</div>
            <input className="sp-input" placeholder="orange trees, RV gate, well water, mother-in-law suite"
              value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <div className="sp-illus">
              <span>Examples of a strong ask:</span>
              {ILLUSTRATIONS.map((ex, i) => <em key={i}>{ex}</em>)}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — THE TWO DOORS */}
      {step === 2 && (
        <div className="sp-card">
          <h2 className="sp-q">We can match you within your payment or better.</h2>
          <p className="sp-help">This is an interconnection matrix — not a search-and-buy. To take part for real, you either bring a property, or come in as a funded buyer. Two ways in:</p>
          <div className="sp-doors">
            <button className={`sp-door ${door === 'have' ? 'is-on' : ''}`} onClick={() => setDoor('have')}>
              <MaterialIcon icon="real_estate_agent" className="text-[24px]" />
              <b>I have a property</b>
              <span>Post what you&apos;ve got. It becomes a tradeable piece of the web — and we compute your &ldquo;stay within my payment&rdquo; envelope.</span>
            </button>
            <button className={`sp-door ${door === 'lender' ? 'is-on' : ''}`} onClick={() => setDoor('lender')}>
              <MaterialIcon icon="account_balance" className="text-[24px]" />
              <b>I&apos;m keeping my place — I just want to buy</b>
              <span>Qualify with a lender instead. Your funding is your proof. Lenders compete for you, and your search comes validated.</span>
            </button>
          </div>
          {door === 'lender' && (
            <p className="sp-doornote">
              <MaterialIcon icon="info" className="text-[14px]" />
              We&apos;ll take you to state your position — a lender qualifies you (no credit pull), and your funded search carries proof.
            </p>
          )}
        </div>
      )}

      {/* STEP 3 — HAVE detail (only for the property door) */}
      {step === 3 && (
        <HaveProperty value={have} onChange={setHave} />
      )}

      {/* nav */}
      <div className="sp-nav">
        {step > 0 && <button className="sp-back" onClick={() => setStep(step - 1)}><MaterialIcon icon="arrow_back" className="text-[16px]" /> Back</button>}
        <div className="sp-nav__spacer" />
        {step === 0 && <button className="sp-next" disabled={!canNext} onClick={() => setStep(1)}>Next <MaterialIcon icon="arrow_forward" className="text-[16px]" /></button>}
        {step === 1 && <button className="sp-next" onClick={() => setStep(2)}>Next <MaterialIcon icon="arrow_forward" className="text-[16px]" /></button>}
        {step === 2 && door === 'have' && <button className="sp-next" onClick={() => setStep(3)}>Next <MaterialIcon icon="arrow_forward" className="text-[16px]" /></button>}
        {step === 2 && door === 'lender' && <a className="sp-next" href="/bullpen">Qualify with a lender <MaterialIcon icon="arrow_forward" className="text-[16px]" /></a>}
        {step === 3 && <button className="sp-next" disabled={posting} onClick={post}>{posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[15px]" /></button>}
      </div>
    </div>
  );
}
