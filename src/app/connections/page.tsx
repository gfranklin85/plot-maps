'use client';

// ── /connections — THE CONNECTION BOARD ───────────────────────────────
//
// The visual payoff of the whole thesis: everyone's posted WANTS as pins on a
// US map, with animated connection arcs between wants that match. Post enough
// wants and the map connects the dots. The destination Commercial #1 sends
// people to. memory/the_thesis (the connection engine), commercials (#1 "Post
// What You Want").
//
// Practical 2D board (a 3D earth from directly above reads 2D too — dive into a
// single connection in 3D later). Lightweight inline-SVG US projection + arcs;
// no heavy map engine for the nationwide view.

import { useEffect, useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Want {
  id: string; owner_name: string | null;
  from_label: string | null; from_lat: number | null; from_lng: number | null;
  to_label: string | null; status: string;
  acres_min: number | null; waterfront: boolean; no_hoa: boolean; has_shop: boolean;
  pool: boolean; near_military_base: boolean;
  target_monthly: number | null; max_price: number | null; beds_min: number | null;
  move_condition: string | null;
}
interface Conn {
  a_id: string; a_label: string; a_lat: number; a_lng: number; a_to_label: string;
  b_id: string; b_label: string; b_lat: number; b_lng: number; b_to_label: string;
  match_pct: number; status: string; mutual: boolean;
}
interface Counts {
  activeWants: number; newMatches: number;
  byStatus: { new: number; possible_match: number; in_progress: number; completed: number };
  total: number;
}

// Continental-US equirectangular projection → 0..1 board coords.
const US = { minLng: -125, maxLng: -66.5, minLat: 24, maxLat: 49.5 };
function project(lat: number, lng: number) {
  const x = (lng - US.minLng) / (US.maxLng - US.minLng);
  const y = 1 - (lat - US.minLat) / (US.maxLat - US.minLat);
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

const STATUS_STYLE: Record<string, { color: string; label: string; dash: string }> = {
  completed:      { color: '#0f8a5f', label: 'Completed',     dash: '0' },
  in_progress:    { color: '#e08a1e', label: 'In Progress',   dash: '7 5' },
  possible_match: { color: '#7c4dff', label: 'Possible Match',dash: '3 5' },
  new:            { color: '#1d7fff', label: 'New Want',       dash: '3 6' },
};

export default function ConnectionBoard() {
  const [wants, setWants] = useState<Want[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/connections');
        const data = await res.json();
        setWants(data.wants ?? []);
        setConns(data.connections ?? []);
        setCounts(data.counts ?? null);
      } finally { setLoading(false); }
    })();
  }, []);

  const topMatches = useMemo(
    () => [...conns].sort((a, b) => b.match_pct - a.match_pct).slice(0, 8),
    [conns],
  );

  return (
    <div className="cxb">
      {/* ══ LEFT RAIL ══ */}
      <aside className="cxb-rail cxb-rail--left">
        <div className="cxb-card">
          <h2 className="cxb-rail__h">Find Your Connection</h2>
          <p className="cxb-rail__sub">People with wants can help each other move.</p>
          <button className="cxb-post"><MaterialIcon icon="add" className="text-[18px]" /> Post Your Want</button>
          <div className="cxb-stats">
            <div><b>{counts?.activeWants ?? '—'}</b><span>Active Wants</span></div>
            <div><b className="cxb-green">{counts?.newMatches ?? '—'}</b><span>New Matches</span></div>
          </div>
        </div>

        <div className="cxb-card">
          <div className="cxb-filter__head"><h3>Filters</h3><button className="cxb-link">Clear</button></div>
          <label className="cxb-flabel">Geography</label>
          <div className="cxb-select">Nationwide <MaterialIcon icon="expand_more" className="text-[16px]" /></div>
          <label className="cxb-flabel">Max Monthly Payment</label>
          <div className="cxb-range"><span /></div>
          <div className="cxb-range__ends"><span>$500</span><span>$5,000+</span></div>
          <label className="cxb-flabel">Amenities</label>
          <div className="cxb-amen">
            {['water', 'terrain', 'home', 'garage', 'store', 'pool'].map((i, idx) => (
              <span key={i} className={`cxb-amen__c ${idx === 1 ? 'is-on' : ''}`}><MaterialIcon icon={i === 'water' ? 'water_drop' : i === 'terrain' ? 'landscape' : i === 'home' ? 'home' : i === 'garage' ? 'garage' : i === 'store' ? 'storefront' : 'pool'} className="text-[18px]" /></span>
            ))}
          </div>
        </div>
      </aside>

      {/* ══ THE BOARD ══ */}
      <main className="cxb-main">
        <div className="cxb-board">
          <div className="cxb-board__tabs">
            <button className="is-active">Map View</button>
            <button>List View</button>
          </div>
          <div className="cxb-legend">
            {Object.entries(STATUS_STYLE).map(([k, s]) => (
              <span key={k}><i style={{ background: s.color }} /> {s.label}</span>
            ))}
          </div>

          <svg className="cxb-svg" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet">
            {/* subtle US frame */}
            <rect x="8" y="8" width="984" height="604" rx="18" className="cxb-svg__bg" />

            {/* connection arcs */}
            {conns.map((c) => {
              const from = project(c.a_lat, c.a_lng);
              const to = project(c.b_lat, c.b_lng);
              const x1 = 8 + from.x * 984, y1 = 8 + from.y * 604;
              const x2 = 8 + to.x * 984, y2 = 8 + to.y * 604;
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.22;
              const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.new;
              const active = hover === c.a_id || hover === c.b_id;
              return (
                <path key={`${c.a_id}-${c.b_id}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                  fill="none" stroke={st.color} strokeWidth={active ? 3.5 : 2}
                  strokeDasharray={st.dash} className="cxb-arc"
                  style={{ opacity: hover && !active ? 0.15 : 0.9 }} />
              );
            })}

            {/* want pins */}
            {wants.map((w) => {
              if (w.from_lat == null || w.from_lng == null) return null;
              const p = project(w.from_lat, w.from_lng);
              const x = 8 + p.x * 984, y = 8 + p.y * 604;
              const st = STATUS_STYLE[w.status] ?? STATUS_STYLE.new;
              const active = hover === w.id;
              return (
                <g key={w.id} transform={`translate(${x},${y})`}
                  onMouseEnter={() => setHover(w.id)} onMouseLeave={() => setHover(null)}
                  className="cxb-pin" style={{ cursor: 'pointer' }}>
                  <circle r={active ? 9 : 6} fill={st.color} stroke="#fff" strokeWidth={2.5} />
                  <foreignObject x={-90} y={-58} width={180} height={46} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div className={`cxb-pinlabel ${active ? 'is-active' : ''}`}>
                      <b>{w.from_label}</b>
                      <span>wants {w.to_label}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
          {loading && <div className="cxb-loading">Loading the map of wants…</div>}
          <div className="cxb-board__foot"><span className="cxb-dot" /> Showing all connections</div>
        </div>

        {/* Top matches */}
        <div className="cxb-matches">
          <div className="cxb-matches__head"><h3>Top Matches</h3><span>People whose wants may align with yours.</span></div>
          <div className="cxb-matches__row">
            {topMatches.map((c) => {
              const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.new;
              return (
                <div key={`${c.a_id}-${c.b_id}`} className="cxb-match"
                  onMouseEnter={() => setHover(c.a_id)} onMouseLeave={() => setHover(null)}>
                  <span className="cxb-match__tag" style={{ color: st.color, background: `${st.color}1a` }}>{st.label}</span>
                  <div className="cxb-match__loc">{c.a_label}</div>
                  <div className="cxb-match__wants">Wants: <b>{c.a_to_label}</b></div>
                  <div className="cxb-match__foot">
                    <span className="cxb-match__pct" style={{ color: st.color }}>{c.match_pct}% Match</span>
                    <button className="cxb-link">View</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ══ RIGHT RAIL ══ */}
      <aside className="cxb-rail cxb-rail--right">
        <div className="cxb-card">
          <div className="cxb-filter__head"><h3>Your Connections</h3><button className="cxb-link">View all</button></div>
          <ul className="cxb-conncounts">
            <li><i style={{ background: STATUS_STYLE.new.color }} /> New Want <b>{counts?.byStatus.new ?? 0}</b></li>
            <li><i style={{ background: STATUS_STYLE.possible_match.color }} /> Possible Match <b>{counts?.byStatus.possible_match ?? 0}</b></li>
            <li><i style={{ background: STATUS_STYLE.in_progress.color }} /> In Progress <b>{counts?.byStatus.in_progress ?? 0}</b></li>
            <li><i style={{ background: STATUS_STYLE.completed.color }} /> Completed <b>{counts?.byStatus.completed ?? 0}</b></li>
          </ul>
          <div className="cxb-conntotal">Total Connections <b>{counts?.total ?? 0}</b></div>
        </div>

        <div className="cxb-card cxb-cta">
          <div className="cxb-cta__art"><MaterialIcon icon="handshake" className="text-[34px]" /></div>
          <h3>Good people. Shared goals. Better moves.</h3>
          <p>Your want can help someone else move — post yours today.</p>
          <button className="cxb-post cxb-post--alt"><MaterialIcon icon="add" className="text-[18px]" /> Post Your Want</button>
        </div>
      </aside>
    </div>
  );
}
