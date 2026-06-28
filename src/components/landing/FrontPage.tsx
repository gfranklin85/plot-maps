'use client';

import AppHeader from '@/components/layout/AppHeader';
import OrbitSection from '@/components/landing/OrbitSection';
import ToolGrid from '@/components/dashboard/ToolGrid';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { signInWithGoogle } from '@/lib/signIn';
import { useAuth } from '@/lib/auth-context';

// ── FrontPage ─────────────────────────────────────────────────────────
//
// The unified public front door for PlotMaps + Position Realty.
// Hero message = the reframe (the stance): "It only happens because of you."
// Same beautiful layout/styling; the message leads with the plain fact, not a
// feature. memory/feedback_reveal_facts_not_hype_voice. Sections below
// (intent network, tools, agents, features, close) are unchanged.
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
const CREW = '/landing/crew';

// Sky layer — Greg's real sky (same 2560×1440 canvas) sits behind the
// platform. Set to null to fall back to the CSS gradient sky.
const SKY_SRC: string | null = `${HERO}/sky.svg`;

// The vendor-crew scene — 9 layered SVGs (same 1920×1080 canvas, full-frame
// pieces that self-align at inset-0). Order is back→front (Greg's numbering):
// the 3 rear floating callout cards, then the buyer family on the column,
// then the 5 vendors on surrounding pillars. The 3 cards drift gently; the
// figures stay grounded. memory/feedback_screen_is_always_2d.
const SCENE_LAYERS: { src: string; anim: string; alt: string }[] = [
  { src: `${CREW}/01-card-team-ready.svg`,       anim: 'float-card-a', alt: '' },
  { src: `${CREW}/02-card-you-choose.svg`,       anim: 'float-card-b', alt: '' },
  { src: `${CREW}/03-card-private-estimates.svg`, anim: 'float-card-c', alt: '' },
  { src: `${CREW}/04-family.svg`,                anim: '',             alt: 'A homebuying family standing on a raised column' },
  { src: `${CREW}/05-vendor-1.svg`,             anim: '',             alt: '' },
  { src: `${CREW}/06-vendor-5.svg`,             anim: '',             alt: '' },
  { src: `${CREW}/07-vendor-2.svg`,             anim: '',             alt: '' },
  { src: `${CREW}/08-vendor-4.svg`,             anim: '',             alt: '' },
  { src: `${CREW}/09-vendor-3.svg`,             anim: '',             alt: '' },
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
              <span className="fp-pill">FREE FOR BUYERS &amp; AGENTS</span>
              <h1 className="fp-head font-headline">
                Build Your Position.
                <br />
                <span className="accent">Before You Offer.</span>
              </h1>
              <p className="fp-sub">
                Get your people in place before the offer ever goes in. Post your
                goals and criteria, and the platform puts you on the radar of the
                local pros who do this work — lenders, inspectors, insurers — who
                watch the board and bring private estimates to <b>you</b>. You
                review, you choose, you move with leverage.
              </p>
              {/* the three concrete steps (the mechanism, not magic) */}
              <ul className="fp-checks">
                <li><MaterialIcon icon="check_circle" className="fp-checks__i" /> Post your goals — you go on the board.</li>
                <li><MaterialIcon icon="check_circle" className="fp-checks__i" /> Pros watching the board bring private estimates.</li>
                <li><MaterialIcon icon="check_circle" className="fp-checks__i" /> You pick the team and terms that fit.</li>
              </ul>
              <div className="fp-cta-row">
                <a href="/bullpen" className="fp-cta fp-cta--primary">
                  Get started — free <span aria-hidden>→</span>
                </a>
                <button type="button" className="fp-cta fp-cta--ghost" onClick={() => goMap('3d')}>
                  Explore the map <span aria-hidden>→</span>
                </button>
              </div>
              {/* honest credibility + the no-vendor-ads promise */}
              <div className="fp-cred">
                <span className="fp-cred__seal"><MaterialIcon icon="verified" /></span>
                <p className="fp-cred__text">
                  <b>Free for buyers. Free for agents. No public vendor ads.</b>
                  <br />Built by Gregory M. Franklin · CA broker · DRE #02090737 · Position Realty.
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

      {/* ════ THE REPOSITION — the buyer-elevation platform ════
          Right under the hero: explain + show how the dynamic gets put back
          where it belongs — balanced toward the one buying. Steel-calm,
          structural; reveal the fact, don't hype.
          Frameless + sky: no boxes — people just stand in the open sky (the
          screen IS the sky, our locked design language).
          memory/feedback_reveal_facts_not_hype_voice + feedback_screen_is_always_2d */}
      <section className="fp-reposition">
        <div className="fp-reposition__sky" aria-hidden />
        <div className="fp__wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="fp-intent__head">
            <div className="fp-intent__eyebrow">The reposition</div>
            <h2 className="fp-intent__h">The dynamic, put back where it belongs.</h2>
            <p className="fp-intent__lede">
              For as long as anyone can remember, the person buying has been cast
              as the one who chases — applying, qualifying, hoping to be picked.
              That was always backwards. You are the reason the market moves. So
              here, the market moves toward you.
            </p>
          </div>

          <div className="fp-reposition__grid">
            {/* the rebalance, told plainly — no card, just text in the sky */}
            <div className="fp-reposition__copy">
              <h3 className="fp-reposition__h">You stand still. The market comes to you.</h3>
              <p className="fp-reposition__p">
                Instead of going door to door telling your story over and over,
                you say what you want once — and the people who can deliver it
                step toward you, on your terms. No begging. No chasing. The
                gravity simply runs the right direction.
              </p>
              <ul className="fp-flist">
                <li><span className="chk" aria-hidden>✓</span> You say what you want, plainly — once.</li>
                <li><span className="chk" aria-hidden>✓</span> Lenders, inspectors, insurers come compete to serve you.</li>
                <li><span className="chk" aria-hidden>✓</span> You review, you choose. They came to you.</li>
              </ul>
              <a href="/bullpen" className="fp-cta fp-cta--primary" style={{ marginTop: 22 }}>
                Step into the Bullpen <span aria-hidden>→</span>
              </a>
            </div>

            {/* The elevation, floating in the sky — no frame. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/buyers-on-platform.png"
              alt="Buyers standing elevated on a platform in the sky while agents and providers on lower tiers reach up toward them"
              className="fp-reposition__img"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ════ THE BROKERAGE — independent by architecture, protective by design ════
          Steel-calm, NOT a crusade. The position is immovable. We fix unjust
          architecture + protect agents — never throw rocks at a building.
          memory/feedback_reveal_facts_not_hype_voice + project_operator_tier_culture_thesis */}
      <section className="fp-section" style={{ background: '#fafbff' }}>
        <div className="fp__wrap">
          <div className="fp-intent__head">
            <div className="fp-intent__eyebrow">Where we stand</div>
            <h2 className="fp-intent__h">A brokerage that stands on its own.</h2>
            <p className="fp-intent__lede">
              We don&apos;t lean on the MLS, and we don&apos;t take our marching
              orders from the trade groups. Not out of spite — out of standards.
              When the architecture is built to extract, you don&apos;t work
              inside it and hope; you build a better one and stand on it. Ours is
              immovable.
            </p>
          </div>

          <div className="fp-features">
            <div className="fp-fcard">
              <h3 className="fp-fcard__h">Our own instruments.</h3>
              <p className="fp-fcard__p">
                We write our own contracts and our own disclosures — in plain
                language a normal person actually understands, not fine print
                built to be initialed and forgotten. The deal is honest because
                it&apos;s legible.
              </p>
            </div>
            <div className="fp-fcard fp-fcard--pos">
              <h3 className="fp-fcard__h">Built to protect our agents.</h3>
              <p className="fp-fcard__p">
                No constant overhead fees nickel-and-diming you for the privilege
                of working. We organize the operation for efficiency — which
                lowers your liability, because the system carries the parts that
                used to leave you exposed. And above all: we care more about who
                you are than the real estate you sell.
              </p>
              <a href="/join-position" className="fp-fcard__cta">For agents →</a>
            </div>
          </div>
        </div>
      </section>

      {/* ════ ORBIT PROPERTY — the free front-door scout, live + compact ════
          The working tool lives HERE on the landing page (not a lonely page).
          memory/project_orbit_property_agent_magnet */}
      <OrbitSection />

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
            {/* HONEST social proof: no fake testimonials. This is a real
                "be one of the first" invite; real users' faces + words drop
                in here as the network grows.
                memory/project_credibility_markers_honest */}
            <div className="fp-quote fp-quote--founding">
              <div className="fp-quote__badge">Founding members</div>
              <div className="fp-quote__q">
                Plot is brand new — built by a working California broker, not a
                tech tourist. The first owners and buyers on the map shape what
                it becomes. Be one of them.
              </div>
              <div className="fp-quote__by">
                <span className="fp-quote__seal"><MaterialIcon icon="verified" /></span>
                <div>
                  <div className="fp-quote__name">Gregory M. Franklin</div>
                  <div className="fp-quote__role">Broker · CA DRE #02090737 · Position Realty</div>
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
