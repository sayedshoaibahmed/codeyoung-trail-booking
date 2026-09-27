import { createHash } from 'crypto';

/** SHA-256 hex of a high-entropy booking-access token (lookup-safe; not bcrypt). */
export function hashBookingAccessToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
