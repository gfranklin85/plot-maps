"use client";

// BuyerSettingsProvider — the global mortgage-knob state.
//
// Wraps the map page (and any future detail page). Every card billboard
// consumes this via useBuyerSettings(). Changing a knob re-renders all
// visible cards in real time — that's the Plot moment Zillow/Redfin
// don't have on their browse surfaces.
//
// Persistence: localStorage for now (works for unauth visitors, which is
// the demo audience for June 9). When user auth lands, this can mirror
// to the profile.settings JSON.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BuyerSettings, DEFAULT_BUYER_SETTINGS } from "./piti";

const STORAGE_KEY = "plotmaps.buyerSettings.v1";

interface BuyerSettingsContextValue {
  settings: BuyerSettings;
  updateSettings: (patch: Partial<BuyerSettings>) => void;
  resetSettings: () => void;
}

const BuyerSettingsContext = createContext<BuyerSettingsContextValue | null>(null);

function readStored(): BuyerSettings {
  if (typeof window === "undefined") return DEFAULT_BUYER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUYER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<BuyerSettings>;
    return { ...DEFAULT_BUYER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_BUYER_SETTINGS;
  }
}

function writeStored(s: BuyerSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / privacy mode — degrade silently */
  }
}

export function BuyerSettingsProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer so SSR + hydration agree (returns the default).
  // First effect rehydrates from localStorage on the client.
  const [settings, setSettings] = useState<BuyerSettings>(DEFAULT_BUYER_SETTINGS);

  useEffect(() => {
    setSettings(readStored());
  }, []);

  const updateSettings = useCallback((patch: Partial<BuyerSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_BUYER_SETTINGS);
    writeStored(DEFAULT_BUYER_SETTINGS);
  }, []);

  const value = useMemo<BuyerSettingsContextValue>(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
  );

  return (
    <BuyerSettingsContext.Provider value={value}>
      {children}
    </BuyerSettingsContext.Provider>
  );
}

export function useBuyerSettings(): BuyerSettingsContextValue {
  const ctx = useContext(BuyerSettingsContext);
  if (!ctx) {
    throw new Error("useBuyerSettings must be used inside <BuyerSettingsProvider>");
  }
  return ctx;
}
