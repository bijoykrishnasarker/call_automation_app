import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/** Ensures the user has an organization_id on their profile (required by VAPI/canonical schema). */
export async function ensureOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
  fallbackName?: string | null
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  const existing = profile?.organization_id;
  if (typeof existing === 'string' && existing.trim()) return existing;

  try {
    const admin = createSupabaseServiceClient();
    const name = (fallbackName?.trim() || 'My Business').slice(0, 120);
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name, owner_user_id: userId })
      .select('id')
      .single();

    if (orgError || !org?.id) {
      console.warn('[ensureOrganizationForUser] org insert', orgError?.message);
      return null;
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      organization_id: org.id,
      role: 'owner',
    });

    if (profileError) {
      console.warn('[ensureOrganizationForUser] profile upsert', profileError.message);
      return org.id as string;
    }

    return org.id as string;
  } catch (err) {
    console.warn('[ensureOrganizationForUser]', err);
    return null;
  }
}
