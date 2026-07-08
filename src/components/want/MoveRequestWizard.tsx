'use client';

// ── MoveRequestWizard — the onramp intake ("Post a move request") ─────
//
// One page, two modes: INTRO (the explainer that earns trust BEFORE any
// question — interconnector badge + three trust cards) then INTAKE (six
// steps: Destination → Property Needs → Payment & Timing → Current Position →
// Property Involved → Preview). A live "position card" builds as they answer —
// teaching "I'm building a matchable position, not filling a form."
//
// Fuzzy → concrete: vague choices (near water, more land) immediately get a
// small quantifier so the map gets matchable criteria, not wishes.
//
// Contact is asked AFTER posting (no account wall): POST saves the want as a
// PRIVATE DRAFT (visibility gates: private → verified anonymous → public,
// verification is Prompt 2), then the soft ask PATCHes contact on.
// memory/the_thesis (the want-map; Commercial #1), plan: lazy-bubbling-dragon.

import { useEffect, useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import { supabase } from '@/lib/supabase';

// ── quick chips (Navy-town audience) ──────────────────────────────────
const CITY_CHIPS: { label: string; lat: number; lng: number }[] = [
  { label: 'Lemoore', lat: 36.3008, lng: -119.7829 },
  { label: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { label: 'Whidbey Island', lat: 48.15, lng: -122.68 },
  { label: 'Norfolk / Virginia Beach', lat: 36.8529, lng: -75.978 },
  { label: 'Pensacola', lat: 30.4213, lng: -87.2169 },
  { label: 'Key West', lat: 24.5551, lng: -81.78 },
  { label: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { label: 'Fallon', lat: 39.4735, lng: -118.7774 },
];
const FUZZY_CHIPS: { label: string; tag?: string }[] = [
  { label: 'Near a Navy base', tag: 'near-base' },
  { label: 'Near water', tag: 'waterfront' },
  { label: 'Closer to family' },
];

const ACRES = [
  { label: 'No land needed', v: null },
  { label: '0.5+ acre', v: 0.5 },
  { label: '1+ acre', v: 1 },
  { label: '2+ acres', v: 2 },
  { label: '5+ acres', v: 5 },
];
const WATER = ['5 min', '15 min', '30 min', 'Same county', 'Coastal area'];
const BEDS = [2, 3, 4, 5];
const FINANCING = ['Conventional', 'VA', 'Cash', 'Seller financing'];
const TIMING = ['ASAP', '6 months', '1–2 years', 'Flexible'];
const OWNERSHIP = [
  { v: 'own', label: 'I own here' },
  { v: 'rent', label: 'I rent here' },
  { v: 'helping', label: "I'm helping someone" },
  { v: 'exploring', label: 'I just want to explore' },
];
const BRINGS = [
  { v: 'equity', label: 'I have equity' },
  { v: 'sell-first', label: 'I need to sell first' },
  { v: 'lease-back', label: 'I can lease back' },
  { v: 'move-fast', label: 'I can move fast' },
  { v: 'need-time', label: 'I need time' },
  { v: 'trade', label: "I'd consider trading situations" },
  { v: 'seller-carry', label: "I'd consider seller financing" },
];

interface Amenity { slug: string; label: string; icon: string | null; category: string | null }

const STEPS = ['Destination', 'Property Needs', 'Payment & Timing', 'Current Position', 'Property', 'Preview'];

export default function MoveRequestWizard() {
  const [mode, setMode] = useState<'intro' | 'steps' | 'posted'>('intro');
  const [step, setStep] = useState(0);

  // ── the move request state (mirrors the wants table) ──
  const [toLabel, setToLabel] = useState('');
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [toFuzzy, setToFuzzy] = useState(false);
  const [acresMin, setAcresMin] = useState<number | null>(null);
  const [water, setWater] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [bedsMin, setBedsMin] = useState<number | null>(null);
  const [targetMonthly, setTargetMonthly] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [financing, setFinancing] = useState<string | null>(null);
  const [timing, setTiming] = useState<string | null>(null);
  const [fromLabel, setFromLabel] = useState('');
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [ownership, setOwnership] = useState<string | null>(null);
  const [brings, setBrings] = useState<string[]>([]);
  const [moveCondition, setMoveCondition] = useState('');
  const [posting, setPosting] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [contactSaved, setContactSaved] = useState(false);

  // amenity vocabulary (drives step 2 — grows without code changes)
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  useEffect(() => {
    supabase
      .from('amenities')
      .select('slug, label, icon, category')
      .in('category', ['feature', 'land', 'lifestyle'])
      .then(({ data }) => setAmenities((data as Amenity[]) ?? []));
  }, []);

  const toggleTag = (slug: string) =>
    setTags((t) => (t.includes(slug) ? t.filter((s) => s !== slug) : [...t, slug]));
  const toggleBring = (v: string) =>
    setBrings((b) => (b.includes(v) ? b.filter((s) => s !== v) : [...b, v]));

  const needsSummary = useMemo(() => {
    const bits: string[] = [];
    if (acresMin) bits.push(`${acresMin}+ acres`);
    if (bedsMin) bits.push(`${bedsMin}+ bd`);
    for (const t of tags.slice(0, 3)) {
      const a = amenities.find((x) => x.slug === t);
      bits.push(a?.label ?? t);
    }
    return bits.length ? bits.join(' · ') : 'Not set yet';
  }, [acresMin, bedsMin, tags, amenities]);

  const canNext = () => {
    if (step === 0) return !!toLabel;
    if (step === 3) return !!fromLabel && !!ownership;
    return true; // needs/payment/property are optional depth
  };

  const post = async () => {
    setPosting(true);
    try {
      const allTags = Array.from(new Set([
        ...tags,
        ...(acresMin ? ['acreage'] : []),
        ...(water && water !== 'Same county' ? ['waterfront'] : []),
        ...(financing === 'Seller financing' || brings.includes('seller-carry') ? ['seller-carry'] : []),
        ...(financing === 'VA' ? ['va-friendly'] : []),
      ]));
      const res = await fetch('/api/move-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toLabel, toLat, toLng, toFuzzy,
          acresMin, bedsMin,
          amenities: allTags,
          targetMonthly: targetMonthly || null,
          downPayment: downPayment || null,
          maxPrice: maxPrice || null,
          financingType: financing,
          timing,
          fromLabel, fromLat, fromLng,
          hasCurrentHome: ownership === 'own',
          openToSellerCarry: brings.includes('seller-carry') || financing === 'Seller financing',
          openToTrade: brings.includes('trade'),
          moveCondition,
          criteriaNotes: [
            water ? `water: ${water}` : null,
            ownership ? `ownership: ${ownership}` : null,
            brings.length ? `brings: ${brings.join(', ')}` : null,
          ].filter(Boolean).join('; ') || null,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setPostedId(data.id);
        try { window.localStorage.setItem('plotmaps.moveRequestId', data.id); } catch { /* private mode */ }
        setMode('posted');
      }
    } finally {
      setPosting(false);
    }
  };

  const saveContact = async () => {
    if (!postedId || !contact.trim()) return;
    await fetch('/api/move-request', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postedId, contact: contact.trim() }),
    });
    setContactSaved(true);
  };

  // ── INTRO MODE — earn trust before asking anything ──
  if (mode === 'intro') {
    return (
      <div className="mrq">
        <span className="mrq-badge"><MaterialIcon icon="hub" className="text-[14px]" /> Real Estate Interconnector</span>
        <h1 className="mrq-h1">Post a move request.<br />Let the map check for real connections.</h1>
        <p className="mrq-sub">
          Enter concrete criteria — location, property needs, payment range, timing,
          and what you may have to offer. PlotMaps compares your request with other
          real requests to find possible matches.
        </p>
        <div className="mrq-trust">
          <div className="mrq-trust__c">
            <MaterialIcon icon="do_not_touch" className="text-[20px]" />
            <b>Not a lead form</b>
            <span>Your info is not dropped into someone&apos;s private contact list.</span>
          </div>
          <div className="mrq-trust__c">
            <MaterialIcon icon="lock" className="text-[20px]" />
            <b>Private at first</b>
            <span>You control what becomes visible.</span>
          </div>
          <div className="mrq-trust__c">
            <MaterialIcon icon="verified_user" className="text-[20px]" />
            <b>Verified before public</b>
            <span>A property only appears on the map after authorization is confirmed.</span>
          </div>
        </div>
        <p className="mrq-line">Concrete criteria in. Possible connections out.</p>
        <div className="mrq-ctarow">
          <button className="mrq-btn mrq-btn--primary" onClick={() => setMode('steps')}>
            Start my move request <MaterialIcon icon="arrow_forward" className="text-[17px]" />
          </button>
          <button className="mrq-btn">See how it works <MaterialIcon icon="play_circle" className="text-[17px]" /></button>
        </div>
      </div>
    );
  }

  // ── POSTED MODE — the after-post soft ask (no account wall) ──
  if (mode === 'posted') {
    return (
      <div className="mrq">
        <span className="mrq-badge is-green"><MaterialIcon icon="check_circle" className="text-[14px]" /> Move request posted</span>
        <h1 className="mrq-h1">Your position is on the map.</h1>
        <p className="mrq-sub">
          Saved as a <b>private draft</b> — structured for matching, visible only to
          you until you choose otherwise.
        </p>
        {!contactSaved ? (
          <div className="mrq-card">
            <h2 className="mrq-q">Where should we send matches?</h2>
            <p className="mrq-help">Email or phone — just enough to reach you when a real connection appears. No account needed.</p>
            <div className="mrq-contactrow">
              <input className="mrq-input" placeholder="Email or phone" value={contact}
                onChange={(e) => setContact(e.target.value)} />
              <button className="mrq-btn mrq-btn--primary" onClick={saveContact} disabled={!contact.trim()}>Save</button>
            </div>
          </div>
        ) : (
          <div className="mrq-card">
            <h2 className="mrq-q"><MaterialIcon icon="notifications_active" className="text-[20px]" /> We&apos;ll reach you when a match appears.</h2>
          </div>
        )}
        <div className="mrq-ctarow">
          <a className="mrq-btn mrq-btn--primary" href="/connections">See the connection board <MaterialIcon icon="arrow_forward" className="text-[17px]" /></a>
          <a className="mrq-btn" href="/">Continue anonymously</a>
        </div>
      </div>
    );
  }

  // ── INTAKE MODE — the six steps ──
  return (
    <div className="mrq">
      {/* soft progress rail */}
      <div className="mrq-rail">
        {STEPS.map((s, i) => (
          <div key={s} className={`mrq-rail__s ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}>
            <span className="mrq-rail__n">{i < step ? <MaterialIcon icon="check" className="text-[12px]" /> : i + 1}</span>
            <span className="mrq-rail__l">{s}</span>
          </div>
        ))}
      </div>

      <div className="mrq-card">
        {step === 0 && (
          <>
            <h2 className="mrq-q">Where would you seriously consider moving?</h2>
            <div className="mrq-search">
              <ProspectSearch
                compact
                placeholder="City, base, region, or service area"
                onSelect={({ lat, lng, address }) => {
                  setToLabel(address.split(',').slice(0, 2).join(',').trim());
                  setToLat(lat); setToLng(lng); setToFuzzy(false);
                }}
              />
            </div>
            <div className="mrq-chips">
              {CITY_CHIPS.map((c) => (
                <button key={c.label}
                  className={`mrq-chip ${toLabel === c.label ? 'is-on' : ''}`}
                  onClick={() => { setToLabel(c.label); setToLat(c.lat); setToLng(c.lng); setToFuzzy(false); }}>
                  {c.label}
                </button>
              ))}
              {FUZZY_CHIPS.map((c) => (
                <button key={c.label}
                  className={`mrq-chip is-fuzzy ${toLabel === c.label ? 'is-on' : ''}`}
                  onClick={() => {
                    setToLabel(c.label); setToLat(null); setToLng(null); setToFuzzy(true);
                    if (c.tag && !tags.includes(c.tag)) setTags((t) => [...t, c.tag!]);
                  }}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* fuzzy → concrete */}
            <div className="mrq-concrete">
              <div className="mrq-concrete__h"><MaterialIcon icon="adjust" className="text-[17px]" /> Make it concrete</div>
              <div className="mrq-flabel">How much land?</div>
              <div className="mrq-chips">
                {ACRES.map((a) => (
                  <button key={a.label} className={`mrq-chip ${acresMin === a.v ? 'is-on' : ''}`}
                    onClick={() => setAcresMin(a.v)}>{a.label}</button>
                ))}
              </div>
              {(toLabel === 'Near water' || tags.includes('waterfront')) && (
                <>
                  <div className="mrq-flabel">How close to water counts?</div>
                  <div className="mrq-chips">
                    {WATER.map((w) => (
                      <button key={w} className={`mrq-chip ${water === w ? 'is-on' : ''}`}
                        onClick={() => setWater(w)}>{w}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mrq-q">What would make the move worth it?</h2>
            <p className="mrq-help">Pick what matters — these become your matchable criteria.</p>
            <div className="mrq-chips">
              {amenities.map((a) => (
                <button key={a.slug} className={`mrq-chip ${tags.includes(a.slug) ? 'is-on' : ''}`}
                  onClick={() => toggleTag(a.slug)}>
                  {a.icon && <MaterialIcon icon={a.icon} className="text-[15px]" />} {a.label}
                </button>
              ))}
            </div>
            <div className="mrq-flabel">Bedrooms</div>
            <div className="mrq-chips">
              {BEDS.map((b) => (
                <button key={b} className={`mrq-chip ${bedsMin === b ? 'is-on' : ''}`}
                  onClick={() => setBedsMin(bedsMin === b ? null : b)}>{b}+</button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mrq-q">What payment works for you?</h2>
            <p className="mrq-help">Rough numbers are fine — they make your request matchable.</p>
            <div className="mrq-flabel">Target monthly payment</div>
            <input className="mrq-input" inputMode="numeric" placeholder="e.g. 2400"
              value={targetMonthly} onChange={(e) => setTargetMonthly(e.target.value.replace(/[^\d]/g, ''))} />
            <div className="mrq-grid2">
              <div>
                <div className="mrq-flabel">Down payment</div>
                <input className="mrq-input" inputMode="numeric" placeholder="e.g. 40000"
                  value={downPayment} onChange={(e) => setDownPayment(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
              <div>
                <div className="mrq-flabel">Max price</div>
                <input className="mrq-input" inputMode="numeric" placeholder="e.g. 450000"
                  value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ''))} />
              </div>
            </div>
            <div className="mrq-flabel">Financing</div>
            <div className="mrq-chips">
              {FINANCING.map((f) => (
                <button key={f} className={`mrq-chip ${financing === f ? 'is-on' : ''}`}
                  onClick={() => setFinancing(financing === f ? null : f)}>{f}</button>
              ))}
            </div>
            <div className="mrq-flabel">Timing</div>
            <div className="mrq-chips">
              {TIMING.map((t) => (
                <button key={t} className={`mrq-chip ${timing === t ? 'is-on' : ''}`}
                  onClick={() => setTiming(timing === t ? null : t)}>{t}</button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mrq-q">Where are you now?</h2>
            <div className="mrq-search">
              <ProspectSearch
                compact
                placeholder="Your city or area"
                onSelect={({ lat, lng, address }) => {
                  setFromLabel(address.split(',').slice(0, 2).join(',').trim());
                  setFromLat(lat); setFromLng(lng);
                }}
              />
            </div>
            {fromLabel && <div className="mrq-picked"><MaterialIcon icon="location_on" className="text-[15px]" /> {fromLabel}</div>}
            <div className="mrq-flabel">Your situation there</div>
            <div className="mrq-chips">
              {OWNERSHIP.map((o) => (
                <button key={o.v} className={`mrq-chip ${ownership === o.v ? 'is-on' : ''}`}
                  onClick={() => setOwnership(o.v)}>{o.label}</button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="mrq-q">What can you bring to the table?</h2>
            <p className="mrq-help">This is what turns a wish into a connection — what you have meets what someone else wants.</p>
            <div className="mrq-chips">
              {BRINGS.map((b) => (
                <button key={b.v} className={`mrq-chip ${brings.includes(b.v) ? 'is-on' : ''}`}
                  onClick={() => toggleBring(b.v)}>{b.label}</button>
              ))}
            </div>
            <div className="mrq-flabel">In one line — what would make you move?</div>
            <input className="mrq-input" placeholder={'"I\'d move if …"'} maxLength={200}
              value={moveCondition} onChange={(e) => setMoveCondition(e.target.value)} />
            <p className="mrq-help" style={{ marginTop: 6 }}>
              To place a property on the public map you&apos;ll verify you own or
              control it — later, privately. Posting a want needs no verification.
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="mrq-q">Preview your move request</h2>
            <div className="mrq-preview">
              <div className="mrq-preview__route">
                <b>{fromLabel || 'Somewhere'}</b>
                <MaterialIcon icon="trending_flat" className="text-[20px]" />
                <b>{toLabel || 'Somewhere better'}</b>
              </div>
              <div className="mrq-preview__row"><span>Needs</span><b>{needsSummary}</b></div>
              {targetMonthly && <div className="mrq-preview__row"><span>Payment</span><b>~${Number(targetMonthly).toLocaleString()}/mo</b></div>}
              {timing && <div className="mrq-preview__row"><span>Timeline</span><b>{timing}</b></div>}
              {moveCondition && <div className="mrq-preview__row"><span>I&apos;d move if</span><b>{moveCondition}</b></div>}
              <div className="mrq-preview__row"><span>Visibility</span><b className="mrq-private"><MaterialIcon icon="lock" className="text-[13px]" /> Private draft</b></div>
            </div>
          </>
        )}
      </div>

      {/* live position card — builds as they answer */}
      {step < 5 && (toLabel || fromLabel) && (
        <div className="mrq-live">
          <div className="mrq-live__h"><MaterialIcon icon="description" className="text-[15px]" /> Your move request</div>
          <div className="mrq-live__row"><MaterialIcon icon="location_on" className="text-[14px]" /> To: {toLabel || '—'}</div>
          <div className="mrq-live__row"><MaterialIcon icon="landscape" className="text-[14px]" /> Needs: {needsSummary}</div>
          <div className="mrq-live__row"><MaterialIcon icon="lock" className="text-[14px]" /> Visibility: Private draft</div>
        </div>
      )}

      {/* nav */}
      <div className="mrq-ctarow">
        <button className="mrq-btn" onClick={() => (step === 0 ? setMode('intro') : setStep(step - 1))}>
          <MaterialIcon icon="arrow_back" className="text-[17px]" /> Back
        </button>
        {step < 5 ? (
          <button className="mrq-btn mrq-btn--primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
            Continue <MaterialIcon icon="arrow_forward" className="text-[17px]" />
          </button>
        ) : (
          <button className="mrq-btn mrq-btn--primary" disabled={posting} onClick={post}>
            {posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[17px]" />
          </button>
        )}
      </div>
    </div>
  );
}
