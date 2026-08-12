import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Bypass Navigator LockManager to prevent "lock:sb-*-auth-token timed out waiting 10000ms" deadlock in browsers
    lock: typeof window !== 'undefined'
      ? async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn()
      : undefined,
  },
});
