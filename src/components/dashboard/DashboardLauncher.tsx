'use client';

// ── DashboardLauncher ─────────────────────────────────────────────────
//
// The logged-in home — "Choose what you want to do." The back-out office
// reimagined in the LIGHT app language (NOT the dark room): same calm
// sky-blue surface as the front page, so landing → dashboard → tools feel
// like one continuous place. A featured "Fly the 3D Map" hero card (with
// the same floating land-platform scene), then a grid of tool cards that
// FLY IN on load (staggered rise + settle), then a trust strip.
//
// memory/project_front_page_locked (consistent app background, blue accent),
// memory/project_desk_surface_backout_ui (the back-out, now in light).

import MaterialIcon from '@/components/ui/MaterialIcon';
import AppHeader from '@/components/layout/AppHeader';

const HERO = '/dashboard/hero';

// The mini floating scene reused inside the featured fly card.
const FLY_LAYERS = [
  { src: `${HERO}/cloud-2.svg`, anim: 'float-cloud-b' },
  { src: `${HERO}/cloud-1.svg`, anim: 'float-cloud-a' },
  { src: `${HERO}/island.svg`, anim: 'float-island' },
  { src: `${HERO}/card-line.svg`, anim: 'float-card-b' },
  { src: `${HERO}/cards.svg`, anim: 'float-card-a' },
];

/** A stacked, animated icon: each layer is the FULL icon canvas with one
    piece visible (others transparent) so they self-align — same trick as
    the hero scene. `anim` gives the layer its gentle loop (e.g. the pin
    bobs over the static map base). */
interface IconLayer { src: string; anim?: string; }

/** A hover-assemble icon: at REST the full composed image shows; on HOVER
    the full fades and the individual pieces FLY IN from offsets + assemble.
    `full` is the still; `pieces` are the parts, each with a fly-in class
    that defines its incoming direction. */
interface HoverAssemble { full: string; pieces: { src: string; fly: string }[]; }

interface Tool {
  href: string;
  /** Material glyph fallback (shown until the real illustration drops in). */
  icon: string;
  /** real illustration asset key — looks for /dashboard/icons/<art>.png.
      When Greg exports the icon set, dropping the PNGs in that folder makes
      them appear automatically; until then the Material glyph shows. */
  art: string;
  /** layered animated icon (overrides flat `art` when present). */
  layers?: IconLayer[];
  /** hover-assemble icon (full image at rest, pieces fly in on hover). */
  assemble?: HoverAssemble;
  title: string;
  sub: string;
  /** map cards switch view rather than navigate fresh */
  view?: '2d' | '3d';
  /** the CAR/NAR-sidestep moat card — gets the distinguished treatment. */
  flagship?: boolean;
}

const TOOLS: Tool[] = [
  {
    href: '/map?view=2d', icon: 'map', art: 'map-2d', title: 'Explore the 2D Map',
    sub: 'Zoom in, search, and explore neighborhoods in 2D.', view: '2d',
    // layered + alive: map base sits, the pin bobs, the cloud drifts.
    layers: [
      { src: '/dashboard/icons/map-2d_base.png' },
      { src: '/dashboard/icons/map-2d_pin.png', anim: 'ic-bob' },
    ],
  },
  // The CAR/NAR sidestep MOAT — author offers, disclosures AND make an
  // offer (the money cockpit) in plain English. Make-an-Offer folded in
  // here (it's one instrument inside the builder). Hover-assemble icon.
  {
    href: '/forms', icon: 'description', art: 'forms', title: 'Build Contracts & Forms',
    sub: 'Draft offers, disclosures & make an offer — plain English, no legalese.', flagship: true,
    assemble: {
      full: '/dashboard/icons/forms_full.png',
      pieces: [
        { src: '/dashboard/icons/forms_base.png',   fly: 'fly-up'    },
        { src: '/dashboard/icons/forms_back.png',   fly: 'fly-left'  },
        { src: '/dashboard/icons/forms_papers.png', fly: 'fly-right' },
        { src: '/dashboard/icons/forms_pen.png',    fly: 'fly-pen'   },
        { src: '/dashboard/icons/forms_check.png',  fly: 'fly-pop'   },
      ],
    },
  },
  // Contacts & Lists — now INCLUDES import & geocode (one contacts hub).
  // Uses the rich import-and-geocode hover-assemble icon.
  {
    href: '/imports', icon: 'groups', art: 'import', title: 'Contacts & Lists',
    sub: 'Import, geocode, and build lists to target the right people.',
    assemble: {
      full: '/dashboard/icons/import_full.png',
      pieces: [
        { src: '/dashboard/icons/import_base.png',   fly: 'fly-up'    },
        { src: '/dashboard/icons/import_cards.png',  fly: 'fly-left'  },
        { src: '/dashboard/icons/import_map.png',    fly: 'fly-right' },
        { src: '/dashboard/icons/import_upload.png', fly: 'fly-pen'   },
        { src: '/dashboard/icons/import_arrow.png',  fly: 'fly-arrow' },
        { src: '/dashboard/icons/import_pin.png',    fly: 'fly-pin'   },
      ],
    },
  },
  { href: '/campaigns/commercials', icon: 'smart_display', art: 'orbit-video', title: 'Orbit Listing Video', sub: 'Create stunning listing videos with Orbit Property View.' },
  { href: '/leads', icon: 'travel_explore', art: 'skip-trace', title: 'Prospect with Skip Trace', sub: 'Find phone numbers, emails, and addresses with ease.' },
  { href: '/campaigns', icon: 'mail', art: 'mail', title: 'Direct Mail Campaigns', sub: 'Design, target, and send high-impact mailers.' },
  // Call & Outreach + Call Prospects merged → one dialer card.
  { href: '/campaigns', icon: 'call', art: 'call', title: 'Call Prospects', sub: 'Dial from any property, track conversations, stay organized.' },
];

// Until Greg exports the real illustration set, every card falls back to
// its Material glyph. Flip this to true per-card automatically by dropping
// /public/dashboard/icons/<art>.png — the <img> onError swaps back to the
// glyph if the file isn't there yet.

export default function DashboardLauncher() {
  return (
    <div className="fp app-surface">
      <AppHeader variant="app" />
      <div className="dash">
        <div className="dash__wrap">
          {/* ── top band: intro + featured fly card ── */}
          <div className="dash-top">
            <div className="dash-intro">
              <div className="dash-intro__eyebrow">Welcome to PlotMaps</div>
              <h1 className="dash-intro__h font-headline">Choose what<br />you want to do</h1>
              <p className="dash-intro__p">
                Powerful tools to help you explore, connect, and take action in
                every neighborhood.
              </p>
            </div>

            <div className="dash-fly">
              <div className="dash-fly__scene" aria-hidden>
                {FLY_LAYERS.map((l) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={l.src} src={l.src} alt="" className={l.anim} draggable={false} />
                ))}
              </div>
              <div className="dash-fly__h">Fly the 3D Map</div>
              <p className="dash-fly__p">Aerial 3D flyover with rich property and neighborhood insights.</p>
              <a className="dash-fly__btn" href="/map?view=3d">
                Open 3D Map <span aria-hidden>→</span>
              </a>
            </div>
          </div>

          {/* ── tool grid (flies in, staggered) ── */}
          <div className="dash-grid">
            {TOOLS.map((t) => (
              <a
                key={t.title}
                href={t.href}
                className="dash-card"
                data-flagship={t.flagship ? '1' : undefined}
              >
                <div className="dash-card__icon" data-illustrated={(t.layers || t.assemble) ? '1' : undefined}>
                  {t.assemble ? (
                    // hover-assemble: full image at rest; on hover the full
                    // fades and the pieces fly in from offsets + assemble.
                    <span className="dash-card__assemble">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.assemble.full} alt="" className="dash-card__art dash-card__assemble-full" draggable={false} />
                      {t.assemble.pieces.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p.src} src={p.src} alt="" className={`dash-card__art dash-card__assemble-piece ${p.fly}`} draggable={false} />
                      ))}
                    </span>
                  ) : t.layers ? (
                    // layered, animated illustration — each layer full-canvas
                    // so they self-align; the pin bobs, the cloud drifts.
                    t.layers.map((l) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={l.src}
                        src={l.src}
                        alt=""
                        className={`dash-card__art ${l.anim ?? ''}`}
                        draggable={false}
                      />
                    ))
                  ) : (
                    // No real illustration yet → clean Material glyph only.
                    <MaterialIcon icon={t.icon} className="dash-card__glyph" />
                  )}
                </div>
                <div className="dash-card__h">{t.title}</div>
                <p className="dash-card__p">{t.sub}</p>
                <span className="dash-card__arrow"><MaterialIcon icon="arrow_forward" className="text-[18px]" /></span>
              </a>
            ))}
          </div>

          {/* ── trust strip ── */}
          <div className="dash-trust">
            <div className="dash-trust__lead">
              <span className="ic" style={{ color: 'var(--plot-brand)' }}><MaterialIcon icon="shield" /></span>
              <span>
                <b>Built for real estate professionals.</b>
                Trusted by agents, investors, and teams across the country.
              </span>
            </div>
            <div className="dash-trust__item"><span className="ic"><MaterialIcon icon="groups" className="text-[18px]" /></span> Trusted by thousands of real estate pros</div>
            <div className="dash-trust__item"><span className="ic"><MaterialIcon icon="verified_user" className="text-[18px]" /></span> Your data is secure and never shared</div>
            <div className="dash-trust__item"><span className="ic"><MaterialIcon icon="cloud" className="text-[18px]" /></span> Access anywhere, on any device</div>
          </div>
        </div>
      </div>
    </div>
  );
}
