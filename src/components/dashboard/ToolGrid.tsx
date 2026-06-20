'use client';

// ── ToolGrid ──────────────────────────────────────────────────────────
//
// The grid of tool cards (2D Map, Contracts, Contacts, Orbit Video, Skip
// Trace, Direct Mail, Call Prospects). LOCKED 2026-06-19: these live on the
// FRONT PAGE now, not a separate dashboard — everything is gated at the
// action, so the tools are shown up front (try-before-buy). See
// memory/project_one_page_tools_on_landing + project_access_monetization_tiers.
//
// Icons:
//   - layers[]   → stacked animated (e.g. the 2D-map pin bobs)
//   - assemble{} → hover-assemble (full image at rest; pieces fly in on hover)
//   - else       → Material glyph fallback
//
// Mobile: no hover, so each card's fly-in assembly triggers on SCROLL-INTO-
// VIEW (IntersectionObserver adds .in-view), and a tap gives a fast press
// reaction (.dash-card:active scale). Desktop keeps hover-to-assemble.

import { useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface IconLayer { src: string; anim?: string; }
interface HoverAssemble { full: string; pieces: { src: string; fly: string }[]; }

export interface Tool {
  href: string;
  icon: string;
  art: string;
  layers?: IconLayer[];
  assemble?: HoverAssemble;
  title: string;
  sub: string;
  view?: '2d' | '3d';
  flagship?: boolean;
}

export const TOOLS: Tool[] = [
  {
    href: '/map?view=2d', icon: 'map', art: 'map-2d', title: 'Explore the 2D Map',
    sub: 'Zoom in, search, and explore neighborhoods in 2D.', view: '2d',
    layers: [
      { src: '/dashboard/icons/map-2d_base.png' },
      { src: '/dashboard/icons/map-2d_pin.png', anim: 'ic-bob' },
    ],
  },
  // CAR/NAR sidestep MOAT — contracts, disclosures + make an offer.
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
  // Contacts & Lists — includes import & geocode (one contacts hub).
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
  {
    href: '/campaigns/commercials', icon: 'smart_display', art: 'orbit-video', title: 'Orbit Listing Video',
    sub: 'Create stunning listing videos with Orbit Property View.',
    assemble: {
      full: '/dashboard/icons/orbit_full.png',
      pieces: [
        { src: '/dashboard/icons/orbit_house.png',  fly: 'fly-up'   },
        { src: '/dashboard/icons/orbit_player.png', fly: 'fly-left' },
        { src: '/dashboard/icons/orbit_cam.png',    fly: 'fly-pen'  },
        { src: '/dashboard/icons/orbit_ring.png',   fly: 'fly-ring' },
      ],
    },
  },
  { href: '/leads', icon: 'travel_explore', art: 'skip-trace', title: 'Prospect with Skip Trace', sub: 'Find phone numbers, emails, and addresses with ease.' },
  { href: '/campaigns', icon: 'mail', art: 'mail', title: 'Direct Mail Campaigns', sub: 'Design, target, and send high-impact mailers.' },
  { href: '/campaigns', icon: 'call', art: 'call', title: 'Call Prospects', sub: 'Dial from any property, track conversations, stay organized.' },
];

export default function ToolGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  // Mobile: trigger each card's fly-in assembly as it scrolls into view.
  // (Desktop uses hover; this adds .in-view which the CSS uses on touch.)
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('.dash-card'));
    if (!('IntersectionObserver' in window)) {
      cards.forEach((c) => c.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4, rootMargin: '0px 0px -8% 0px' },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="dash-grid" ref={gridRef}>
      {TOOLS.map((t) => (
        <a
          key={t.title}
          href={t.href}
          className="dash-card"
          data-flagship={t.flagship ? '1' : undefined}
        >
          <div className="dash-card__icon" data-illustrated={(t.layers || t.assemble) ? '1' : undefined}>
            {t.assemble ? (
              <span className="dash-card__assemble">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.assemble.full} alt="" className="dash-card__art dash-card__assemble-full" draggable={false} />
                {t.assemble.pieces.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.src} src={p.src} alt="" className={`dash-card__art dash-card__assemble-piece ${p.fly}`} draggable={false} />
                ))}
              </span>
            ) : t.layers ? (
              t.layers.map((l) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={l.src} src={l.src} alt="" className={`dash-card__art ${l.anim ?? ''}`} draggable={false} />
              ))
            ) : (
              <MaterialIcon icon={t.icon} className="dash-card__glyph" />
            )}
          </div>
          <div className="dash-card__h">{t.title}</div>
          <p className="dash-card__p">{t.sub}</p>
          <span className="dash-card__arrow"><MaterialIcon icon="arrow_forward" className="text-[18px]" /></span>
        </a>
      ))}
    </div>
  );
}
