import type { NextRequest } from 'next/server';

/**
 * Public origin for Vapi webhook/tool URLs.
 * Localhost is never returned — Vapi cannot reach it.
 * Prefer `NEXT_PUBLIC_APP_URL` / `VAPI_PUBLIC_BASE_URL`, then a non-local `APP_BASE_URL`,
 * then Vercel production URL, then the incoming request origin.
 */
function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function normalizeOrigin(origin: string): string | null {
  const cleaned = origin.trim().replace(/\/$/, '');
  if (!cleaned || isLocalhostUrl(cleaned)) return null;
  if (!/^https?:\/\//i.test(cleaned)) {
    return `https://${cleaned}`;
  }
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
  const candidates = [
    process.env.VAPI_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
  ];

  for (const raw of candidates) {
    const normalized = normalizeOrigin(raw ?? '');
    if (normalized) return normalized;
  }

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) {
    return normalizeOrigin(productionUrl);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return normalizeOrigin(vercel);
  }

  return null;
}

/** Prefer a public env URL, then the public origin of the current HTTP request. Never localhost. */
export function resolveAppBaseUrl(request?: Pick<NextRequest, 'headers' | 'url'>): string | null {
  const fromEnv = getAppBaseUrl();
  if (fromEnv) return fromEnv;
  if (request) return originFromRequest(request);
  return null;
}
