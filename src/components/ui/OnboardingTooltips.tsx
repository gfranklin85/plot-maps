"use client";

import { useState, useEffect } from "react";
import MaterialIcon from "./MaterialIcon";

const STORAGE_KEY = "pm_onboarding_complete";

interface Step {
  title: string;
  description: string;
  icon: string;
  position: "top-left" | "top-center" | "top-right" | "center";
}

const STEPS: Step[] = [
  {
    title: "Welcome to Plot Maps",
    description: "Let\u2019s take a quick tour of the tools you\u2019ll use to prospect. This will only take a moment.",
    icon: "explore",
    position: "center",
  },
  {
    title: "Map Controls",
    description: "Switch between Map, Satellite, and Hybrid views. Filter by Active, Sold, or Pending listings to see what\u2019s happening in your market.",
    icon: "tune",
    position: "top-left",
  },
  {
    title: "Walk Mode",
    description: "Virtually walk any street at ground level. See the houses while you call \u2014 the ultimate prospecting advantage.",
    icon: "directions_walk",
    position: "top-right",
  },
  {
    title: "Select Prospects",
    description: "Click this to start selecting houses on the map. Each click captures an address you can order contact info for.",
    icon: "ads_click",
    position: "top-right",
  },
  {
    title: "Reference Properties",
    description: "Colored pins are market data \u2014 Active (green), Sold (yellow), Pending (purple). Click any pin to see comps, talking points, and use them in your calls.",
    icon: "location_on",
    position: "center",
  },
  {
    title: "Wallet & Orders",
    description: "Add funds to your wallet, then select at least 20 properties to order. We\u2019ll get you owner names and phone numbers for each address.",
    icon: "account_balance_wallet",
    position: "top-right",
  },
  {
    title: "You\u2019re All Set!",
    description: "Start exploring your market. Click any property to see data, walk streets, and build your prospect lists.",
    icon: "rocket_launch",
    position: "center",
  },
];

export default function OnboardingTooltips() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the map loads first
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  }

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Position classes based on what we're pointing at
  const positionClasses = {
    "top-left": "top-20 left-4 md:left-72",
    "top-center": "top-20 left-1/2 -translate-x-1/2",
    "top-right": "top-20 right-4",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleDismiss} />

      {/* Tooltip */}
      <div className={`absolute ${positionClasses[current.position]} z-10 w-[320px] md:w-[380px]`}>
        <div className="bg-card rounded-2xl border border-card-border shadow-2xl overflow-hidden">
          {/* Header with icon */}
          <div className="bg-primary/10 px-6 pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <MaterialIcon icon={current.icon} className="text-[24px] text-primary" />
            </div>
            <div>
              <h3 className="font-headline text-base font-bold text-on-surface">{current.title}</h3>
              <p className="text-[10px] text-on-surface-variant">{step + 1} of {STEPS.length}</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-on-surface-variant leading-relaxed">{current.description}</p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <button
              onClick={handleDismiss}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {isFirst ? "Skip tour" : "Skip"}
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <MaterialIcon icon="arrow_forward" className="text-[16px]" />}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === step ? "bg-primary w-4" : i < step ? "bg-primary/40" : "bg-on-surface-variant/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
