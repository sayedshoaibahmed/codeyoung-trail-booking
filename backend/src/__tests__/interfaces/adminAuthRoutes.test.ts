import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createAdminRouter } from '../../interfaces/routes/adminRouter';
import { errorHandler } from '../../interfaces/middleware/errorHandler';
import { AuthenticateAdminUseCase } from '../../application/useCases/AuthenticateAdmin';
import { HmacAdminSession } from '../../infrastructure/auth/hmacAdminSession';
import { EnvAdminCredentials } from '../../infrastructure/auth/envAdminCredentials';

const USER = 'codeyoung';
const PASS = 'codeyoung';

function buildApp() {
  const sessions = new HmacAdminSession('test-admin-session-secret-32chars');
  const authenticateAdmin = new AuthenticateAdminUseCase(new EnvAdminCredentials(USER, PASS), sessions);
  const getDashboard = {
    execute: vi.fn().mockResolvedValue({
      generatedAt: new Date().toISOString(),
      summary: { totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0 },
      upcomingConfirmed: [],
      recentlyCancelled: [],
      mentorUtilization: [],
    }),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({
    getDashboard: getDashboard as never,
    authenticateAdmin,
    sessions,
    loginRateLimit: (_req, _res, next) => next(),
  }));
  app.use(errorHandler);
  return { request: supertest(app), getDashboard };
}

describe('admin auth HTTP', () => {
  it('valid username/password → successful login with httpOnly cookie', async () => {
    const { request } = buildApp();
    const res = await request.post('/api/admin/login').send({ username: USER, password: PASS });
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(PASS);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/cy_admin_session=/);
    expect(cookie.toLowerCase()).toMatch(/httponly/);
  });

  it('invalid username → rejected', async () => {
    const { request } = buildApp();
    const res = await request.post('/api/admin/login').send({ username: 'nope', password: PASS });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('invalid password → rejected', async () => {
    const { request } = buildApp();
    const res = await request.post('/api/admin/login').send({ username: USER, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('unauthenticated admin API request → rejected', async () => {
    const { request, getDashboard } = buildApp();
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ADMIN_UNAUTHORIZED');
    expect(getDashboard.execute).not.toHaveBeenCalled();
  });

  it('authenticated admin API request → allowed', async () => {
    const { request, getDashboard } = buildApp();
    const login = await request.post('/api/admin/login').send({ username: USER, password: PASS });
    const res = await request.get('/api/admin/dashboard').set('Cookie', login.headers['set-cookie']);
    expect(res.status).toBe(200);
    expect(getDashboard.execute).toHaveBeenCalledOnce();
  });

  it('logout → session invalidated', async () => {
    const { request } = buildApp();
    const login = await request.post('/api/admin/login').send({ username: USER, password: PASS });
    const cookie = login.headers['set-cookie'];
    const out = await request.post('/api/admin/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    const after = await request.get('/api/admin/session').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});
