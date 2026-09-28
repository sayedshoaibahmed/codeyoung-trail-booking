import type { CookieOptions } from 'express';

export const ADMIN_SESSION_COOKIE = 'cy_admin_session';
export const ADMIN_SESSION_MAX_AGE_SEC = 8 * 60 * 60;

export function adminCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
}

export function clearAdminCookieOptions(): CookieOptions {
  return {
    ...adminCookieOptions(),
    maxAge: 0,
  };
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return undefined;
}
