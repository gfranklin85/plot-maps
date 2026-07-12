'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session. A stale/half-expired session (a leftover token
    // whose refresh token is dead) makes getSession() attempt a refresh that
    // fails with "Invalid Refresh Token: Refresh Token Not Found" (400).
    // Before the fix this was swallowed, leaving the app in limbo — enough
    // that middleware let a gated page (e.g. /map) render, but the client
    // session never hydrated, stranding the user on a blank loading screen
    // (the mobile blank-map bug, diagnosed live 2026-07-11). Now: catch it,
    // hard-clear the dead session so state is clean, and treat the user as
    // signed out so the normal sign-in path takes over instead of hanging.
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          const msg = error.message?.toLowerCase() ?? '';
          if (msg.includes('refresh token') || msg.includes('invalid') || error.status === 400) {
            // dead token — scrub it (local scope: don't hit the network, the
            // token's already invalid) so nothing stale lingers in cookies/LS.
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            setSession(null); setUser(null); setLoading(false);
            return;
          }
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(async () => {
        // Any unexpected auth failure: clear + treat as signed out, never hang.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setSession(null); setUser(null); setLoading(false);
      });

    // Listen for auth changes. TOKEN_REFRESH_FAILED / SIGNED_OUT both clear.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && !session) {
        setSession(null); setUser(null); setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
