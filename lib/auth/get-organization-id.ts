import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for resolving the current user's organization_id.
 * Used by all API routes that need tenant isolation.
 *
 * Reads from public.profiles: id = auth user id, returns organization_id.
 * Requires: profiles table with columns (id, organization_id) and RLS allowing
 * the user to read their own row.
 */
export async function getOrganizationIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  const orgId = data?.organization_id;
  return typeof orgId === 'string' && orgId.length > 0 ? orgId : null;
}
