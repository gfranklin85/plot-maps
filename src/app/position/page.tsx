'use client';

// /position — Position Realty, Inc.: the licensed California brokerage front.
//
// Rewritten 2026-07-09: Position is now a REAL, licensed CA corporation
// (DRE Corp License #02446130, Greg = Real Estate Officer #02090737, issued
// 2026-07-08). Copy says so plainly. Brand palette (--plot-brand, the fp
// design system), NOT the old dark/amber theme. Voice: confident and plain,
// never crusading (memory/the_facts VOICE lock). Two jobs: introduce Position
// to consumers, and give licensed agents a clear path to Join Us.
// memory/the_platform_inventory (Position = product line #2).

import AppHeader from '@/components/layout/AppHeader';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function PositionPage() {
  return (
    <div className="fp">
      <AppHeader variant="public" />

      {/* ── HERO ── */}
      <section className="pos-hero">
        <div className="pos-wrap">
          <div className="fp-eyebrow" style={{ textAlign: 'left' }}>The brokerage behind PlotMaps</div>
          <h1 className="pos-h1">A California brokerage that runs on better tools.</h1>
          <p className="pos-lede">
            Position Realty is a licensed California brokerage. We help people buy,
            sell, and move — with the PlotMaps platform doing the heavy lifting:
            a real map, streamlined paperwork, and a team that competes for you.
          </p>
          <div className="fp-cta-row" style={{ maxWidth: 460 }}>
            <a href="/post" className="fp-cta fp-cta--primary">Post a move <MaterialIcon icon="arrow_forward" className="text-[17px]" /></a>
            <a href="/map?view=3d" className="fp-cta">Open the map</a>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ── */}
      <section className="fp-section pos-band">
        <div className="pos-wrap">
          <div className="fp-eyebrow">What working with Position gives you</div>
          <div className="pos-grid">
            <PosCard icon="map" title="The map"
              body="Fly a real 3D map of any market before you ever drive it — the commute, the schools, the actual feel of the neighborhood." />
            <PosCard icon="groups" title="A team that competes for you"
              body="Post the roles you need — lender, inspector, title — and qualified pros compete for your business. You pick who to work with." />
            <PosCard icon="calculate" title="Your offer, with the real numbers"
              body="Build your own offer and see your closing costs and monthly payment as you go — insurance, loan fees, and escrow pre-filled by your team." />
            <PosCard icon="description" title="Paperwork that walks you through it"
              body="Disclosures and documents run through clean, guided steps in plain English — not dense PDFs you sign without reading." />
            <PosCard icon="hub" title="Connections, not just listings"
              body="Post where you'd go and what you've got. The map checks for a real connection — a direct match, or a multi-home move path." />
            <PosCard icon="smart_display" title="A 3D video of any property"
              body="Order a cinematic 3D orbit of a home and it renders in a couple of hours — great for listings, shareable anywhere." />
          </div>
        </div>
      </section>

      {/* ── FOR AGENTS ── */}
      <section className="fp-section">
        <div className="pos-wrap pos-agents">
          <div>
            <div className="fp-eyebrow" style={{ textAlign: 'left' }}>For licensed agents</div>
            <h2 className="pos-h2">Hang your license somewhere that gives you the tools.</h2>
            <p className="pos-body">
              Position agents work off the PlotMaps platform: map-based prospecting,
              skip-trace and mail from the screen, build-a-team for every client,
              and paperwork that flows through the system — so more of the
              transaction is handled for you, and less rides on hand-built forms.
            </p>
            <ul className="pos-list">
              <li><MaterialIcon icon="check" className="text-[16px]" /> Prospect from the map — see a house, reach the owner, send a real letter.</li>
              <li><MaterialIcon icon="check" className="text-[16px]" /> Guided disclosures and offers built into the platform.</li>
              <li><MaterialIcon icon="check" className="text-[16px]" /> Order 3D property videos in a couple of hours.</li>
            </ul>
            <a href="/join-position" className="fp-cta fp-cta--primary" style={{ marginTop: 8 }}>
              Join Position <MaterialIcon icon="arrow_forward" className="text-[17px]" />
            </a>
          </div>
          <div className="pos-license">
            <div className="pos-license__seal"><MaterialIcon icon="verified" className="text-[26px]" /></div>
            <b>Position Realty, Inc.</b>
            <span>Licensed California real estate corporation</span>
            <dl>
              <div><dt>DRE Corporation License</dt><dd>#02446130</dd></div>
              <div><dt>Designated Officer</dt><dd>Gregory M. Franklin · DRE #02090737</dd></div>
              <div><dt>Office</dt><dd>Lemoore, CA — serving Kings, Tulare &amp; Fresno counties</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── CLOSE ── */}
      <section className="fp-section pos-band">
        <div className="pos-wrap" style={{ textAlign: 'center' }}>
          <h2 className="pos-h2" style={{ margin: '0 auto', maxWidth: 640 }}>Ready when you are.</h2>
          <p className="pos-body" style={{ margin: '14px auto 0', maxWidth: 520 }}>
            Whether you&apos;re making a move or looking for a brokerage that
            actually equips you, start here.
          </p>
          <div className="fp-cta-row" style={{ maxWidth: 460, margin: '22px auto 0' }}>
            <a href="/post" className="fp-cta fp-cta--primary">Post a move</a>
            <a href="/contact" className="fp-cta">Talk to Greg</a>
          </div>
        </div>
      </section>
    </div>
  );
}

function PosCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="pos-card">
      <span className="pos-card__ic"><MaterialIcon icon={icon} className="text-[22px]" /></span>
      <b>{title}</b>
      <p>{body}</p>
    </div>
  );
}
