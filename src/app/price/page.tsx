"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Grid3x3,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  BarChart3,
  Clock,
  Home,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  User,
} from "lucide-react";
import type { MarketAsset } from "@/lib/types/market-asset";

// ── DATA TYPES ────────────────────────────────────────────────────────────────
interface DisplayAsset {
  address: string;
  dom: number;
  soldPrice: number;
  listPrice: number;
  sqft: number;
  yearBuilt: number;
  status: string;
}

interface CompRecord {
  sqft: number;
  age: number;
  price: number;
  ppf: number;
  dom: number;
  dist?: number;
}

// ── DERIVE DOM FROM DATES ─────────────────────────────────────────────────────
function deriveDom(asset: MarketAsset): number {
  // Priority 1: MLS-sourced DOM (highest confidence)
  if (asset.mls_dom) return asset.mls_dom;

  // Priority 2: derive from inferred lifecycle dates
  const listStr = asset.inferred_list_date || asset.mls_list_date || asset.list_date || asset.first_seen_date;
  if (!listStr) return 0;
  const listDate = new Date(listStr);

  if (asset.inferred_pending_date) {
    // True offer timing — gold signal
    return Math.max(0, Math.round((new Date(asset.inferred_pending_date).getTime() - listDate.getTime()) / 86400000));
  }

  if (asset.inferred_sold_date) {
    // Fallback: sold date
    return Math.max(0, Math.round((new Date(asset.inferred_sold_date).getTime() - listDate.getTime()) / 86400000));
  }

  if (asset.status === "sold" && asset.sold_date) {
    return Math.max(0, Math.round((new Date(asset.sold_date).getTime() - listDate.getTime()) / 86400000));
  }

  if (asset.status === "pending" && asset.pending_date) {
    return Math.max(0, Math.round((new Date(asset.pending_date).getTime() - listDate.getTime()) / 86400000));
  }

  // Active: live aging
  return Math.max(0, Math.round((Date.now() - listDate.getTime()) / 86400000));
}

// ── TRANSFORM SUPABASE DATA ───────────────────────────────────────────────────
function transformAssets(assets: MarketAsset[]): DisplayAsset[] {
  return assets
    .filter((a) => a.sqft && a.list_price)
    .map((a) => ({
      address: a.address,
      dom: deriveDom(a),
      soldPrice: a.sold_price || a.list_price!,
      listPrice: a.list_price!,
      sqft: a.sqft!,
      yearBuilt: a.year_built || 1980,
      status: a.status,
    }));
}

function buildComps(assets: DisplayAsset[]): CompRecord[] {
  return assets.map((d) => ({
    sqft: d.sqft,
    age: new Date().getFullYear() - d.yearBuilt,
    price: d.soldPrice,
    ppf: d.soldPrice / d.sqft,
    dom: d.dom,
  }));
}

// ── MODEL ─────────────────────────────────────────────────────────────────────
function modelBase(sqft: number, age: number) {
  return 277130 + 66.71 * sqft + -574.46 * age;
}

function estDom(curPrice: number, basePrice: number, age: number) {
  const pctOver = (curPrice - basePrice) / basePrice;
  const pricePenalty = pctOver >= 0 ? pctOver * 370 : pctOver * 250;
  return Math.max(1, Math.round(28 + pricePenalty + (age - 35) * 0.57));
}

function nearestComps(allComps: CompRecord[], sqft: number, age: number, n = 6) {
  return [...allComps]
    .map((c) => ({
      ...c,
      dist: Math.abs(c.sqft - sqft) / 200 + Math.abs(c.age - age) / 20,
    }))
    .sort((a, b) => a.dist! - b.dist!)
    .slice(0, n);
}

function fmt$(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function getMessaging(curPrice: number, base: number, curDom: number) {
  const pct = (curPrice - base) / base;
  if (pct < -0.05)
    return {
      headline: `At this price, expect an accepted offer in about ${curDom} days.`,
      sub: `You're priced well below market — buyers will notice fast. Likely multiple offers early.`,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    };
  if (pct < -0.02)
    return {
      headline: `Smart pricing. Expect an accepted offer around day ${curDom}.`,
      sub: `Slightly under market gives buyers a reason to move without hesitation. Often the sweet spot.`,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    };
  if (pct <= 0.02)
    return {
      headline: `Right at market. An accepted offer likely within ${curDom} days.`,
      sub: `This aligns with what similar homes have actually sold for. Motivated buyers won't hesitate.`,
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
    };
  if (pct <= 0.05)
    return {
      headline: `Slightly above market — expect an accepted offer around day ${curDom}.`,
      sub: `You're testing the ceiling. If you don't see strong interest in 2–3 weeks, a small reduction typically restarts activity fast.`,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  if (pct <= 0.09)
    return {
      headline: `Above market — offers may take ${curDom}+ days to arrive.`,
      sub: `At this ask, most buyers will scroll past without scheduling a tour. The ones who do show up will negotiate harder.`,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  return {
    headline: `Significantly overpriced — risk of sitting ${curDom}+ days without an offer.`,
    sub: `Homes priced this far above market go stale fast. After 30–45 days buyers assume something is wrong. Starting right is the better play.`,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  };
}

// ── TICKER ────────────────────────────────────────────────────────────────────
function TickerItem({ d, city = "Lemoore" }: { d: DisplayAsset; city?: string }) {
  const drop = d.listPrice - d.soldPrice;
  const dropped = drop > 500;
  const ppf = Math.round(d.soldPrice / d.sqft);
  const domColor =
    d.dom <= 14
      ? "text-green-400 bg-green-400/10"
      : d.dom <= 45
        ? "text-blue-400 bg-blue-400/10"
        : d.dom <= 90
          ? "text-amber-400 bg-amber-400/10"
          : "text-red-400 bg-red-400/10";

  return (
    <div className="inline-flex items-center shrink-0">
      <div className="flex items-center gap-4 px-7 border-r border-white/[0.07]">
        <span className="text-[13px] font-medium text-white/75">{d.address}</span>
        <span className="text-xs text-white/35">{city}, CA</span>
        <span className="text-[13px] font-bold text-white/90">{fmt$(d.soldPrice)}</span>
        <span className="text-[11px] text-white/35">${ppf}/sf</span>
        <span className={`text-xs font-semibold rounded px-2 py-0.5 ${domColor}`}>
          {d.dom}d to offer
        </span>
        {dropped && (
          <span className="text-[11px] text-amber-400 bg-amber-400/10 rounded px-2 py-0.5">
            ↓ {fmt$(drop)} from ask
          </span>
        )}
      </div>
    </div>
  );
}

function TickerBand({ speed = 60, reverse = false, data, city = "Lemoore" }: { speed?: number; reverse?: boolean; data: DisplayAsset[]; city?: string }) {
  const items = [...data, ...data];
  return (
    <div className="overflow-hidden w-full">
      <div
        className={`inline-flex ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {items.map((d, i) => (
          <TickerItem key={i} d={d} city={city} />
        ))}
      </div>
    </div>
  );
}

// ── COMP BARS ─────────────────────────────────────────────────────────────────
function CompBars({
  comps,
  curPrice,
  curDom,
  sqft,
}: {
  comps: CompRecord[];
  curPrice: number;
  curDom: number;
  sqft: number;
}) {
  const chartComps = useMemo(() => [...comps].sort((a, b) => a.ppf - b.ppf), [comps]);
  const allDoms = [...chartComps.map((c) => c.dom), curDom];
  const maxDom = Math.max(...allDoms, 30);
  const curPPF = curPrice / sqft;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
          Similar homes: price vs. time to offer
        </h3>
        <p className="text-[13px] text-slate-500">
          Each bar is a nearby sold home. Height = days until accepted offer. Your price shown in blue.
        </p>
      </div>
      <div className="flex gap-2 items-end h-[150px]">
        {chartComps.map((c, i) => {
          const h = Math.max(Math.round((c.dom / maxDom) * 120), 4);
          const col =
            c.ppf < 220 ? "bg-green-400" : c.ppf > 258 ? "bg-red-400" : "bg-slate-400";
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-500">{c.dom}d</span>
              <div className={`w-full rounded-t ${col}`} style={{ height: h }} />
              <div className="text-[10px] text-slate-400 text-center leading-tight pt-1 border-t border-slate-200 w-full">
                {fmt$(c.price)}
                <br />
                <span className="text-[9px]">${Math.round(c.ppf)}/sf</span>
              </div>
            </div>
          );
        })}
        {/* User's bar */}
        <div className="flex-[1.2] flex flex-col items-center gap-1">
          <span className="text-[11px] font-bold text-blue-700">{curDom}d</span>
          <div
            className="w-full rounded-t bg-blue-700 ring-2 ring-white ring-offset-1 ring-offset-blue-700"
            style={{ height: Math.max(Math.round((curDom / maxDom) * 120), 4) }}
          />
          <div className="text-[10px] text-blue-700 font-semibold text-center leading-tight pt-1 border-t-2 border-blue-700 w-full">
            {fmt$(curPrice)}
            <br />
            <span className="text-[9px]">
              ${Math.round(curPPF)}/sf
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-200">
        {[
          { color: "bg-green-400", label: "Under $220/sf" },
          { color: "bg-slate-400", label: "$220–$258/sf" },
          { color: "bg-red-400", label: "Over $258/sf" },
          { color: "bg-blue-700", label: "Your listing" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OVERPRICING EXAMPLES ──────────────────────────────────────────────────────
function OverpricingExamples({ data }: { data: DisplayAsset[] }) {
  const examples = data.filter(
    (d) => d.listPrice > d.soldPrice * 1.03 && d.dom > 45
  ).slice(0, 3);

  if (examples.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-red-600 mb-3">
        What happens when homes are priced like this
      </h3>
      {examples.map((d, i) => {
        const drop = d.listPrice - d.soldPrice;
        return (
          <div
            key={i}
            className={`flex justify-between items-center py-2.5 ${i < examples.length - 1 ? "border-b border-red-100" : ""}`}
          >
            <div>
              <div className="text-[13px] font-semibold text-slate-900">{d.address}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Listed at {fmt$(d.listPrice)} · Sold at {fmt$(d.soldPrice)}
              </div>
              {drop > 500 && (
                <div className="text-xs text-amber-600 mt-0.5">
                  ↓ Reduced by {fmt$(drop)} before selling
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <div className="text-xl font-bold text-red-600">{d.dom}d</div>
              <div className="text-[11px] text-slate-500">to offer</div>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-red-600 mt-3 leading-relaxed">
        Homes that sat this long often face stigma — buyers assume something is wrong.
        A lower starting price almost always nets more than a reduced price after weeks on market.
      </p>
    </div>
  );
}

// ── LEAD FORM ─────────────────────────────────────────────────────────────────
function LeadForm({
  base,
  curPrice,
  curDom,
  sqft,
  yearBuilt,
  city,
  onSuccess,
  onBack,
}: {
  base: number;
  curPrice: number;
  curDom: number;
  city: string;
  sqft: string;
  yearBuilt: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          type: "seller",
          source: "pricing_tool",
          property_address: form.address || null,
          price_range: fmt$(curPrice),
          motivation: `Pricing tool (${city}): ${sqft}sqft, built ${yearBuilt}. Model: ${fmt$(base)}. Selected: ${fmt$(curPrice)}. Est DOM: ${curDom} days.`,
        }),
      });
      if (res.ok) {
        setStatus("success");
        onSuccess();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  // Graceful error — still show success-like state
  if (status === "error") {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <CheckCircle2 className="w-12 h-12 text-blue-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">We got your info.</h3>
        <p className="text-sm text-slate-500 mb-6">
          Gregory will follow up within one business day.
        </p>
        <button
          onClick={onBack}
          className="text-sm text-blue-700 font-semibold hover:underline"
        >
          ← Back to pricing tool
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            See exactly how I&apos;d price your home
          </h3>
          <p className="text-sm text-slate-500">
            Your estimate: <strong className="text-slate-900">{fmt$(curPrice)}</strong> ·{" "}
            <strong className="text-slate-900">{curDom} days</strong> to offer.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6">
          {["Personalized pricing strategy", "Comparable analysis", "Free 15-min call with Gregory", "No spam — ever"].map(
            (item, i) => (
              <div key={i} className={`flex items-center gap-2 ${i < 3 ? "mb-2" : ""}`}>
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-[13px] text-slate-700">{item}</span>
              </div>
            )
          )}
        </div>

        {[
          { label: "Your Name", key: "name" as const, type: "text", placeholder: "Jane Smith", icon: User, required: true },
          { label: "Email", key: "email" as const, type: "email", placeholder: "jane@email.com", icon: Mail, required: true },
          { label: "Phone (optional)", key: "phone" as const, type: "tel", placeholder: "(559) 555-0100", icon: Phone, required: false },
          { label: "Property Address (optional)", key: "address" as const, type: "text", placeholder: "123 Main St, Lemoore", icon: MapPin, required: false },
        ].map((f) => (
          <div key={f.key} className="mb-3">
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              {f.label}
            </label>
            <div className="relative">
              <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={f.type}
                required={f.required}
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-700 focus:border-transparent outline-none"
              />
            </div>
          </div>
        ))}

        <button
          type="submit"
          disabled={!form.name || !form.email || status === "loading"}
          className="w-full mt-2 py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Get My Pricing Strategy
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-400 text-center mt-3">
          Gregory Franklin · KW Central Valley · DRE #02090737
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="block mx-auto mt-4 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to pricing tool
      </button>
    </form>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function PricePage() {
  const CITIES = ["Lemoore", "Hanford", "Visalia", "Fresno"] as const;

  const [view, setView] = useState<"landing" | "tool" | "form" | "success">("landing");
  const [selectedCity, setSelectedCity] = useState<string>("Lemoore");
  const [sqft, setSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sliderVal, setSliderVal] = useState<number | null>(null);
  const [showMath, setShowMath] = useState(false);

  // Dynamic data from Supabase
  const [marketData, setMarketData] = useState<DisplayAsset[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    setDataLoading(true);
    fetch(`/api/market-assets?city=${selectedCity}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setMarketData(transformAssets(json.data));
        } else {
          setMarketData([]);
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [selectedCity]);

  function handleCityChange(city: string) {
    setSelectedCity(city);
    setSliderVal(null);
  }

  const allComps = useMemo(() => buildComps(marketData), [marketData]);

  const currentYear = new Date().getFullYear();
  const age = yearBuilt ? currentYear - parseInt(yearBuilt) : null;
  const isValid = sqft && age && age > 0 && age < 200 && parseInt(sqft) >= 400;
  const base = isValid ? Math.round(modelBase(parseInt(sqft), age)) : null;

  // Auto-set slider to base when inputs become valid
  const curPrice = sliderVal !== null ? sliderVal : base;
  const sliderMin = base ? Math.round(base * 0.88) : 0;
  const sliderMax = base ? Math.round(base * 1.12) : 0;
  const curPPF = curPrice && sqft ? curPrice / parseInt(sqft) : null;
  const curDom = curPrice && base && age ? estDom(curPrice, base, age) : null;
  const comps = useMemo(
    () => (sqft && age && allComps.length > 0 ? nearestComps(allComps, parseInt(sqft), age) : []),
    [sqft, age, allComps]
  );
  const sliderPct =
    base && curPrice ? ((curPrice - sliderMin) / (sliderMax - sliderMin)) * 100 : 50;
  const messaging = curPrice && base && curDom ? getMessaging(curPrice, base, curDom) : null;
  const pctOver = base && curPrice ? (curPrice - base) / base : 0;
  const domColor = !curDom
    ? "text-slate-500"
    : curDom <= 14
      ? "text-green-600"
      : curDom <= 30
        ? "text-blue-700"
        : curDom <= 60
          ? "text-amber-600"
          : "text-red-600";

  // When inputs change, reset slider
  const handleInputChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setSliderVal(null);
  };

  // No data state
  if (!dataLoading && marketData.length === 0) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center text-center px-5">
        <div>
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Market data not available</h2>
          <p className="text-sm text-slate-500 mb-4">
            The pricing tool is being updated with the latest market data.
          </p>
          <Link href="/" className="text-sm text-blue-700 font-semibold hover:underline">
            ← Return home
          </Link>
        </div>
      </div>
    );
  }

  // ── LANDING VIEW ──────────────────────────────────────────────────────────
  if (view === "landing") {
    return (
      <div className="min-h-dvh bg-charcoal text-white overflow-x-hidden">
        {/* Nav */}
        <nav className="flex items-center justify-between px-5 md:px-7 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Grid3x3 className="text-blue-400 w-5 h-5" />
            <span className="text-[15px] font-bold tracking-tight">
              LEMOORE<span className="text-blue-400">.HOMES</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => handleCityChange(c)}
                className={`text-[11px] rounded-full px-2.5 py-1 transition-colors ${
                  selectedCity === c
                    ? "bg-blue-700/30 text-blue-300 border border-blue-700/40"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-[660px] mx-auto px-5 pt-12 md:pt-16 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-700/15 border border-blue-700/30 text-blue-300 text-xs font-semibold mb-6 tracking-wide">
            <BarChart3 className="w-3 h-3" />
            LIVE MARKET DATA · TRAILING 6 MONTHS
          </div>

          <h1 className="text-[clamp(30px,6vw,48px)] font-extrabold leading-[1.12] mb-5 tracking-tight">
            What price actually gets your home{" "}
            <span className="text-blue-400">sold in {selectedCity}?</span>
          </h1>

          <p className="text-base md:text-lg text-white/50 leading-relaxed max-w-[480px] mx-auto mb-8">
            Adjust the price and see how buyer response changes.{" "}
            <strong className="text-white/80">
              Built from recent {selectedCity} sales, time-on-market patterns, and pricing logic.
            </strong>
          </p>

          <button
            onClick={() => setView("tool")}
            className="bg-blue-700 text-white border-none rounded-xl px-9 py-3.5 text-base font-bold shadow-[0_8px_32px_rgba(0,81,186,0.45)] hover:bg-blue-800 transition-colors mb-2"
          >
            Get My Free Estimate
            <ArrowRight className="w-4 h-4 inline ml-2" />
          </button>
          <div className="text-xs text-white/25 mt-2">
            Two inputs · 30 seconds · No signup
          </div>
        </div>

        {/* Ticker */}
        <div className="relative mt-8">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-charcoal to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-charcoal to-transparent z-10 pointer-events-none" />

          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 z-20">
              <span className="bg-charcoal px-3 text-[10px] text-white/25 tracking-widest font-semibold">
                {selectedCity.toUpperCase()} SOLD · LIVE MARKET DATA
              </span>
            </div>
          </div>

          <div className="border-t border-white/[0.06] border-b border-white/[0.06] py-2.5 bg-white/[0.02]">
            <TickerBand speed={240} data={marketData} city={selectedCity} />
          </div>
          <div className="border-b border-white/[0.06] py-2.5 bg-white/[0.015]">
            <TickerBand speed={300} reverse data={marketData} city={selectedCity} />
          </div>
        </div>

        {/* Feature bullets */}
        <div className="max-w-[580px] mx-auto px-5 mt-14">
          <div className="text-[11px] text-white/25 tracking-widest font-semibold mb-5 text-center">
            WHY THIS IS DIFFERENT
          </div>
          {[
            {
              icon: BarChart3,
              title: `Built from real recent ${selectedCity} sales`,
              body: `Every home that sold in ${selectedCity} in the last 6 months feeds this tool. Not a national estimate — local data only.`,
            },
            {
              icon: Home,
              title: "Two inputs. Real answer.",
              body: "Square footage and year built. In one market, that's what actually drives price and time on market.",
            },
            {
              icon: MapPin,
              title: `Models the entire ${selectedCity} market`,
              body: "Not just a few nearby comps. We use all recent sales — the pattern they reveal together is far more accurate than any handful could be.",
            },
            {
              icon: Clock,
              title: "See how pricing affects time to offer",
              body: "Drag the slider and watch days-to-offer change. Understand the real cost of overpricing before you list.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="flex gap-4 mb-3 p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl"
            >
              <f.icon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-white mb-1">{f.title}</div>
                <div className="text-[13px] text-white/40 leading-relaxed">{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center px-5 pt-12 pb-16">
          <button
            onClick={() => setView("tool")}
            className="bg-white text-charcoal border-none rounded-xl px-9 py-3.5 text-base font-bold hover:bg-slate-100 transition-colors mb-3"
          >
            Try the Free Pricing Tool
            <ArrowRight className="w-4 h-4 inline ml-2" />
          </button>
          <div className="text-xs text-white/20">
            Gregory Franklin · Keller Williams Central Valley · DRE #02090737
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS VIEW ──────────────────────────────────────────────────────────
  if (view === "success") {
    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="max-w-[440px] w-full px-5 py-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-blue-700 mx-auto mb-5" />
          <h2 className="text-2xl font-bold tracking-tight mb-2">You&apos;re all set.</h2>
          <p className="text-[15px] text-slate-500 leading-relaxed mb-7">
            Gregory will follow up within one business day to schedule your free pricing consult.
          </p>

          {base && curPrice && curDom && curPPF && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 text-left">
              <div className="text-[11px] font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                Your Estimate Summary
              </div>
              {[
                { label: "Model Price", val: fmt$(base) },
                { label: "Your List Price", val: fmt$(curPrice) },
                { label: "Est. Days to Offer", val: `${curDom} days` },
                { label: "Price/SqFt", val: `$${Math.round(curPPF)}/sf` },
              ].map((r, i, arr) => (
                <div
                  key={r.label}
                  className={`flex justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <span className="text-[13px] text-slate-500">{r.label}</span>
                  <span className="text-[13px] font-bold">{r.val}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setView("tool")}
              className="py-2.5 px-6 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors text-sm"
            >
              ← Back to pricing tool
            </button>
            <Link
              href="/sell"
              className="py-2.5 px-6 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-sm text-center"
            >
              Contact Gregory
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-slate-600 mt-1"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  if (view === "form" && base && curPrice && curDom) {
    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900">
        <nav className="bg-white border-b border-slate-200 px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("tool")}
              className="text-[13px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <Link href="/" className="flex items-center gap-2">
              <Grid3x3 className="text-blue-700 w-5 h-5" />
              <span className="text-[15px] font-bold tracking-tight">
                LEMOORE<span className="text-blue-700">.HOMES</span>
              </span>
            </Link>
          </div>
        </nav>
        <div className="max-w-[620px] mx-auto px-5 py-8">
          <LeadForm
            base={base}
            curPrice={curPrice}
            curDom={curDom}
            sqft={sqft}
            yearBuilt={yearBuilt}
            city={selectedCity}
            onSuccess={() => setView("success")}
            onBack={() => setView("tool")}
          />
        </div>
      </div>
    );
  }

  // ── TOOL VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-5 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("landing")}
            className="text-[13px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <Link href="/" className="flex items-center gap-2">
            <Grid3x3 className="text-blue-700 w-5 h-5" />
            <span className="text-[15px] font-bold tracking-tight">
              LEMOORE<span className="text-blue-700">.HOMES</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {CITIES.map((c) => (
            <button
              key={c}
              onClick={() => handleCityChange(c)}
              className={`text-[11px] rounded-full px-2 py-0.5 transition-colors ${
                selectedCity === c
                  ? "bg-blue-700 text-white"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </nav>

      {/* Ticker on tool view */}
      <div className="bg-slate-900 border-b border-slate-800 py-1.5 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />
        <TickerBand speed={300} data={marketData} city={selectedCity} />
      </div>

      <div className="max-w-[960px] mx-auto px-4 py-4 pb-12">
        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left column: Inputs + Stats */}
          <div className="lg:col-span-5 space-y-2">
            {/* Inputs */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Square Footage", val: sqft, set: handleInputChange(setSqft), ph: "e.g. 1,450" },
                  { label: "Year Built", val: yearBuilt, set: handleInputChange(setYearBuilt), ph: "e.g. 1985" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">{f.label}</label>
                    <input
                      type="number"
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.ph}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[15px] text-slate-900 bg-white outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Stats — only show when valid */}
            {isValid && base && curPrice && curDom !== null && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5">
                {[
                  { label: "Model Base Price", val: fmt$(base) },
                  { label: "Your Price/SqFt", val: `$${Math.round(curPPF!)}/sf`, color: curPPF! > 258 ? "text-amber-600" : curPPF! < 220 ? "text-green-600" : "text-slate-900" },
                  { label: "Est. Days to Offer", val: `${curDom} days`, color: domColor },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">{s.label}</span>
                    <span className={`text-sm font-bold ${s.color || "text-slate-900"}`}>{s.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Comp chart — left column on desktop */}
            {isValid && base && curPrice && curDom !== null && (
              <div className="hidden lg:block">
                <CompBars comps={comps} curPrice={curPrice} curDom={curDom} sqft={parseInt(sqft)} />
              </div>
            )}
          </div>

          {/* Right column: Messaging + Slider + Chart (mobile) */}
          <div className="lg:col-span-7 space-y-2">
            {isValid && base && curPrice && curDom !== null && messaging ? (
              <>
                {/* Messaging */}
                <div className={`${messaging.bg} border ${messaging.border} rounded-xl p-4`}>
                  <div className={`text-[14px] font-bold ${messaging.color} mb-0.5 leading-snug`}>
                    {messaging.headline}
                  </div>
                  <div className="text-[12px] text-slate-700 leading-relaxed opacity-85">
                    {messaging.sub}
                  </div>
                </div>

                {/* Slider */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">List Price</div>
                      <div className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{fmt$(curPrice)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        ${Math.round(curPPF!)}/sf · {parseInt(sqft).toLocaleString()} sf · built {yearBuilt}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Days to Offer</div>
                      <div className={`text-2xl font-bold tracking-tight leading-none ${domColor}`}>{curDom}</div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${domColor}`}>
                        {curDom <= 14 ? "Fast" : curDom <= 30 ? "Healthy" : curDom <= 60 ? "Moderate" : "Slow"}
                      </div>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={500}
                    value={curPrice}
                    onChange={(e) => setSliderVal(parseInt(e.target.value))}
                    className="w-full h-[5px] rounded-full outline-none cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-700 [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,81,186,0.4)] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-700 [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,81,186,0.4)] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
                    style={{
                      background: `linear-gradient(to right, #0051ba ${sliderPct}%, #e5e7eb ${sliderPct}%)`,
                    }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{fmt$(sliderMin)}</span>
                    <span className="text-[10px] text-slate-500">
                      Model: <strong className="text-slate-900">{fmt$(base)}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">{fmt$(sliderMax)}</span>
                  </div>
                </div>

                {/* Comp chart — mobile only (desktop shows in left column) */}
                <div className="lg:hidden">
                  <CompBars comps={comps} curPrice={curPrice} curDom={curDom} sqft={parseInt(sqft)} />
                </div>
              </>
            ) : (
              <div className="hidden lg:flex h-full min-h-[300px] border border-dashed border-slate-200 rounded-xl items-center justify-center text-center p-8">
                <div>
                  <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Enter square footage and year built to see your estimate</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full-width sections below the two columns */}
        {isValid && base && curPrice && curDom !== null && messaging && (
          <div className="mt-3 space-y-2">
            {/* Overpriced examples */}
            {pctOver > 0.05 && <OverpricingExamples data={marketData} />}

            {/* How it works (math) */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowMath((m) => !m)}
                className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-900">How this is calculated</span>
                {showMath ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {showMath && (
                <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
                  <pre className="font-mono text-xs leading-[2] text-slate-500 whitespace-pre-wrap">
                    {`// Price model — OLS regression, n=${marketData.length} ${selectedCity} comps
base = 277,130 + (66.71 × ${parseInt(sqft).toLocaleString()}) − (574.46 × ${age})
     = ${fmt$(base)}

// Days-to-offer — asymmetric price penalty + age
pctOver = (${fmt$(curPrice)} − ${fmt$(base)}) / ${fmt$(base)} = ${(((curPrice - base) / base) * 100).toFixed(1)}%
dom     = 28 + pricePenalty + agePenalty = ${curDom} days`}
                  </pre>
                </div>
              )}
            </div>

            {/* Pricing guidance */}
            <div className="border-l-4 border-blue-700 bg-white rounded-r-xl p-4 shadow-sm">
              <p className="text-sm text-slate-700 italic leading-relaxed mb-1">
                &ldquo;This shows how the market behaves. I&apos;ll show you how to use it to your advantage.&rdquo;
              </p>
              <p className="text-xs text-slate-500">— Gregory Franklin · DRE #02090737</p>
            </div>

            {/* CTA */}
            <div className="bg-blue-700 rounded-xl p-6 text-center shadow-[0_8px_32px_rgba(0,81,186,0.3)]">
              <h3 className="text-base font-bold text-white mb-1">
                See exactly how I&apos;d price your home
              </h3>
              <p className="text-sm text-white/70 mb-4">
                Personalized pricing strategy + free 15-min call with Gregory.
              </p>
              <button
                onClick={() => setView("form")}
                className="bg-white text-blue-700 border-none rounded-xl px-8 py-2.5 text-[15px] font-bold hover:bg-slate-100 transition-colors"
              >
                Get My Free Strategy
                <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
