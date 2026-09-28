import type { AdminCredentialVerifier } from '../../application/ports/AdminAuth';
import { timingSafeEqualString } from './timingSafeEqual';

export class EnvAdminCredentials implements AdminCredentialVerifier {
  constructor(
    private readonly usernameOverride?: string,
    private readonly passwordOverride?: string,
  ) {}

  static fromEnv(): EnvAdminCredentials {
    return new EnvAdminCredentials();
  }

  verify(username: string, password: string): boolean {
    const expectedUser = (this.usernameOverride ?? process.env.ADMIN_USERNAME ?? '').trim();
    const expectedPass = (this.passwordOverride ?? process.env.ADMIN_PASSWORD ?? '').trim();
    if (!expectedUser || !expectedPass) return false;
    const userOk = timingSafeEqualString(username.trim(), expectedUser);
    const passOk = timingSafeEqualString(password, expectedPass);
    return userOk && passOk;
  }
}
