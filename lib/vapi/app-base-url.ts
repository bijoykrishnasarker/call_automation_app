/**
 * Public origin for server-side code that must build absolute URLs (e.g. Vapi MCP tool `server.url`).
 * Set `APP_BASE_URL` in production (e.g. `https://your-app.vercel.app`).
 * Falls back to `NEXT_PUBLIC_APP_URL`, then `VERCEL_URL` (https).
 */
export function getAppBaseUrl(): string | null {
  const explicit =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }
  return null;
}
