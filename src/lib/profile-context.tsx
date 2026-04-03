'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface UserProfile {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  defaultMapType: 'roadmap' | 'satellite' | 'hybrid';
  openingScript: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

const STORAGE_KEY = 'plot-maps-profile';

const defaultProfile: UserProfile = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  company: '',
  defaultMapType: 'roadmap',
  openingScript: `Hi, is this {name}?\n\nHey {name} — this is Greg Franklin here in Lemoore. I'm reaching out because a home over on {street} just sold around {value}, and I've been touching base with nearby homeowners since there's been a little more movement in the market.\n\n"I'm just curious — are you guys planning to stay there long term, or do you see yourselves making a move at some point down the road?"\n\n"If you ever did move, what would the next place look like for you?"\n• "Would that be somewhere here locally or somewhere else?"\n• "What would the next house need to have that this one doesn't?"`,
  notifications: {
    email: true,
    push: true,
    sms: false,
  },
};

function getInitials(name: string): string {
  if (!name.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ProfileContextValue {
  profile: UserProfile;
  initials: string;
  updateProfile: (partial: Partial<UserProfile>) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile({ ...defaultProfile, ...JSON.parse(stored) });
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true);
  }, []);

  const updateProfile = useCallback(
    (partial: Partial<UserProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const initials = getInitials(profile.fullName);

  if (!loaded) return null;

  return (
    <ProfileContext.Provider value={{ profile, initials, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
