/**
 * Public origin for server-side code that must build absolute URLs (e.g. Vapi MCP tool `server.url`).
 * Set `APP_BASE_URL` in production (e.g. `https://your-app.vercel.app`).
 * Falls back to `NEXT_PUBLIC_APP_URL`, then `VERCEL_URL` (https).
 */
function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function getAppBaseUrl(): string | null {
  const explicit =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const cleaned = explicit.replace(/\/$/, '');
    if (!isLocalhostUrl(cleaned)) {
      return cleaned;
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  return null;
}
