/**
 * Issues an admin session token after verifying env-backed credentials.
 * Never logs or returns the password.
 */
import type { AdminCredentialVerifier, AdminSessionService } from '../ports/AdminAuth';
import { AdminInvalidCredentialsError } from '../../domain/errors';

export interface AuthenticateAdminDto {
  username: string;
  password: string;
}

export class AuthenticateAdminUseCase {
  constructor(
    private readonly credentials: AdminCredentialVerifier,
    private readonly sessions: AdminSessionService,
  ) {}

  execute(dto: AuthenticateAdminDto): { token: string } {
    if (!this.credentials.verify(dto.username.trim(), dto.password)) {
      throw new AdminInvalidCredentialsError();
    }
    return { token: this.sessions.issue() };
  }
}
