export interface AdminCredentialVerifier {
  verify(username: string, password: string): boolean;
}

export interface AdminSessionService {
  issue(now?: Date): string;
  verify(token: string | undefined, now?: Date): boolean;
  revoke(token: string | undefined): void;
}
