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
// small quantifier so the map gets matchable criteria, not wishes. NO wish
// data survives: "Closer to family" is not a destination — it RESOLVES into
// the real cities where family lives (the resolver panel). Destinations are
// a SET (wide + narrow wants: FL + GA + TN all matchable at once), and
// occupation + comparative town-size anchoring ride along — what somebody
// does means everything for where they can actually go. (the_thesis: THE
// INTAKE IS A CONVERSATION.)
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
// Qualifiers ride on TOP of real destinations (they're amenity tags, never a
// destination themselves). "Closer to family" is handled by the resolver —
// family is only matchable once it's a place.
const QUALIFIER_CHIPS: { label: string; tag: string }[] = [
  { label: 'Near a Navy base', tag: 'near-base' },
  { label: 'Near water', tag: 'waterfront' },
];

// Comparative population anchoring — people know "as big as Lemoore," not
// census numbers. Anchored to wherever they are now.
const POP_ANCHORS: { v: string; label: (home: string) => string }[] = [
  { v: 'smaller', label: (h) => `Smaller than ${h}` },
  { v: 'same', label: (h) => `About the size of ${h}` },
  { v: 'bigger', label: () => 'Bigger — more city' },
  { v: 'any', label: () => "Size doesn't matter" },
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

const STEPS = ['Destination', 'Property Needs', 'Payment & Timing', 'Current Position', 'Property', 'Verify & Secure', 'Preview & Post'];

// Verification methods (step 6). Verification is PRIVATE — only used to
// confirm the right to post a property. "Verify privately. Choose how you
// appear publicly." Mail = PostGrid code to the property address.
const VERIFY_METHODS: {
  v: string; icon: string; title: string; desc: string; badge?: string; chips?: string[];
}[] = [
  { v: 'mail', icon: 'mail', title: 'Verify by Mail (Recommended)',
    desc: "We'll mail a verification code to the property address. You enter the code here to confirm.",
    badge: 'Most Secure' },
  { v: 'document', icon: 'cloud_upload', title: 'Upload a Document',
    desc: 'Upload one or more documents that show you have authority over this property.',
    chips: ['Tax Bill', 'Utility Bill', 'Mortgage Statement', 'Insurance', 'Other'] },
  { v: 'agent', icon: 'person', title: 'Verify Through an Agent',
    desc: 'A licensed real estate agent (you or someone else) confirms your authority.',
    chips: ['Agent or Brokerage Confirmation'] },
  { v: 'representative', icon: 'groups', title: 'Verify as a Representative',
    desc: 'For heirs, trustees, attorneys, or property managers. Provide documents that establish your authority.',
    chips: ['Trust Document', 'POA', 'Estate Docs', 'Mgmt Agreement'] },
  { v: 'later', icon: 'schedule', title: "I'll Do This Later",
    desc: 'Save your request as a private draft. You can verify and publish to the map anytime.' },
];

export default function MoveRequestWizard() {
  const [mode, setMode] = useState<'intro' | 'steps' | 'posted'>('intro');
  const [step, setStep] = useState(0);

  // ── the move request state (mirrors the wants table) ──
  // Destinations are a SET — every region they'd truly consider, each one
  // matchable ("wide wants and narrow wants"). First = primary (wants.to_*),
  // the rest land in want_destinations.
  const [dests, setDests] = useState<{ label: string; lat: number | null; lng: number | null; family?: boolean }[]>([]);
  const [familyOpen, setFamilyOpen] = useState(false);
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
  // what somebody does means everything — it decides where they CAN go
  const [occupation, setOccupation] = useState('');
  const [popAnchor, setPopAnchor] = useState<string | null>(null);
  const [brings, setBrings] = useState<string[]>([]);
  const [moveCondition, setMoveCondition] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<string>('mail');
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
  const addDest = (d: { label: string; lat: number | null; lng: number | null; family?: boolean }) =>
    setDests((ds) => (ds.some((x) => x.label === d.label) ? ds : [...ds, d].slice(0, 12)));
  const removeDest = (label: string) => setDests((ds) => ds.filter((d) => d.label !== label));
  const primary = dests[0] ?? null;
  const destSummary = dests.length
    ? dests.slice(0, 3).map((d) => d.label).join(' · ') + (dests.length > 3 ? ` +${dests.length - 3}` : '')
    : '';
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
    if (step === 0) return dests.length > 0;
    if (step === 3) return !!fromLabel && !!ownership;
    return true; // needs/payment/property/verify are optional depth
  };

  // A property is involved when they own (or are helping someone who does) —
  // that's what verification is FOR. Wants alone never need it.
  const hasProperty = ownership === 'own' || ownership === 'helping';

  // Per-step answer summaries for the desktop rail (the rail teaches progress).
  const railSummary = [
    destSummary || null,
    needsSummary !== 'Not set yet' ? needsSummary : null,
    [targetMonthly ? `~$${Number(targetMonthly).toLocaleString()}/mo` : null, timing].filter(Boolean).join(' · ') || null,
    [fromLabel, occupation].filter(Boolean).join(' · ') || null,
    ownership ? (OWNERSHIP.find((o) => o.v === ownership)?.label ?? null) : null,
    hasProperty ? (VERIFY_METHODS.find((m) => m.v === verifyMethod)?.title.replace(' (Recommended)', '') ?? null) : 'Nothing to verify',
    null,
  ];

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
          // primary destination → wants.to_*; the REST of the set →
          // want_destinations (every one matchable)
          toLabel: primary?.label,
          toLat: primary?.lat ?? null,
          toLng: primary?.lng ?? null,
          toFuzzy: primary ? primary.lat === null : true,
          destinations: dests.slice(1),
          occupation: occupation || null,
          populationAnchor: popAnchor,
          acresMin, bedsMin,
          amenities: allTags,
          targetMonthly: targetMonthly || null,
          downPayment: downPayment || null,
          maxPrice: maxPrice || null,
          financingType: financing,
          timing,
          fromLabel, fromLat, fromLng,
          hasCurrentHome: ownership === 'own',
          verificationMethod: hasProperty ? verifyMethod : null,
          openToSellerCarry: brings.includes('seller-carry') || financing === 'Seller financing',
          openToTrade: brings.includes('trade'),
          moveCondition,
          criteriaNotes: [
            water ? `water: ${water}` : null,
            ownership ? `ownership: ${ownership}` : null,
            brings.length ? `brings: ${brings.join(', ')}` : null,
            // keep WHY a destination is in the set — family context matters
            dests.some((d) => d.family)
              ? `family in: ${dests.filter((d) => d.family).map((d) => d.label).join(', ')}`
              : null,
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
          <a className="mrq-btn mrq-btn--primary" href={postedId ? `/my-request?id=${postedId}` : '/my-request'}>
            Open My Move Request <MaterialIcon icon="arrow_forward" className="text-[17px]" />
          </a>
          <a className="mrq-btn" href="/connections">See the connection board</a>
        </div>
      </div>
    );
  }

  // ── INTAKE MODE — the six steps ──
  // Desktop (per the locked desktop mockup): two columns — the step card left,
  // a PERSISTENT "Your move request" position card + Private explainer in a
  // right sidebar. Mobile: sidebar stacks below the step card.
  return (
    <div className="mrq mrq--wide">
      {/* soft progress rail */}
      <div className="mrq-rail">
        {STEPS.map((s, i) => (
          <div key={s} className={`mrq-rail__s ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}>
            <span className="mrq-rail__n">{i < step ? <MaterialIcon icon="check" className="text-[12px]" /> : i + 1}</span>
            <span className="mrq-rail__l">{s}</span>
          </div>
        ))}
      </div>

      <div className="mrq-cols">
      {/* desktop vertical rail — each step shows its ANSWER as you go */}
      <aside className="mrq-vrail">
        <div className="mrq-vrail__h">Post Your Move Request</div>
        {STEPS.map((s, i) => (
          <button key={s} type="button"
            className={`mrq-vrail__s ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}
            onClick={() => { if (i < step) setStep(i); }}>
            <span className="mrq-vrail__n">{i < step ? <MaterialIcon icon="check" className="text-[12px]" /> : i + 1}</span>
            <span className="mrq-vrail__body">
              <b>{s}</b>
              {railSummary[i] && <span>{railSummary[i]}</span>}
            </span>
          </button>
        ))}
      </aside>

      <div className="mrq-main">
      <div className="mrq-card">
        {step === 0 && (
          <>
            <h2 className="mrq-q">Where would you seriously consider moving?</h2>
            <p className="mrq-help">
              Add every place you&apos;d truly go — one city or six states. Each one
              gets matched.
            </p>
            <div className="mrq-search">
              <ProspectSearch
                compact
                placeholder="City, base, region, or service area"
                onSelect={({ lat, lng, address }) => {
                  addDest({ label: address.split(',').slice(0, 2).join(',').trim(), lat, lng });
                }}
              />
            </div>

            {/* the destination SET — removable pills */}
            {dests.length > 0 && (
              <div className="mrq-dests">
                {dests.map((d) => (
                  <span key={d.label} className={`mrq-dest ${d.family ? 'is-family' : ''}`}>
                    <MaterialIcon icon={d.family ? 'family_restroom' : 'location_on'} className="text-[14px]" />
                    {d.label}
                    <button type="button" aria-label={`Remove ${d.label}`} onClick={() => removeDest(d.label)}>
                      <MaterialIcon icon="close" className="text-[13px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mrq-chips">
              {CITY_CHIPS.map((c) => (
                <button key={c.label}
                  className={`mrq-chip ${dests.some((d) => d.label === c.label) ? 'is-on' : ''}`}
                  onClick={() => (dests.some((d) => d.label === c.label)
                    ? removeDest(c.label)
                    : addDest({ label: c.label, lat: c.lat, lng: c.lng }))}>
                  {c.label}
                </button>
              ))}
              {QUALIFIER_CHIPS.map((c) => (
                <button key={c.label}
                  className={`mrq-chip is-fuzzy ${tags.includes(c.tag) ? 'is-on' : ''}`}
                  onClick={() => toggleTag(c.tag)}>
                  {c.label}
                </button>
              ))}
              <button
                className={`mrq-chip is-fuzzy ${familyOpen || dests.some((d) => d.family) ? 'is-on' : ''}`}
                onClick={() => setFamilyOpen((o) => !o)}>
                Closer to family
              </button>
            </div>

            {/* the family RESOLVER — family only matches once it's a place */}
            {familyOpen && (
              <div className="mrq-concrete">
                <div className="mrq-concrete__h"><MaterialIcon icon="family_restroom" className="text-[17px]" /> Where&apos;s family?</div>
                <p className="mrq-help">
                  &quot;Closer to family&quot; can&apos;t be matched — but their cities can.
                  Add the places where your people are.
                </p>
                <div className="mrq-search">
                  <ProspectSearch
                    compact
                    placeholder="Their city or town"
                    onSelect={({ lat, lng, address }) => {
                      addDest({ label: address.split(',').slice(0, 2).join(',').trim(), lat, lng, family: true });
                    }}
                  />
                </div>
              </div>
            )}

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
              {tags.includes('waterfront') && (
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

            {/* occupation — what somebody does means everything for where
                they can actually go */}
            <div className="mrq-flabel">What do you do for work?</div>
            <input className="mrq-input" placeholder="e.g. Navy aviation mechanic, nurse, remote software"
              maxLength={160} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            <p className="mrq-help" style={{ marginTop: 6 }}>
              Your work shapes which destinations actually fit — bases, hospitals,
              industries, remote-friendly towns.
            </p>

            {/* comparative population anchoring — "as big as Lemoore?" */}
            <div className="mrq-flabel">How big a town are you after?</div>
            <div className="mrq-chips">
              {POP_ANCHORS.map((p) => (
                <button key={p.v} className={`mrq-chip ${popAnchor === p.v ? 'is-on' : ''}`}
                  onClick={() => setPopAnchor(popAnchor === p.v ? null : p.v)}>
                  {p.label(fromLabel ? fromLabel.split(',')[0] : 'where you are')}
                </button>
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
            <div className="mrq-banner">
              <MaterialIcon icon="verified_user" className="text-[18px]" />
              <span><b>Verification keeps the map real.</b> You stay in control of what&apos;s public.</span>
            </div>
            {hasProperty ? (
              <>
                <h2 className="mrq-q">How would you like to verify?</h2>
                <p className="mrq-help">
                  Choose the method that works best for you. Verification is private
                  and only used to confirm you have the right to post this property
                  on PlotMaps.
                </p>
                <div className="mrq-methods">
                  {VERIFY_METHODS.map((m) => (
                    <button key={m.v} type="button"
                      className={`mrq-method ${verifyMethod === m.v ? 'is-on' : ''}`}
                      onClick={() => setVerifyMethod(m.v)}>
                      <span className="mrq-method__icon"><MaterialIcon icon={m.icon} className="text-[22px]" /></span>
                      <span className="mrq-method__body">
                        <b>{m.title}</b>
                        <span>{m.desc}</span>
                        {m.badge && <em className="mrq-method__badge">{m.badge}</em>}
                        {m.chips && (
                          <span className="mrq-method__chips">
                            {m.chips.map((c) => <i key={c}>{c}</i>)}
                          </span>
                        )}
                      </span>
                      <span className={`mrq-method__radio ${verifyMethod === m.v ? 'is-on' : ''}`}>
                        {verifyMethod === m.v && <MaterialIcon icon="check" className="text-[13px]" />}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mrq-help" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MaterialIcon icon="lock" className="text-[14px]" />
                  Your information is encrypted and never sold or shared.
                </p>
              </>
            ) : (
              <>
                <h2 className="mrq-q">Nothing to verify.</h2>
                <p className="mrq-help">
                  You didn&apos;t attach a property, and posting a want never requires
                  verification. If you add a property later, we&apos;ll confirm your
                  authority privately before it appears on the public map.
                </p>
              </>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="mrq-q">Preview your move request</h2>
            <div className="mrq-preview">
              <div className="mrq-preview__route">
                <b>{fromLabel || 'Somewhere'}</b>
                <MaterialIcon icon="trending_flat" className="text-[20px]" />
                <b>{primary?.label || 'Somewhere better'}{dests.length > 1 ? ` +${dests.length - 1} more` : ''}</b>
              </div>
              {dests.length > 1 && (
                <div className="mrq-preview__row"><span>Open to</span><b>{dests.map((d) => d.label).join(' · ')}</b></div>
              )}
              <div className="mrq-preview__row"><span>Needs</span><b>{needsSummary}</b></div>
              {occupation && <div className="mrq-preview__row"><span>Work</span><b>{occupation}</b></div>}
              {targetMonthly && <div className="mrq-preview__row"><span>Payment</span><b>~${Number(targetMonthly).toLocaleString()}/mo</b></div>}
              {timing && <div className="mrq-preview__row"><span>Timeline</span><b>{timing}</b></div>}
              {moveCondition && <div className="mrq-preview__row"><span>I&apos;d move if</span><b>{moveCondition}</b></div>}
              {hasProperty && (
                <div className="mrq-preview__row"><span>Property involved</span><b>Yes — {verifyMethod === 'later' ? 'not yet verified' : `verify by ${verifyMethod}`}</b></div>
              )}
              <div className="mrq-preview__row"><span>Visibility</span><b className="mrq-private"><MaterialIcon icon="lock" className="text-[13px]" /> Private until verified</b></div>
            </div>
          </>
        )}
      </div>

      {/* nav */}
      <div className="mrq-ctarow">
        <button className="mrq-btn" onClick={() => (step === 0 ? setMode('intro') : setStep(step - 1))}>
          <MaterialIcon icon="arrow_back" className="text-[17px]" /> Back
        </button>
        {step < 6 ? (
          <button className="mrq-btn mrq-btn--primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
            {step === 5 ? 'Continue to Preview' : 'Continue'} <MaterialIcon icon="arrow_forward" className="text-[17px]" />
          </button>
        ) : (
          <button className="mrq-btn mrq-btn--primary" disabled={posting} onClick={post}>
            {posting ? 'Posting…' : 'Post my move request'} <MaterialIcon icon="send" className="text-[17px]" />
          </button>
        )}
      </div>
      </div>

      {/* the persistent position card + Private explainer (desktop sidebar;
          stacks below on mobile) */}
      <aside className="mrq-side">
        <div className="mrq-live">
          <div className="mrq-live__h">
            <MaterialIcon icon="description" className="text-[15px]" /> Your move request
            <em className="mrq-live__pill"><MaterialIcon icon="lock" className="text-[11px]" /> Private Draft</em>
          </div>
          <div className="mrq-live__row"><MaterialIcon icon="location_on" className="text-[14px]" /> To: {destSummary || '—'}</div>
          <div className="mrq-live__row"><MaterialIcon icon="landscape" className="text-[14px]" /> Needs: {needsSummary}</div>
          {fromLabel && <div className="mrq-live__row"><MaterialIcon icon="home" className="text-[14px]" /> From: {fromLabel}</div>}
          {occupation && <div className="mrq-live__row"><MaterialIcon icon="work" className="text-[14px]" /> Work: {occupation}</div>}
          {targetMonthly && <div className="mrq-live__row"><MaterialIcon icon="payments" className="text-[14px]" /> ~${Number(targetMonthly).toLocaleString()}/mo</div>}
          <div className="mrq-live__row"><MaterialIcon icon="lock" className="text-[14px]" /> Visibility: Private draft</div>
        </div>
        {step === 5 && hasProperty ? (
          <div className="mrq-privcard mrq-privcard--why">
            <div className="mrq-privcard__h"><MaterialIcon icon="verified_user" className="text-[16px]" /> Why verify?</div>
            <ul className="mrq-why">
              <li><MaterialIcon icon="check" className="text-[14px]" /> Keeps the map accurate</li>
              <li><MaterialIcon icon="check" className="text-[14px]" /> Builds trust with other users</li>
              <li><MaterialIcon icon="check" className="text-[14px]" /> Prevents scams and duplicates</li>
              <li><MaterialIcon icon="check" className="text-[14px]" /> You control what&apos;s shared</li>
            </ul>
          </div>
        ) : (
          <div className="mrq-privcard">
            <div className="mrq-privcard__h"><MaterialIcon icon="lock" className="text-[16px]" /> Private</div>
            <p>Your request is private and only shared with verified matches. You control what goes public.</p>
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}
