/**
 * Detect Postgres "column does not exist" from Supabase/PostgREST responses
 * (e.g. migration not yet applied on production).
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = (error.message ?? '').toLowerCase();
  if (code === '42703') return true;
  if (msg.includes('column') && msg.includes('does not exist')) return true;
  if (msg.includes('could not find') && msg.includes('column')) return true;
  return false;
}
