'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppProvider } from '@/contexts/AppContext';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';

// ✅ DEV BYPASS: Set to true to skip login and access the app directly (development only)
// IMPORTANT: Set this to false before deploying to production!
const DEV_BYPASS_AUTH = false;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isReady, hasOrganization } = useAuth();
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/');

  // DEV BYPASS: Skip authentication and render app directly
  if (DEV_BYPASS_AUTH) {
    return (
      <AppProvider>
        <AppShell>{children}</AppShell>
      </AppProvider>
    );
  }

  useEffect(() => {
    if (!isReady) return;
    
    const isOnboardingPage = pathname === '/onboarding';
    
    // Recovery flow: stay on login page even if logged in
    const isRecovery = typeof window !== 'undefined' && 
      (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='));

    if (!user && !isLoginPage) {
      router.replace('/login');
      return;
    }
    
    if (user && isLoginPage && !isRecovery) {
      router.replace('/');
      return;
    }

    // New: Check for organization
    if (user && !hasOrganization && !isOnboardingPage && !isRecovery) {
      router.push('/onboarding');
      return;
    }

    // Redirect away from onboarding if already has org
    if (user && hasOrganization && isOnboardingPage) {
      router.replace('/');
      return;
    }
  }, [user, isReady, isLoginPage, hasOrganization, pathname, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  const isOnboardingPage = pathname === '/onboarding';

  if (!user && isLoginPage) {
    return <>{children}</>;
  }

  if (user && isOnboardingPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
