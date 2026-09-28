import { timingSafeEqual } from 'node:crypto';

/** Constant-time string compare that does not leak length via early return alone. */
export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  const size = Math.max(a.length, b.length, 1);
  const pa = Buffer.alloc(size);
  const pb = Buffer.alloc(size);
  a.copy(pa);
  b.copy(pb);
  const sameBytes = timingSafeEqual(pa, pb);
  return sameBytes && a.length === b.length;
}
