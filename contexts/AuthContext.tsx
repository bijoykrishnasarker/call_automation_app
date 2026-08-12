'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

/** Stable string for logs / devtools (PostgREST errors sometimes log as `{}`). */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const parts = [o.message, o.code, o.details, o.hint]
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (parts.length) return parts.join(' · ');
    const compact = Object.fromEntries(
      Object.entries(o).filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    );
    if (Object.keys(compact).length > 0) {
      try {
        return JSON.stringify(compact);
      } catch {
        /* fall through */
      }
    }
    try {
      const s = JSON.stringify(error);
      if (s !== '{}') return s;
    } catch {
      /* fall through */
    }
    return Object.prototype.toString.call(error);
  }
  return String(error);
}

function isMissingProfileSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const details = [
    'message' in error ? error.message : undefined,
    'details' in error ? error.details : undefined,
    'hint' in error ? error.hint : undefined,
    'code' in error ? error.code : undefined,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  return (
    details.includes('schema cache') ||
    details.includes("could not find the 'organization_id' column") ||
    details.includes("could not find a relationship between 'profiles' and 'organizations'") ||
    details.includes('does not exist') ||
    (details.includes('relation') && details.includes('profiles')) ||
    details.includes('pgrst')
  );
}

export interface User {
  id?: string;
  email: string;
  fullName?: string;
}

function mapSupabaseUser(sbUser: SupabaseUser | null): User | null {
  if (!sbUser?.email) return null;
  const fullName = sbUser.user_metadata?.full_name as string | undefined;
  return {
    id: sbUser.id,
    email: sbUser.email,
    ...(fullName && { fullName }),
  };
}

function sessionToUser(session: Session | null): User | null {
  return session?.user ? mapSupabaseUser(session.user) : null;
}

interface AuthContextType {
  user: User | null;
  profile: any | null;
  isReady: boolean;
  hasOrganization: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [hasOrganization, setHasOrganization] = useState<boolean>(true); // Default to true to avoid flash
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Load profile columns that exist in DB (avoid selecting e.g. `role` if migration not applied).
      // Resolve organization name in a second query so we do not rely on PostgREST FK embedding.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        if (isMissingProfileSchema(profileError)) {
          setProfile(null);
          setHasOrganization(false);
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Auth] Profile fetch:', describeError(profileError));
        }
        // Leave hasOrganization and profile as last known state to avoid onboarding redirect loops
        return;
      }

      if (!profileData) {
        setProfile(null);
        setHasOrganization(false);
        return;
      }

      const orgId = profileData.organization_id as string | null | undefined;
      if (orgId) {
        const { data: orgRow, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();

        if (orgError && process.env.NODE_ENV === 'development') {
          console.warn('[Auth] Organization name fetch:', describeError(orgError));
        }

        setProfile({ ...profileData, organizations: orgRow ?? null });
        setHasOrganization(true);
      } else {
        setProfile(profileData);
        setHasOrganization(false);
      }
    } catch (e) {
      if (isMissingProfileSchema(e)) {
        setProfile(null);
        setHasOrganization(false);
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Auth] Profile fetch (unexpected):', describeError(e));
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Mark ready immediately so the app renders with zero loading screen.
    // onAuthStateChange below handles all session state reactively.
    setIsReady(true);

    // Quietly load the existing session in the background.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const mappedUser = sessionToUser(session);
      setUser(mappedUser);
      if (mappedUser?.id) {
        fetchProfile(mappedUser.id);
      } else {
        setHasOrganization(true);
      }
    }).catch(() => {
      // On any error just leave user as null — login page will show.
    });

    init();

    // Dummy init to satisfy linter — real work is above.
    async function init() {}

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const mappedUser = sessionToUser(session);
      setUser(mappedUser);
      
      if (mappedUser?.id) {
        await fetchProfile(mappedUser.id);
      } else {
        setProfile(null);
        setHasOrganization(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> => {
      setAuthError(null);
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : `${process.env.APP_BASE_URL}/login`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { full_name: fullName },
          emailRedirectTo: redirectTo
        },
      });
      
      if (error) {
        setAuthError(error.message);
        throw error;
      }
      return { needsEmailConfirmation: !data.session };
    },
    []
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : `${process.env.APP_BASE_URL}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isReady,
        hasOrganization,
        authError,
        clearAuthError,
        login,
        register,
        logout,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
