'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

// ── BullpenBoardMock ──────────────────────────────────────────────────
//
// The "show the product, not a stock illustration" visual for the landing
// section that describes the buyer↔lender board. A polished, brand-accurate
// mock of the REAL buyer board (BuyerBoard.tsx) — filter chips, buyer rows
// with emblems, monthly/price, city·occupation, need chips, and offer
// counts — inside a browser frame. Static and crisp (sharper than a
// screenshot), so the image on the page IS the thing we're talking about.
// memory/project_destination_match_cut_thesis, project_bullpen_board_design

const ROWS = [
  {
    initials: 'DR', hue: '#1349d4',
    headline: 'First home for a growing family',
    monthly: '$2,400/mo', price: '$340k–$380k',
    city: 'Lemoore, CA', occ: 'RN, hospital',
    needs: ['Lender', 'Inspector'], offers: 3, posted: 'Posted today',
  },
  {
    initials: 'MJ', hue: '#11804a',
    headline: 'Moving closer to work',
    monthly: '$1,950/mo', price: '$280k–$310k',
    city: 'Hanford, CA', occ: 'Electrician',
    needs: ['Lender'], offers: 1, posted: 'Posted yesterday',
  },
  {
    initials: 'AK', hue: '#b45309',
    headline: 'Upgrading after a promotion',
    monthly: '$3,100/mo', price: '$430k–$470k',
    city: 'Visalia, CA', occ: 'Teacher',
    needs: ['Lender', 'Insurance'], offers: 5, posted: 'Posted 2 days ago',
  },
];

export default function BullpenBoardMock() {
  return (
    <div className="bbm" aria-hidden>
      {/* browser chrome */}
      <div className="bbm__bar">
        <span className="bbm__dot bbm__dot--r" />
        <span className="bbm__dot bbm__dot--y" />
        <span className="bbm__dot bbm__dot--g" />
        <span className="bbm__url"><MaterialIcon icon="lock" className="text-[11px]" /> plot.solutions/buyers</span>
      </div>

      {/* board body */}
      <div className="bbm__body">
        <div className="bbm__head">
          <div className="bbm__eyebrow"><MaterialIcon icon="bolt" className="text-[12px]" /> No lead fees. Ever.</div>
          <div className="bbm__title">Everyone here is buying a home.</div>
        </div>

        {/* filter chips */}
        <div className="bbm__filters">
          <span className="bbm__chip bbm__chip--on">All loans</span>
          <span className="bbm__chip">Conventional</span>
          <span className="bbm__chip">FHA</span>
          <span className="bbm__chip">VA</span>
          <span className="bbm__filters-sp" />
          <span className="bbm__chip bbm__chip--ghost"><MaterialIcon icon="sort" className="text-[13px]" /> Newest</span>
        </div>

        {/* rows */}
        <div className="bbm__rows">
          {ROWS.map((r) => (
            <div className="bbm__row" key={r.initials}>
              <span className="bbm__emblem" style={{ background: r.hue }}>{r.initials}</span>
              <div className="bbm__rowbody">
                <div className="bbm__headline">{r.headline}</div>
                <div className="bbm__meta">
                  <span className="bbm__money">{r.monthly}</span>
                  <span className="bbm__price">{r.price}</span>
                </div>
                <div className="bbm__where">
                  <MaterialIcon icon="place" className="text-[13px]" /> {r.city}
                  <span className="bbm__occ">· {r.occ}</span>
                </div>
                <div className="bbm__needs">
                  {r.needs.map((n) => <span key={n} className="bbm__need">{n}</span>)}
                </div>
              </div>
              <div className="bbm__side">
                <span className={`bbm__offers ${r.offers >= 3 ? 'is-hot' : ''}`}>
                  {r.offers === 1 ? 'An offer is in' : `${r.offers} offers in`}
                </span>
                <span className="bbm__posted">{r.posted}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
