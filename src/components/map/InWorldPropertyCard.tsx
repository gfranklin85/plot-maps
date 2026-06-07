"use client";

// InWorldPropertyCard — the projected in-world property card.
// Figma source: file gWtc7VDjRuFx5oYgU8FTvw, node 106:91 ("Group 1").
//
// Design intent (Greg, 2026-06-06):
//   - White-bordered dark-glass card (slate-blue → ink gradient).
//   - Photo hero up top with scrim; price/ML#/address overlaid bottom-left;
//     fact row (BD/BA/SqFt/DOM-CDOM) bottom-right; status badge top-right;
//     agent toolbar across the bottom.
//   - PROJECTION: a light-emanation cone + a stack of 7 stepped "sonar"
//     arc-lines below the card, broadcasting up FROM the parcel point on
//     the ground. Keeps the card felt-as-attached to its spot even when
//     flown up into your face. (project_card_parallax_depth_model.md)
//
// This is the static visual translation. World-anchoring + the live
// parallax re-angle of the projection happen where it's mounted on the map
// (marker-HTML, no gmp-popover — reference_gmp_3d_anchor_no_pan).

import type { Lead } from "@/types";

const ASSET = "/assets/cards/inworld";
const HERO_PLACEHOLDER = `${ASSET}/hero-placeholder.jpg`;

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function statusLabel(s: string | null | undefined): string {
  const v = (s || "").trim().toLowerCase();
  if (v === "active") return "Active";
  if (v === "pending") return "Pending";
  if (v === "sold" || v === "closed") return "Sold";
  return "Off Market";
}

// Status pill color per state. Active is the canonical green; Pending
// is amber; Sold reads as cool slate; Off Market is the neutral
// charcoal so it doesn't compete with active listings on the map.
function statusBg(label: string): string {
  if (label === "Active") return "#3aa767";
  if (label === "Pending") return "#d9a23c";
  if (label === "Sold") return "#4a6584";
  return "#3a4658"; // Off Market
}

/** Build card data from a Lead (+ optional resolved street/city). The map
 *  page passes the selected Lead; missing fields degrade to em-dashes. */
export function cardDataFromLead(lead: Lead): InWorldCardData {
  const status = statusLabel(lead.listing_status);
  const offMarket = status === "Off Market";
  return {
    // Off Market shows NO financial estimate (feedback_no_gimmick_estimates_off_market)
    price: offMarket ? "Off Market" : money(lead.listing_price ?? lead.selling_price),
    mls: lead.id?.startsWith("parcel:") ? `APN ${lead.id.slice(7)}` : (lead.record_type ?? ""),
    street: lead.property_address ?? lead.name ?? "—",
    cityStateZip: [lead.city, lead.state].filter(Boolean).join(", ") + (lead.zip ? ` ${lead.zip}` : ""),
    bd: lead.bedrooms != null ? String(lead.bedrooms) : "—",
    ba: lead.bathrooms != null ? String(lead.bathrooms) : "—",
    sqft: lead.sqft != null ? lead.sqft.toLocaleString("en-US") : "—",
    dom: lead.dom != null ? `${lead.dom}/${lead.dom}` : "—",
    status,
    photoUrl: lead.listing_photo_url || HERO_PLACEHOLDER,
  };
}

// The 7 stepped sonar lines, top (widest) → bottom (narrowest). Each is a
// faint arc PNG; they fan down to the parcel point, decreasing in size,
// reading as a signal broadcasting up. rotate matches the Figma (-8.8deg).
const SONAR_LINES = [
  { src: `${ASSET}/line6.png`,  w: 187, top: 8 },
  { src: `${ASSET}/line4.png`,  w: 171, top: 24 },
  { src: `${ASSET}/line5.png`,  w: 145, top: 40 },
  { src: `${ASSET}/line7.png`,  w: 112, top: 54 },
  { src: `${ASSET}/line8.png`,  w: 79,  top: 68 },
  { src: `${ASSET}/line9.png`,  w: 55,  top: 80 },
  { src: `${ASSET}/line10.png`, w: 36,  top: 90 },
];

const TOOLBAR_ICONS = ["⌂", "▦", "◰", "◷", "$", "⋯"];

export interface InWorldCardData {
  price: string;        // "$387,990"
  mls: string;          // "ML#234104"
  street: string;       // "2327-21 S Cullum St"
  cityStateZip: string; // "Hanford, CA 93230"
  bd: string;           // "3"
  ba: string;           // "3"
  sqft: string;         // "1,590"
  dom: string;          // "36/36"
  status: string;       // "Active"
  photoUrl: string;     // hero photo
}

interface Props {
  data: InWorldCardData;
  onAction?: (action: string) => void;
  onClose?: () => void;
}

const CARD_W = 434;
const CARD_H = 296;

export default function InWorldPropertyCard({ data, onAction }: Props) {
  return (
    <div
      className="relative select-none"
      style={{ width: CARD_W, height: CARD_H + 110 }}
      aria-label="Property card"
    >
      {/* ── PROJECTION (behind the card): light cone + sonar lines ── */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: CARD_H - 24, width: CARD_W }}
      >
        {/* light emanation cone */}
        <img
          src={`${ASSET}/emanation.png`}
          alt=""
          className="absolute left-1/2 -translate-x-1/2 top-0 opacity-80"
          style={{ width: 300 }}
        />
        {/* stepped sonar arcs, fanning down to the parcel point */}
        {SONAR_LINES.map((ln, i) => (
          <img
            key={i}
            src={ln.src}
            alt=""
            className="absolute left-1/2 -translate-x-1/2"
            style={{ width: ln.w, top: ln.top + 16, transform: "translateX(-50%) rotate(-8.8deg)" }}
          />
        ))}
      </div>

      {/* ── CARD FACE ── */}
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 17,
          border: "2px solid #ffffff",
          background: "linear-gradient(to bottom, #1a2942, #0d1424)",
          boxShadow: "0px 12px 28px 0px rgba(0,0,0,0.45)",
        }}
      >
        {/* photo hero */}
        <div className="absolute left-0 top-0" style={{ width: CARD_W, height: 234 }}>
          <img
            src={data.photoUrl}
            alt=""
            className="absolute inset-0 size-full object-cover pointer-events-none"
          />
          {/* bottom-up scrim so overlaid text reads */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(3,6,13,0.92) 0%, rgba(4,8,16,0.30) 48%, rgba(0,0,0,0) 75%)",
            }}
          />
        </div>

        {/* status badge */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: 335, top: 18, height: 25, padding: "4px 7px",
            borderRadius: 6, background: statusBg(data.status), border: "1px solid #f2f2f5",
          }}
        >
          <span className="font-bold text-white" style={{ fontSize: 11 }}>
            {data.status}
          </span>
        </div>

        {/* price */}
        <p
          className="absolute font-bold"
          style={{ left: 13, top: 147, fontSize: 28, color: "#f7fafc" }}
        >
          {data.price}
        </p>
        {/* save chevron chip */}
        <button
          onClick={() => onAction?.("save")}
          className="absolute flex items-center justify-center"
          style={{
            left: 167, top: 151, width: 15, height: 32, borderRadius: 6,
            background: "#3aa767", border: "1px solid #fffffd",
          }}
        >
          <span className="font-bold" style={{ fontSize: 13, color: "#f7fafc" }}>↓</span>
        </button>

        {/* ML# / street / city */}
        <p className="absolute font-medium" style={{ left: 13, top: 190, fontSize: 15, color: "#73cce0" }}>
          {data.mls}
        </p>
        <p className="absolute font-semibold" style={{ left: 13, top: 209, fontSize: 15, color: "#f7fafc" }}>
          {data.street}
        </p>
        <p className="absolute" style={{ left: 13, top: 231, fontSize: 15, color: "#c7d4db" }}>
          {data.cityStateZip}
        </p>

        {/* fact row */}
        <div
          className="absolute flex gap-3 items-start"
          style={{ left: 245, top: 204, width: 178 }}
        >
          {[
            { n: data.bd, l: "BD" },
            { n: data.ba, l: "BA" },
            { n: data.sqft, l: "Sq Ft" },
            { n: data.dom, l: "DOM/CDOM" },
          ].map((f) => (
            <div key={f.l} className="flex flex-col items-center whitespace-nowrap">
              <span className="font-bold" style={{ fontSize: 14, color: "#f7fafc" }}>{f.n}</span>
              <span style={{ fontSize: 12, color: "#c7d4db" }}>{f.l}</span>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div
          className="absolute flex items-start justify-between"
          style={{
            left: 0, top: 255, width: CARD_W, height: 39, padding: "0 14px",
            borderTop: "1px solid #73cce0",
            background: "linear-gradient(to bottom, #121c2e, #1c293d)",
          }}
        >
          {TOOLBAR_ICONS.map((g, i) => (
            <button
              key={i}
              onClick={() => onAction?.(`tool:${g}`)}
              className="shrink-0"
              style={{ fontSize: 22, color: "#73cce0", lineHeight: "32px" }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
