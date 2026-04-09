'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ConsentState {
  analytics: boolean;
}

interface ConsentContextValue {
  consent: ConsentState;
  hasConsented: boolean;
  setConsent: (consent: ConsentState) => void;
  resetConsent: () => void;
}

const STORAGE_KEY = 'pm_consent';

const ConsentContext = createContext<ConsentContextValue>({
  consent: { analytics: false },
  hasConsented: false,
  setConsent: () => {},
  resetConsent: () => {},
});

function readStoredConsent(): { consent: ConsentState; hasConsented: boolean } {
  if (typeof window === 'undefined') return { consent: { analytics: false }, hasConsented: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { consent: { analytics: false }, hasConsented: false };
    const parsed = JSON.parse(raw);
    return { consent: { analytics: !!parsed.analytics }, hasConsented: true };
  } catch {
    return { consent: { analytics: false }, hasConsented: false };
  }
}

function writeConsent(consent: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: consent.analytics, timestamp: new Date().toISOString() }));
  // Also set a simple cookie for potential server-side reads
  document.cookie = `pm_consent=${consent.analytics ? '1' : '0'}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentState>({ analytics: false });
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    setConsentState(stored.consent);
    setHasConsented(stored.hasConsented);
  }, []);

  const setConsent = useCallback((newConsent: ConsentState) => {
    setConsentState(newConsent);
    setHasConsented(true);
    writeConsent(newConsent);
  }, []);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'pm_consent=; path=/; max-age=0';
    setConsentState({ analytics: false });
    setHasConsented(false);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, hasConsented, setConsent, resetConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  return useContext(ConsentContext);
}
