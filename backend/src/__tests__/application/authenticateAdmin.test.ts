import { describe, it, expect } from 'vitest';
import { AuthenticateAdminUseCase } from '../../application/useCases/AuthenticateAdmin';
import { HmacAdminSession } from '../../infrastructure/auth/hmacAdminSession';
import { EnvAdminCredentials } from '../../infrastructure/auth/envAdminCredentials';
import { AdminInvalidCredentialsError } from '../../domain/errors';

const USER = 'codeyoung';
const PASS = 'codeyoung';

function buildUseCase() {
  const sessions = new HmacAdminSession('test-admin-session-secret-32chars');
  const credentials = new EnvAdminCredentials(USER, PASS);
  return {
    uc: new AuthenticateAdminUseCase(credentials, sessions),
    sessions,
  };
}

describe('AuthenticateAdminUseCase', () => {
  it('issues a session token for valid username and password', () => {
    const { uc, sessions } = buildUseCase();
    const result = uc.execute({ username: USER, password: PASS });
    expect(result.token).toBeTruthy();
    expect(sessions.verify(result.token)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(PASS);
  });

  it('rejects an invalid username', () => {
    const { uc } = buildUseCase();
    expect(() => uc.execute({ username: 'wrong', password: PASS })).toThrow(AdminInvalidCredentialsError);
  });

  it('rejects an invalid password', () => {
    const { uc } = buildUseCase();
    expect(() => uc.execute({ username: USER, password: 'wrong' })).toThrow(AdminInvalidCredentialsError);
  });
});
