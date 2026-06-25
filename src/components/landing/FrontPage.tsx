'use client';

import AppHeader from '@/components/layout/AppHeader';
import ToolGrid from '@/components/dashboard/ToolGrid';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { signInWithGoogle } from '@/lib/signIn';
import { useAuth } from '@/lib/auth-context';

// ── FrontPage ─────────────────────────────────────────────────────────
//
// The unified public front door for PlotMaps + Position Realty.
// "See every home like never before. / Move when you're ready."
//
// PlotMaps is the world/experience (universal — explore, prospect,
// relocate, scout a new city, fly your own backyard, the coming social
// layer); Position is the licensed brokerage that helps you ACT. PlotMaps
// is the headline voice; Position stays quiet (the green-vs-blue split in
// the feature cards + the footer compliance). See:
//   memory/project_plot_vision, project_plot_maps_position_hierarchy,
//   project_two_layer_audience_strategy, project_communication_layer_thesis.
//
// DESIGN: light/white, generous space, BLUE (#1349d4) as the single accent
// (the reference language). Depth comes from ONE floating sky-platform scene —
// the isometric land island bobbing in the sky with data cards + drifting
// clouds. Layers are Greg's Canva exports (same 2560×1440 canvas → they
// self-align). The SKY is its own swappable layer: today it's the hero
// gradient background; drop a sky PNG into SKY_SRC and it becomes a real
// layer with zero other changes. memory/feedback_screen_is_always_2d.

const HERO = '/dashboard/hero';

// Sky layer — Greg's real sky (same 2560×1440 canvas) sits behind the
// platform. Set to null to fall back to the CSS gradient sky.
const SKY_SRC: string | null = `${HERO}/sky.svg`;

// Floating land-platform scene — each layer is the full 2560×1440 canvas
// with one piece in place, so stacking at inset-0 reproduces the exact
// composition. `anim` is its gentle loop.
const SCENE_LAYERS: { src: string; anim: string; alt: string }[] = [
  { src: `${HERO}/cloud-3.svg`,   anim: 'float-cloud-c', alt: '' },
  { src: `${HERO}/cloud-2.svg`,   anim: 'float-cloud-b', alt: '' },
  { src: `${HERO}/cloud-1.svg`,   anim: 'float-cloud-a', alt: '' },
  { src: `${HERO}/island.svg`,    anim: 'float-island',  alt: 'Map of the market floating in the sky' },
  { src: `${HERO}/card-line.svg`, anim: 'float-card-b',  alt: '' },
  { src: `${HERO}/cards.svg`,     anim: 'float-card-a',  alt: '' },
];

export default function FrontPage() {
  const { user } = useAuth();
  // CTAs are auth-aware: a signed-in user goes straight to the action;
  // a logged-out user goes through Google sign-in first.
  const goMap = (view: '2d' | '3d') => {
    if (user) window.location.href = `/map?view=${view}`;
    else signInWithGoogle();
  };

  return (
    <div className="fp">
      {/* ════ HEADER (shared with the dashboard for one consistent chrome) ════ */}
      <AppHeader variant="public" />

      {/* ════ HERO ════ */}
      <section className="fp-hero">
        {/* real sky fills the whole hero band (edge to edge) so it reads as
            open sky, not a boxed blue card. Falls back to the gradient. */}
        {SKY_SRC ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={SKY_SRC} alt="" aria-hidden className="fp-hero__sky" draggable={false} />
        ) : (
          <div className="fp-hero__bg" />
        )}
        {/* soft white fade at the bottom so the sky melts into the page */}
        <div className="fp-hero__fade" />
        <div className="fp__wrap">
          <div className="fp-hero__grid">
            {/* left — the live headline */}
            <div style={{ flex: 1, position: 'relative', zIndex: 2 }}>
              <span className="fp-pill">EXPLORE · PROSPECT · MOVE</span>
              <h1 className="fp-head font-headline">
                See every home
                <br />
                like never before.
                <span className="accent">Move when you&apos;re ready.</span>
              </h1>
              <p className="fp-sub">
                <b>PlotMaps</b> lets you fly any neighborhood in the country —
                explore the land, read the market, and find your next move.
                When it&apos;s time, <b>Position</b> is the brokerage that helps
                you act.
              </p>
              {/* ONE hero button — the universal hook (fly the map). The
                  intent-network story (claim your home / find your next) lives
                  in its own section below. memory/project_intent_network_two_sided */}
              <div className="fp-cta-row">
                <button type="button" className="fp-cta fp-cta--primary" onClick={() => goMap('3d')}>
                  Explore the map <span aria-hidden>→</span>
                </button>
              </div>
              <div className="fp-trust">
                <div className="fp-trust__avatars" aria-hidden>
                  <span /><span /><span /><span />
                </div>
                <p className="fp-trust__text">
                  Trusted by buyers, owners, investors &amp; agents
                  <br />exploring land across the country.
                </p>
              </div>
            </div>

            {/* right — the floating sky-platform scene */}
            <div className="fp-hero__scene-col">
              <div className="fp-scene">
                {SCENE_LAYERS.map((l) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={l.src}
                    src={l.src}
                    alt={l.alt}
                    aria-hidden={l.alt ? undefined : true}
                    className={`fp-scene__layer ${l.anim}`}
                    draggable={false}
                  />
                ))}
                {/* The land plate IS the hero — no listing card over it.
                    Nothing obstructs the floating world. */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ THE INTENT NETWORK — "Claim your home. Name your next one." ════
          The two-sided moat: owners claim their house + post status/sell
          criteria (kills cold calls, feeds the right agents); buyers post
          buy-box + destination; Plot matches them nationwide. Two paths.
          memory/project_intent_network_two_sided */}
      <section id="intent" className="fp-section fp-intent">
        <div className="fp__wrap">
          <div className="fp-intent__head">
            <div className="fp-intent__eyebrow">The PlotMaps owner + buyer network</div>
            <h2 className="fp-intent__h">Claim your home. Name your next one.</h2>
            <p className="fp-intent__lede">
              Owners and buyers post what they actually want — and Plot&apos;s
              growing nationwide network turns that into real matches. No cold
              calls. No guessing. Your terms.
            </p>
          </div>

          <div className="fp-intent__paths">
            {/* OWNER side */}
            <div className="fp-intent__card fp-intent__card--owner">
              <span className="fp-intent__icon"><MaterialIcon icon="home" /></span>
              <div className="fp-intent__kicker">I own a home</div>
              <h3 className="fp-intent__card-h">Claim your house. Set your status.</h3>
              <p className="fp-intent__card-p">
                Put your home on the map and tell agents your real plan —
                staying for good, heading to Florida after retirement, leaving
                it to the kids. Two things happen at once:
              </p>
              <ul className="fp-intent__list">
                <li><span className="chk" aria-hidden>✓</span> The pesky cold calls stop — agents stop guessing.</li>
                <li><span className="chk" aria-hidden>✓</span> The right agents bring you your ideal next place, at your price.</li>
                <li><span className="chk" aria-hidden>✓</span> Fly your own neighborhood — and anywhere in the world.</li>
              </ul>
              <button type="button" className="fp-cta fp-cta--primary fp-intent__btn" onClick={() => signInWithGoogle()}>
                Claim your home <span aria-hidden>→</span>
              </button>
            </div>

            {/* BUYER side */}
            <div className="fp-intent__card fp-intent__card--buyer">
              <span className="fp-intent__icon"><MaterialIcon icon="travel_explore" /></span>
              <div className="fp-intent__kicker">I&apos;m looking to buy</div>
              <h3 className="fp-intent__card-h">Put the whole map to work.</h3>
              <p className="fp-intent__card-p">
                State your buy-box and the city you want — Plot puts a nationwide
                network of agents and self-posting owners to work finding it.
              </p>
              <ul className="fp-intent__list">
                <li><span className="chk" aria-hidden>✓</span> Your criteria + destination, matched to real owners.</li>
                <li><span className="chk" aria-hidden>✓</span> Reach homes that aren&apos;t even listed yet.</li>
                <li><span className="chk" aria-hidden>✓</span> Make your next home a reality.</li>
              </ul>
              <button type="button" className="fp-cta fp-cta--primary fp-intent__btn" onClick={() => signInWithGoogle()}>
                Find your next place <span aria-hidden>→</span>
              </button>
            </div>
          </div>

          <p className="fp-intent__note">
            Free to post. Your plan is stored and worked on — not just browsed.
          </p>
        </div>
      </section>

      {/* ════ THE TOOL GRID — the dashboard, right on the front page ════
          Everything is gated at the action (try-before-buy), so the full
          toolset is shown up front. The cards float over a sky backdrop with
          drifting clouds — the floating-in-sky depth carries through here.
          memory/project_one_page_tools_on_landing */}
      <section className="fp-section fp-tools" style={{ paddingTop: 8 }}>
        {/* sky backdrop + drifting clouds (behind the cards) */}
        <div className="fp-tools__sky" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${HERO}/cloud-1.svg`} alt="" className="fp-tools__cloud fp-tools__cloud--1 float-cloud-a" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${HERO}/cloud-2.svg`} alt="" className="fp-tools__cloud fp-tools__cloud--2 float-cloud-b" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${HERO}/cloud-3.svg`} alt="" className="fp-tools__cloud fp-tools__cloud--3 float-cloud-c" draggable={false} />
        </div>
        <div className="dash" style={{ position: 'relative', zIndex: 2 }}>
          <div className="dash__wrap" style={{ paddingTop: 0 }}>
            <div className="fp-eyebrow" style={{ textAlign: 'left' }}>Choose what you want to do</div>
            <h2 className="fp-h2" style={{ textAlign: 'left', marginTop: 6, marginBottom: 24 }}>
              Powerful tools for every neighborhood.
            </h2>
            <ToolGrid />
          </div>
        </div>
      </section>

      {/* ════ FOR AGENTS & BROKERS — the operator doors ════
          The minority who came for the tools. memory/project_dreamer_funnel_buttons */}
      <section className="fp-section fp-agents">
        <div className="fp__wrap">
          <div className="fp-eyebrow" style={{ color: '#334155' }}>For agents &amp; brokers</div>
          <h2 className="fp-h2">The operator&apos;s toolkit.</h2>
          <div className="fp-agents__grid">
            {[
              { href: '/forms', icon: 'history_edu', title: 'Prepare your own contracts', sub: 'Offers & disclosures in plain English — your instruments, not borrowed forms.' },
              { href: '/campaigns/commercials', icon: 'sell', title: 'Post your listing', sub: 'Put a property on the map with an Orbit video and reach real buyers.' },
              { href: '/join-position', icon: 'workspace_premium', title: 'Join Position', sub: 'A brokerage built for operators — the tools others pay for, free.' },
              { href: '/position', icon: 'lan', title: 'See our tech solutions', sub: 'The infrastructure behind Plot — data, prospecting, and the platform.' },
            ].map((a) => (
              <a key={a.title} href={a.href} className="fp-agent-card">
                <span className="fp-agent-card__icon">
                  <MaterialIcon icon={a.icon} />
                </span>
                <div>
                  <div className="fp-agent-card__h">{a.title}</div>
                  <p className="fp-agent-card__p">{a.sub}</p>
                </div>
                <MaterialIcon icon="arrow_forward" className="fp-agent-card__arrow text-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════ TWO FEATURE CARDS ════ */}
      <section className="fp-section">
        <div className="fp__wrap">
          <div className="fp-eyebrow">Powerful tools. Real advantage.</div>
          <h2 className="fp-h2">Explore, analyze, and understand land like never before.</h2>
          <div className="fp-features" style={{ marginTop: 32 }}>
            {/* PlotMaps — green */}
            <div className="fp-fcard fp-fcard--maps">
              <div className="fp-fcard__kicker"><span aria-hidden>◆</span> PLOT MAPS</div>
              <h3 className="fp-fcard__h">Explore land.<br />See every opportunity.</h3>
              <p className="fp-fcard__p">
                Fly any neighborhood in 3D or grind in the 2D work map. Real-time
                data, zoning, comps, and ownership help you read a property from
                every angle — whether you&apos;re buying, selling, or just scouting.
              </p>
              <ul className="fp-flist">
                <li><span className="chk" aria-hidden>✓</span> Interactive 3D flight + 2D work map</li>
                <li><span className="chk" aria-hidden>✓</span> Zoning, flood &amp; topography layers</li>
                <li><span className="chk" aria-hidden>✓</span> Ownership &amp; parcel data</li>
                <li><span className="chk" aria-hidden>✓</span> AI-powered insights &amp; comparables</li>
                <li><span className="chk" aria-hidden>✓</span> Export reports &amp; share with your team</li>
              </ul>
              <a className="fp-fcard__cta" href="/map">Launch Plot Maps <span aria-hidden>→</span></a>
            </div>

            {/* Position — blue (quiet brokerage voice) */}
            <div className="fp-fcard fp-fcard--pos">
              <div className="fp-fcard__kicker"><span aria-hidden>⬡</span> POSITION BROKERAGE</div>
              <h3 className="fp-fcard__h">Our network.<br />Your advantage.</h3>
              <p className="fp-fcard__p">
                From off-market opportunities to full-service representation,
                Position&apos;s licensed brokerage team helps you acquire and sell
                land and homes with confidence.
              </p>
              <ul className="fp-flist">
                <li><span className="chk" aria-hidden>✓</span> Buyer &amp; seller representation</li>
                <li><span className="chk" aria-hidden>✓</span> Off-market &amp; exclusive listings</li>
                <li><span className="chk" aria-hidden>✓</span> Acquisitions &amp; dispositions</li>
                <li><span className="chk" aria-hidden>✓</span> Local market expertise you can trust</li>
                <li><span className="chk" aria-hidden>✓</span> End-to-end transaction support</li>
              </ul>
              <a className="fp-fcard__cta" href="/position">Meet Position <span aria-hidden>→</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* ════ STATS STRIP ════ */}
      <section className="fp-section" style={{ paddingTop: 0 }}>
        <div className="fp__wrap">
          <div className="fp-stats">
            <div className="fp-stat"><div className="fp-stat__n">50,000+</div><div className="fp-stat__l">Parcels mapped</div></div>
            <div className="fp-stat"><div className="fp-stat__n">3D + 2D</div><div className="fp-stat__l">Fly it or work it</div></div>
            <div className="fp-stat"><div className="fp-stat__n">Live</div><div className="fp-stat__l">MLS &amp; public-record data</div></div>
            <div className="fp-stat"><div className="fp-stat__n">CA DRE</div><div className="fp-stat__l">Licensed brokerage</div></div>
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section className="fp-section" style={{ background: '#fafdfb' }}>
        <div className="fp__wrap">
          <div className="fp-eyebrow">How it works</div>
          <h2 className="fp-h2">From a flyover to your next address.</h2>
          <div className="fp-steps">
            {[
              { n: 1, h: 'Explore', p: 'Fly any neighborhood and discover land with real-time data and layers.' },
              { n: 2, h: 'Analyze', p: 'Evaluate the potential with comps, zoning, ownership, and AI insights.' },
              { n: 3, h: 'Connect', p: 'Reach owners and work with Position to line up the right opportunity.' },
              { n: 4, h: 'Move', p: 'Position handles the details so you can focus on what’s next.' },
            ].map((s) => (
              <div className="fp-step" key={s.n}>
                <div className="fp-step__n">{s.n}</div>
                <div className="fp-step__h">{s.h}</div>
                <div className="fp-step__p">{s.p}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CLOSING BANDS ════ */}
      <section className="fp-section">
        <div className="fp__wrap">
          <div className="fp-close">
            <div className="fp-quote">
              <div className="fp-quote__q">
                “PlotMaps changed the way I find and evaluate land. The data is
                accurate, and the Position team is top-notch.”
              </div>
              <div className="fp-quote__by">
                <div className="fp-quote__av" aria-hidden />
                <div>
                  <div className="fp-quote__name">A. Reyes</div>
                  <div className="fp-quote__role">Land investor</div>
                </div>
              </div>
            </div>
            <div className="fp-bigcta">
              <div className="fp-bigcta__h">Your next opportunity is out there.</div>
              <div className="fp-bigcta__p">Start flying the map — it’s free to explore.</div>
              <button type="button" className="fp-bigcta__btn" onClick={() => signInWithGoogle()}>Get started free <span aria-hidden>→</span></button>
            </div>
            <div className="fp-talk">
              <div className="fp-talk__h">Let’s talk.</div>
              <div className="fp-talk__p">
                Questions about a property, or about Position&apos;s brokerage
                services? We&apos;re here.
              </div>
              <a className="fp-talk__link" href="/contact">Contact us <span aria-hidden>→</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* ════ FOOTER / COMPLIANCE ════ */}
      <footer className="fp-foot">
        <div className="fp__wrap">
          {/* the Position MARK (dotless-i signature) for the operated-by
              attribution; the rest is running compliance text. */}
          <div className="fp-foot__brand">
            <span>Operated by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/position-logo.svg" alt="Position" className="fp-foot__position" />
            <span>Realty</span>
          </div>
          <p className="fp-foot__compliance">
            Gregory M. Franklin, Broker · CA DRE #02090737. Equal Housing
            Opportunity. Listing data provided by participating MLSs and used
            under license; PlotMaps is a product of Plot Solutions LLC.
            Public-record and third-party data shown for informational purposes.
            © {''}
            <span suppressHydrationWarning>{new Date().getFullYear()}</span> Plot Solutions LLC.
          </p>
        </div>
      </footer>
    </div>
  );
}
