'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export interface UserProfile {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  defaultMapType: 'roadmap' | 'satellite' | 'hybrid';
  defaultMapCenter: { lat: number; lng: number } | null;
  openingScript: string;
  subscriptionStatus: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

const defaultProfile: UserProfile = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  company: '',
  defaultMapType: 'roadmap',
  defaultMapCenter: null,
  openingScript: `Hi, is this {name}?\n\nHey {name} — this is Greg Franklin here in Lemoore. I'm reaching out because a home over on {street} just sold around {value}, and I've been touching base with nearby homeowners since there's been a little more movement in the market.\n\n"I'm just curious — are you guys planning to stay there long term, or do you see yourselves making a move at some point down the road?"\n\n"If you ever did move, what would the next place look like for you?"\n• "Would that be somewhere here locally or somewhere else?"\n• "What would the next house need to have that this one doesn't?"`,
  subscriptionStatus: 'trialing',
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
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);

  // Fetch profile from Supabase when user changes
  useEffect(() => {
    if (!user) {
      setProfile(defaultProfile);
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (data) {
        setProfile({
          fullName: data.full_name || '',
          title: data.title || '',
          email: data.email || user!.email || '',
          phone: data.phone || '',
          company: data.company || '',
          defaultMapType: data.default_map_type || 'roadmap',
          defaultMapCenter: data.settings?.defaultMapCenter || null,
          openingScript: data.opening_script || defaultProfile.openingScript,
          subscriptionStatus: data.subscription_status || 'trialing',
          notifications: {
            email: data.notification_email ?? true,
            push: data.notification_push ?? true,
            sms: data.notification_sms ?? false,
          },
        });
      }

      // Migrate from localStorage if DB profile is empty
      const localData = localStorage.getItem('plot-maps-profile');
      if (localData && data && !data.full_name) {
        try {
          const local = JSON.parse(localData);
          if (local.fullName) {
            const migrated = {
              full_name: local.fullName,
              title: local.title,
              email: local.email,
              phone: local.phone,
              company: local.company,
              default_map_type: local.defaultMapType,
              opening_script: local.openingScript,
            };
            await supabase.from('profiles').update(migrated).eq('id', user!.id);
            setProfile((prev) => ({ ...prev, ...local }));
            localStorage.removeItem('plot-maps-profile');
          }
        } catch { /* ignore parse errors */ }
      }

      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  const updateProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...partial };
        return next;
      });

      if (!user) return;

      // Map to DB column names
      const dbUpdate: Record<string, unknown> = {};
      if (partial.fullName !== undefined) dbUpdate.full_name = partial.fullName;
      if (partial.title !== undefined) dbUpdate.title = partial.title;
      if (partial.email !== undefined) dbUpdate.email = partial.email;
      if (partial.phone !== undefined) dbUpdate.phone = partial.phone;
      if (partial.company !== undefined) dbUpdate.company = partial.company;
      if (partial.defaultMapType !== undefined) dbUpdate.default_map_type = partial.defaultMapType;
      if (partial.openingScript !== undefined) dbUpdate.opening_script = partial.openingScript;
      if (partial.defaultMapCenter !== undefined) {
        // Merge into settings jsonb
        const { data: current } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
        dbUpdate.settings = { ...(current?.settings || {}), defaultMapCenter: partial.defaultMapCenter };
      }
      if (partial.notifications !== undefined) {
        dbUpdate.notification_email = partial.notifications.email;
        dbUpdate.notification_push = partial.notifications.push;
        dbUpdate.notification_sms = partial.notifications.sms;
      }

      if (Object.keys(dbUpdate).length > 0) {
        dbUpdate.updated_at = new Date().toISOString();
        await supabase.from('profiles').update(dbUpdate).eq('id', user.id);
      }
    },
    [user],
  );

  const initials = getInitials(profile.fullName);

  return (
    <ProfileContext.Provider value={{ profile, initials, updateProfile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
