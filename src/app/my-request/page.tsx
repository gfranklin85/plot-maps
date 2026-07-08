'use client';

// ── /my-request — My Move Request (the poster's command room) ─────────
//
// The page the funnel graduates into: their request restated (feel seen),
// verification status + method, and POSSIBLE MOVE PATHS — direct connections
// AND multi-party webs ("you + 2 others could complete a move"). Webs, not
// swaps: never present mutual-swap as the goal. Access = the uuid as bearer
// (localStorage from /post, or ?id= from a return link); Google sign-in claims
// it permanently. memory/the_thesis, plan: lazy-bubbling-dragon.

import { useEffect, useState, useCallback } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { signInWithGoogle } from '@/lib/signIn';

interface Tag { slug: string; label: string; icon: string | null }
interface Direct {
  other_id: string; other_label: string; other_to_label: string;
  other_move_condition: string | null; direction: string;
  matched_destination: string | null;
  match_pct: number; mutual: boolean; shared_tags: string[] | null;
}
interface Dest { id: string; label: string; is_fuzzy: boolean }
interface Path { chain: string[]; labels: string[]; chain_len: number }
interface Want {
  id: string; from_label: string | null; to_label: string | null;
  acres_min: number | null; beds_min: number | null;
  target_monthly: number | null; timing: string | null;
  has_current_home: boolean; move_condition: string | null;
  status: string; visibility: string;
  verification_method: string | null; verification_status: string;
  criteria_notes: string | null; owner_contact: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  mail: 'Verify by Mail', document: 'Upload a Document',
  agent: 'Verify Through an Agent', representative: 'Verify as a Representative',
  later: 'Do This Later',
};

export default function MyMoveRequestPage() {
  const [id, setId] = useState<string | null>(null);
  const [want, setWant] = useState<Want | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [destinations, setDestinations] = useState<Dest[]>([]);
  const [direct, setDirect] = useState<Direct[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('id');
    const fromStore = window.localStorage.getItem('plotmaps.moveRequestId');
    setId(fromUrl || fromStore);
    if (!fromUrl && !fromStore) { setLoading(false); setNotFound(true); }
  }, []);

  const load = useCallback(async (wid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/move-request?id=${wid}`);
      if (!res.ok) { setNotFound(true); return; }
      const d = await res.json();
      setWant(d.want); setTags(d.tags ?? []);
      setDestinations(d.destinations ?? []);
      setDirect(d.direct ?? []); setPaths(d.paths ?? []);
      setActiveCount(d.activeCount ?? 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (id) load(id); }, [id, load]);

  const patch = async (fields: Record<string, unknown>) => {
    if (!id) return;
    await fetch('/api/move-request', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    load(id);
  };

  if (loading) return <div className="dsh min-h-screen"><div className="mymr__load">Loading your move request…</div></div>;

  if (notFound || !want) {
    return (
      <div className="dsh min-h-screen">
        <div className="mrq" style={{ paddingTop: 60 }}>
          <h1 className="mrq-h1">No move request found here.</h1>
          <p className="mrq-sub">If you posted one, open the link from your email — or post a new request.</p>
          <div className="mrq-ctarow">
            <a className="mrq-btn mrq-btn--primary" href="/post">Post a move request <MaterialIcon icon="arrow_forward" className="text-[17px]" /></a>
          </div>
        </div>
      </div>
    );
  }

  const paused = want.status === 'paused';
  const needs = [
    want.acres_min ? `${want.acres_min}+ acres` : null,
    want.beds_min ? `${want.beds_min}+ bd` : null,
    ...tags.slice(0, 4).map((t) => t.label),
  ].filter(Boolean).join(' · ') || '—';

  return (
    <div className="dsh min-h-screen">
      <div className="mymr">
        {/* ── header ── */}
        <div className="mymr-head">
          <div>
            <h1 className="mymr-h1"><MaterialIcon icon="explore" className="text-[26px]" /> My Move Request</h1>
            <p className="mymr-sub">
              This is your private command room. We&apos;re comparing your request
              across the map to find direct connections and multi-step move paths.
            </p>
          </div>
        </div>

        <div className="mymr-cols">
          <div className="mymr-main">
            {/* ── the request ── */}
            <section className="mymr-card">
              <div className="mymr-card__head">
                <h2>Your Move Request</h2>
                <span className={`mymr-pill ${paused ? 'is-paused' : 'is-active'}`}>
                  {paused ? 'Paused' : 'Active'} · {want.visibility === 'private' ? 'Private Draft' : 'Public'}
                </span>
              </div>
              <div className="mymr-route">
                <div className="mymr-route__end">
                  <span>From</span>
                  <b>{want.from_label || '—'}</b>
                </div>
                <span className="mymr-route__arrow"><MaterialIcon icon="arrow_forward" className="text-[18px]" /></span>
                <div className="mymr-route__end">
                  <span>To</span>
                  <b>{want.to_label || '—'}{destinations.length > 0 ? ` +${destinations.length} more` : ''}</b>
                </div>
              </div>
              {destinations.length > 0 && (
                <div className="mymr-destset">
                  <span>Also open to</span>
                  {destinations.map((d) => <b key={d.id}>{d.label}</b>)}
                </div>
              )}
              <div className="mymr-facts">
                <div><span>Property needs</span><b>{needs}</b></div>
                <div><span>Payment</span><b>{want.target_monthly ? `~$${Number(want.target_monthly).toLocaleString()}/mo` : '—'}</b></div>
                <div><span>Timing</span><b>{want.timing || '—'}</b></div>
                <div><span>Property involved</span><b>{want.has_current_home ? `Yes${want.verification_status !== 'verified' ? ' (not yet verified)' : ''}` : 'No'}</b></div>
                <div><span>Visibility</span><b>{want.visibility === 'private' ? 'Private until verified' : 'Public'}</b></div>
              </div>
              {want.move_condition && (
                <div className="mymr-movecond"><MaterialIcon icon="format_quote" className="text-[16px]" /> {want.move_condition}</div>
              )}
              <div className="mymr-note"><MaterialIcon icon="info" className="text-[15px]" /> We&apos;ll notify you when a possible connection or move path appears that matches your criteria.</div>
              <div className="mymr-actions">
                <a className="mrq-btn" href="/post">Edit Request</a>
                <button className="mrq-btn" onClick={() => patch({ status: paused ? 'new' : 'paused' })}>
                  <MaterialIcon icon={paused ? 'play_arrow' : 'pause'} className="text-[16px]" /> {paused ? 'Resume' : 'Pause'} Request
                </button>
              </div>
            </section>

            {/* ── possible move paths (webs, not swaps) ── */}
            <section className="mymr-card">
              <div className="mymr-card__head">
                <h2>Possible Move Paths</h2>
                <a className="cxb-link" href="/connections">View Connection Board →</a>
              </div>
              <p className="mymr-cardsub">
                We&apos;re comparing your request across <b>{activeCount} active requests</b> to
                find direct connections and multi-step move paths.
              </p>

              {/* multi-party paths first — the unlock */}
              {paths.map((p, i) => (
                <div key={i} className="mymr-match is-path">
                  <div className="mymr-match__top">
                    <span className="mymr-badge is-path">{p.chain_len}-Step Move Path</span>
                  </div>
                  <div className="mymr-path">
                    {p.labels.map((l, j) => (
                      <span key={j} className="mymr-path__hop">
                        <b>{l}</b>
                        {j < p.labels.length - 1 && <MaterialIcon icon="arrow_forward" className="text-[14px]" />}
                      </span>
                    ))}
                    <span className="mymr-path__hop"><MaterialIcon icon="replay" className="text-[14px]" /> loop closes</span>
                  </div>
                  <div className="mymr-why">
                    <span className="mymr-why__h">Why this path may work</span>
                    <ul>
                      <li><MaterialIcon icon="check" className="text-[13px]" /> Each poster wants where the next one is</li>
                      <li><MaterialIcon icon="check" className="text-[13px]" /> No one needs a direct swap — the loop completes the move</li>
                      <li><MaterialIcon icon="check" className="text-[13px]" /> {p.chain_len} households could all move</li>
                    </ul>
                  </div>
                  <div className="mymr-match__foot">
                    <button className="mrq-btn" disabled title="Coming soon">Request Intros</button>
                  </div>
                </div>
              ))}

              {/* direct connections */}
              {direct.map((d) => (
                <div key={d.other_id} className="mymr-match">
                  <div className="mymr-match__top">
                    <span className="mymr-badge">Direct</span>
                    <b className="mymr-match__loc">{d.other_label}</b>
                    <span className="mymr-pct">{d.match_pct}% Match</span>
                    {d.mutual && <span className="mymr-badge is-mutual">Two-way</span>}
                  </div>
                  <div className="mymr-match__body">
                    <span>
                      {d.direction === 'inbound'
                        ? <>They want <b>{d.other_to_label}</b> — near your current area.</>
                        : <>They&apos;re in <b>{d.other_label}</b> — where you want to go. They want <b>{d.other_to_label}</b>.</>}
                    </span>
                    {d.other_move_condition && <em>&ldquo;{d.other_move_condition}&rdquo;</em>}
                  </div>
                  <div className="mymr-why">
                    <span className="mymr-why__h">Why it matched</span>
                    <ul>
                      <li><MaterialIcon icon="check" className="text-[13px]" /> {d.direction === 'inbound'
                        ? 'One poster wants your current area'
                        : d.matched_destination
                          ? <>Matched on your <b>{d.matched_destination}</b> destination</>
                          : 'Another poster has your target area'}</li>
                      {(d.shared_tags ?? []).map((t) => (
                        <li key={t}><MaterialIcon icon="check" className="text-[13px]" /> You both want: {t.replace(/-/g, ' ')}</li>
                      ))}
                      {d.mutual && <li><MaterialIcon icon="check" className="text-[13px]" /> The connection runs both ways</li>}
                    </ul>
                  </div>
                  <div className="mymr-match__foot">
                    <button className="mrq-btn" disabled title="Coming soon">View Details</button>
                    <button className="mrq-btn mrq-btn--primary" disabled title="Coming soon">Request Intro</button>
                  </div>
                </div>
              ))}

              {paths.length === 0 && direct.length === 0 && (
                <div className="mymr-empty">
                  <MaterialIcon icon="radar" className="text-[22px]" />
                  <b>No path yet — the map is listening.</b>
                  <span>New requests are added every day. We&apos;ll reach you when a direct connection or a move path appears.</span>
                </div>
              )}

              <div className="mymr-invite">
                <span><b>No perfect path yet?</b> Every new request makes more paths possible.</span>
                <a className="mrq-btn" href="/post">Invite Someone <MaterialIcon icon="ios_share" className="text-[15px]" /></a>
              </div>
            </section>

            {/* ── dormant hooks ── */}
            <div className="mymr-soon">
              {[
                { icon: 'chat_bubble', t: 'Messages', d: 'When a connection accepts an intro, your conversation will appear here.' },
                { icon: 'groups', t: 'Build Your Team', d: "When you're ready — lenders, inspectors, and more, competing for you." },
                { icon: 'description', t: 'Documents', d: 'Offers, disclosures, and important documents will live here.' },
              ].map((c) => (
                <div key={c.t} className="mymr-sooncard">
                  <MaterialIcon icon={c.icon} className="text-[20px]" />
                  <b>{c.t} <em>Soon</em></b>
                  <span>{c.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── right rail ── */}
          <aside className="mymr-side">
            <section className="mymr-card">
              <div className="mymr-card__head">
                <h2>Verification Status</h2>
                <span className={`mymr-pill ${want.verification_status === 'verified' ? 'is-active' : 'is-warn'}`}>
                  {want.verification_status === 'verified' ? 'Verified' : 'Not Verified'}
                </span>
              </div>
              {want.has_current_home ? (
                <>
                  <p className="mymr-cardsub">Private draft. Verify to publish your property or choose an alias.</p>
                  <div className="mymr-vmethod">
                    <MaterialIcon icon="mail" className="text-[20px]" />
                    <div>
                      <b>{METHOD_LABEL[want.verification_method ?? 'later']}</b>
                      <span>
                        {want.verification_method === 'mail'
                          ? 'Your verification code will be mailed to the property address. Enter it here when it arrives.'
                          : 'Complete this method to verify your authority privately.'}
                      </span>
                    </div>
                  </div>
                  <button className="mrq-btn mrq-btn--primary" style={{ width: '100%' }} disabled title="Your code is on the way">
                    Enter Mail Code
                  </button>
                  <div className="mymr-vothers">
                    {Object.entries(METHOD_LABEL)
                      .filter(([k]) => k !== (want.verification_method ?? 'later'))
                      .map(([k, label]) => (
                        <button key={k} className="mymr-vother" onClick={() => patch({ verificationMethod: k })}>
                          <span>{label}</span><MaterialIcon icon="chevron_right" className="text-[16px]" />
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <p className="mymr-cardsub">No property attached — nothing to verify. Your want participates in matching as-is.</p>
              )}
            </section>

            <section className="mymr-card">
              <div className="mymr-card__head"><h2>Visibility &amp; Identity</h2></div>
              <div className="mymr-vis">
                <div className="mymr-vis__row is-current">
                  <MaterialIcon icon="lock" className="text-[16px]" />
                  <div><b>Private Draft <em>Current</em></b><span>Only you can see this request.</span></div>
                </div>
                <div className="mymr-vis__row is-locked">
                  <MaterialIcon icon="person" className="text-[16px]" />
                  <div><b>Publish Anonymously</b><span>Shown as &ldquo;Verified Property Poster.&rdquo;</span></div>
                </div>
                <div className="mymr-vis__row is-locked">
                  <MaterialIcon icon="badge" className="text-[16px]" />
                  <div><b>Choose an Alias</b><span>Examples: Lemoore Navy Family, Central Valley Owner.</span></div>
                </div>
              </div>
              <p className="mymr-finelock"><MaterialIcon icon="lock" className="text-[13px]" /> Verify first to change visibility. Your alias may appear in possible move paths — your identity stays private unless you reveal it.</p>
            </section>

            <section className="mymr-card">
              <div className="mymr-card__head"><h2>Account &amp; Access</h2></div>
              <p className="mymr-cardsub">Save your request permanently and access it from any device.</p>
              <button className="mrq-btn" style={{ width: '100%' }} onClick={() => signInWithGoogle()}>
                Continue with Google
              </button>
              <button className="mrq-btn" style={{ width: '100%', marginTop: 8 }} disabled title="Coming soon">
                <MaterialIcon icon="mail" className="text-[16px]" /> Send Me a Return Link
              </button>
              <p className="mymr-finelock"><MaterialIcon icon="lock" className="text-[13px]" /> No password required unless you want one.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
