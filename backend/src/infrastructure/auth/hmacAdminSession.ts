import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AdminSessionService } from '../../application/ports/AdminAuth';

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class HmacAdminSession implements AdminSessionService {
  private readonly live = new Set<string>();

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number = ADMIN_SESSION_TTL_MS,
  ) {}

  static fromEnv(): HmacAdminSession {
    return new HmacAdminSession(process.env.ADMIN_SESSION_SECRET ?? '');
  }

  issue(now: Date = new Date()): string {
    if (!this.secret) {
      throw new Error('ADMIN_SESSION_SECRET is not configured');
    }
    const payload = Buffer.from(JSON.stringify({ exp: now.getTime() + this.ttlMs }), 'utf8').toString('base64url');
    const token = `${payload}.${this.sign(payload)}`;
    this.live.add(token);
    return token;
  }

  verify(token: string | undefined, now: Date = new Date()): boolean {
    if (!this.secret || !token || !this.live.has(token)) return false;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return false;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = this.sign(payload);
    if (!timingSafeEqualStringBuffers(sig, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
      const ok = typeof parsed.exp === 'number' && parsed.exp > now.getTime();
      if (!ok) this.live.delete(token);
      return ok;
    } catch {
      this.live.delete(token);
      return false;
    }
  }

  revoke(token: string | undefined): void {
    if (token) this.live.delete(token);
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

function timingSafeEqualStringBuffers(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
