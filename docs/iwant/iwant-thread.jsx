import React, { useState, useEffect } from "react";

// ── "I want" — single thread mockup ────────────────────────────────────
// Roles by TEMPERATURE: ivory = the buyer / the want · amber = offerings answering · cool = truth-tellers, no sale
// The system never chooses. It ELEVATES the buyer and lays every offering in front of him. He picks — his reasons, his own.
// Signature: the "I want" stem is fixed and immovable.

const T = {
  bg: "#0c0b0d", panel: "#131216", panelHi: "#181619",
  line: "rgba(244,239,230,0.09)", lineSoft: "rgba(244,239,230,0.05)",
  ivory: "#f4efe6", muted: "#9a948b", faint: "#6a655d",
  amber: "#f3b13f", amberDeep: "#e0951f", amberDim: "rgba(243,177,63,0.12)",
  cool: "#86919d", coolDim: "rgba(134,145,157,0.12)",
};

const OFFERS = [
  {
    who: "Foothill Refurb", kind: "Reseller", price: 189, when: "1h ago",
    note: "ThinkPad T480 · 16GB · 90-day warranty",
    pitch: "Refurbished in our own shop — wiped, battery tested, cleaned up. Pick it up today.",
    chosen: true,
    marcusNote: "Picked this one. My dad ran a ThinkPad for fifteen years and never killed it — I trust the brand more than the spec sheet. This one's mine.",
  },
  {
    who: "Valley PC Exchange", kind: "Reseller", price: 179, when: "22m ago",
    note: "Same T480 spec · charger included",
    pitch: "We've sold 400 of these to students. Lowest verified price in the thread.",
  },
  {
    who: "dmitri_k", kind: "Private seller", price: 150, when: "4m ago",
    note: "Lightly used · local pickup · no warranty",
    pitch: "It's my own. Meet me anywhere public, bring Ableton on a USB, test it before you pay a dollar.",
  },
  {
    who: "Sierra Systems", kind: "Reseller", price: 215, when: "11m ago",
    note: "Latitude E5470 · magnesium chassis · 1-yr warranty",
    pitch: "Built like a tank — milspec body, drop-rated. The one that actually survives a kid.",
  },
];

const COMMENTS = [
  { who: "producer_jules", role: "makes beats",
    body: "Ableton's fine on 16GB, but the T480's integrated graphics stutter once you stack plugins. Great for beats, rough for full projects." },
  { who: "kway_IT", role: "fixes these for a living",
    body: "Just so you know going in — the plastic T480s crack at the hinge, the metal Latitude doesn't. Both run your software fine. Your call which trade you want." },
  { who: "carla_buys_used", role: "bought 6 of these",
    body: "Whatever you pick, test it on the spot before money moves. No warranty on the $150 means that one's only smart if you can verify it first." },
];

function useReveal(count, step, start) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(count); return; }
    const timers = [];
    for (let i = 1; i <= count; i++) timers.push(setTimeout(() => setShown(i), start + i * step));
    return () => timers.forEach(clearTimeout);
  }, [count, step, start]);
  return shown;
}

export default function IWantThread() {
  const offersShown = useReveal(OFFERS.length, 460, 650);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ivory }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .iw-wrap { font-family:'Manrope',system-ui,sans-serif; max-width:1080px; margin:0 auto; padding:0 20px 80px; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .iw-cols { display:grid; grid-template-columns:1fr; gap:16px; }
        @media (min-width:860px){ .iw-cols{ grid-template-columns:1.05fr 0.95fr; gap:22px; } }
        .reveal { animation:rise .55s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes rise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes blink { 50%{opacity:0} }
        .caret { display:inline-block; width:3px; height:.95em; background:${T.amber}; margin-left:6px; transform:translateY(2px); animation:blink 1.05s steps(1) infinite; }
        @media (prefers-reduced-motion:reduce){ .reveal{animation:none} .caret{animation:none} }
        .offer:hover { border-color:${T.amber} !important; }
        .pick { cursor:pointer; }
        .pick:hover { background:${T.amberDim} !important; border-color:${T.amber} !important; color:${T.amber} !important; }
      `}</style>

      <div className="iw-wrap">
        <header style={{ padding: "30px 0 26px", borderBottom: `1px solid ${T.lineSoft}` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>I want<span className="caret" /></div>
            <div className="mono" style={{ fontSize: 11.5, color: T.faint, letterSpacing: "0.04em", textTransform: "uppercase" }}>say it out loud · you choose</div>
          </div>
        </header>

        {/* the want — elevated */}
        <section style={{ padding: "34px 0 8px" }}>
          <div style={{
            background: `linear-gradient(${T.panel}, ${T.bg})`,
            border: `1px solid ${T.line}`, borderTop: `2px solid ${T.amber}`,
            borderRadius: 16, padding: "26px 24px",
            boxShadow: "0 18px 50px -28px rgba(243,177,63,0.4)",
          }}>
            <div className="mono" style={{ fontSize: 11.5, color: T.amberDeep, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
              Marcus R. · Lemoore, CA · originator · you hold this thread, everything answers to you
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(25px,4.6vw,38px)", lineHeight: 1.13, fontWeight: 700, letterSpacing: "-0.02em" }}>
              <span style={{ color: T.amber, fontWeight: 800 }}>I want</span>{" "}a laptop, around $200, that runs Ableton without choking and survives my kid.
            </h1>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              {["budget ~$200, flexible", "need it in 2 weeks", "open to used"].map((c) => (
                <span key={c} className="mono" style={{ fontSize: 12, color: T.muted, padding: "7px 12px", border: `1px solid ${T.line}`, borderRadius: 999, background: T.panelHi }}>{c}</span>
              ))}
            </div>
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, padding: "16px 4px 24px" }}>
          <div className="mono" style={{ fontSize: 12, color: T.muted }}>Everything below is an offering, answering to you.</div>
          <div className="mono" style={{ fontSize: 11, color: T.faint, letterSpacing: "0.04em" }}>the system doesn't pick · you do</div>
        </div>

        <div className="iw-cols">
          {/* offerings */}
          <div>
            <ColHead label="Offerings" sub="anyone who can bring it" color={T.amber} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {OFFERS.map((o, i) => (
                <div key={o.who} className={i < offersShown ? "offer reveal" : "offer"} style={{ opacity: i < offersShown ? 1 : 0, border: `1px solid ${o.chosen ? T.amber : T.line}`, background: o.chosen ? "rgba(243,177,63,0.04)" : T.panel, borderRadius: 14, padding: "16px 17px" }}>
                  {o.chosen && (
                    <div className="mono" style={{ fontSize: 10.5, color: T.amberDeep, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 11 }}>★ Marcus chose this</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{o.who}</div>
                      <div className="mono" style={{ fontSize: 11, color: T.faint, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{o.kind} · {o.when}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: o.chosen ? T.amber : T.ivory }}>${o.price}</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: T.muted, marginTop: 10, lineHeight: 1.45 }}>{o.note}</div>
                  <div style={{ fontSize: 14, color: T.ivory, marginTop: 9, lineHeight: 1.5, opacity: 0.92 }}>&ldquo;{o.pitch}&rdquo;</div>

                  {o.chosen ? (
                    <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${T.amberDim}` }}>
                      <div className="mono" style={{ fontSize: 10.5, color: T.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>why — in his words</div>
                      <div style={{ fontSize: 14, color: T.ivory, lineHeight: 1.55 }}>{o.marcusNote}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <span className="pick mono" style={{ fontSize: 12, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 999, padding: "7px 16px", transition: "all .15s" }}>Choose this</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* comments */}
          <div>
            <ColHead label="Comments" sub="people with nothing to sell you" color={T.cool} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {COMMENTS.map((c) => (
                <div key={c.who} style={{ borderLeft: `2px solid ${T.cool}`, background: T.panelHi, borderRadius: "0 12px 12px 0", padding: "15px 17px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{c.who}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: T.cool, background: T.coolDim, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>can't sell here</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>{c.role}</div>
                  <div style={{ fontSize: 14, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer style={{ marginTop: 50, paddingTop: 26, borderTop: `1px solid ${T.lineSoft}` }}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: T.ivory, maxWidth: 680 }}>
            By every measure a system could run, the metal one was the better machine and the $150 was the better deal. Marcus picked the plastic ThinkPad because his dad ran one for fifteen years. Nobody computed that. The platform just put him up high enough to see everything — and the choice, and the reasons, were his.
          </p>
          <div className="mono" style={{ marginTop: 16, fontSize: 12, color: T.faint, letterSpacing: "0.04em" }}>
            the platform elevates the buyer. it never chooses for him.
          </div>
        </footer>
      </div>
    </div>
  );
}

function ColHead({ label, sub, color }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingBottom: 12, borderBottom: `1px solid ${T.line}` }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, transform: "translateY(-1px)" }} />
      <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>{label}</span>
      <span className="mono" style={{ fontSize: 11.5, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>{sub}</span>
    </div>
  );
}
