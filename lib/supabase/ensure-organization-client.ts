import { supabase } from '@/lib/supabase/client';

/** Creates org + profile from the browser when onboarding was skipped. */
export async function ensureOrganizationForUserClient(
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

  const name = (fallbackName?.trim() || 'My Business').slice(0, 120);
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, owner_user_id: userId })
    .select('id')
    .single();

  if (orgError || !org?.id) {
    console.warn('[ensureOrganizationForUserClient] org insert', orgError?.message);
    return null;
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    organization_id: org.id,
    role: 'owner',
  });

  if (profileError) {
    console.warn('[ensureOrganizationForUserClient] profile upsert', profileError.message);
  }

  return org.id as string;
}
