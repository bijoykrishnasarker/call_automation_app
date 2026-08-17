/**
 * Detect Postgres "column does not exist" from Supabase/PostgREST responses
 * (e.g. migration not yet applied on production).
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const msg = (error.message ?? '').toLowerCase();
  if (code === '42703') return true;
  if (code === 'PGRST204') return true;
  if (msg.includes('column') && msg.includes('does not exist')) return true;
  if (msg.includes('could not find') && msg.includes('column')) return true;
  return false;
}

export function missingColumnName(error: { message?: string } | null): string | null {
  if (!error?.message) return null;
  const schemaCache = /could not find the '([^']+)' column/i.exec(error.message);
  if (schemaCache?.[1]) return schemaCache[1];
  const quoted = /column "([^"]+)" of relation/i.exec(error.message);
  if (quoted?.[1]) return quoted[1];
  return null;
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export function friendlyContactWriteError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Failed to save contact';
  const code = String(error.code ?? '');
  const msg = (error.message ?? '').toLowerCase();
  if (code === '23502' || msg.includes('not-null') || msg.includes('null value')) {
    if (msg.includes('external_contact_id')) return 'Contact save failed. Refresh the page and try again.';
    if (msg.includes('organization_id')) return 'Finish account setup before adding contacts.';
    return `Database rejected this contact: ${error.message ?? 'missing required field'}`;
  }
  if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
    return 'A contact with this information already exists.';
  }
  if (code === '23503' || msg.includes('foreign key')) {
    return 'Could not save this contact. Check the details and try again.';
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return 'You do not have permission to add this contact.';
  }
  if (error.message?.trim()) return error.message;
  return 'Failed to save contact';
}
