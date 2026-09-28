import type { RequestHandler } from 'express';
import type { AdminSessionService } from '../../application/ports/AdminAuth';
import { AdminUnauthorizedError } from '../../domain/errors';
import { ADMIN_SESSION_COOKIE, readCookie } from '../../infrastructure/auth/adminCookie';

export function createRequireAdminAuth(sessions: AdminSessionService): RequestHandler {
  return (req, _res, next) => {
    const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    if (!sessions.verify(token)) {
      next(new AdminUnauthorizedError());
      return;
    }
    next();
  };
}
