import type { NextRequest } from 'next/server';

/**
 * Public origin for server-side code that must build absolute URLs (e.g. Vapi MCP tool `server.url`).
 * Set `APP_BASE_URL` in production (e.g. `https://your-app.vercel.app`).
 * Falls back to `NEXT_PUBLIC_APP_URL`, Vercel production URL, `VERCEL_URL`, then the incoming request origin.
 */
function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function normalizeOrigin(origin: string): string | null {
  const cleaned = origin.trim().replace(/\/$/, '');
  if (!cleaned || isLocalhostUrl(cleaned)) return null;
  return cleaned;
}

function originFromRequest(request: Pick<NextRequest, 'headers' | 'url'>): string | null {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    const firstHost = forwardedHost.split(',')[0]?.trim();
    if (firstHost) {
      return normalizeOrigin(`${forwardedProto}://${firstHost}`);
    }
  }

  try {
    return normalizeOrigin(new URL(request.url).origin);
  } catch {
    return null;
  }
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

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) {
    const host = productionUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
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

/** Prefer env config, then the public origin of the current HTTP request (e.g. Vercel production URL on Sync). */
export function resolveAppBaseUrl(request?: Pick<NextRequest, 'headers' | 'url'>): string | null {
  const fromEnv = getAppBaseUrl();
  if (fromEnv && !isLocalhostUrl(fromEnv)) {
    return fromEnv;
  }

  if (request) {
    const fromRequest = originFromRequest(request);
    if (fromRequest) {
      return fromRequest;
    }
  }

  return fromEnv;
}
