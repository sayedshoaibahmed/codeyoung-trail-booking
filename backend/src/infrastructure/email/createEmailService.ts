/**
 * Chooses the EmailService implementation.
 * Tests always get the console mock. All other environments use Resend.
 */
import type { EmailService } from '../../application/ports/EmailService';
import { MockEmailService } from './MockEmailService';
import { ResendEmailService } from './ResendEmailService';

export function createEmailService(): EmailService {
  if (process.env.NODE_ENV === 'test') {
    return new MockEmailService();
  }
  return new ResendEmailService();
}
