/**
 * Express router — /api/admin
 *
 * Routes:
 *   GET /api/admin/dashboard — read-only summary for the admin dashboard
 *
 * This is a read-only endpoint. It has no auth middleware in this prototype
 * (auth is out-of-scope per PRD), but the composition root is the right place
 * to add an API-key middleware if needed.
 *
 * No business logic — delegates entirely to GetAdminDashboardUseCase.
 */
import { Router } from 'express';
import type { GetAdminDashboardUseCase } from '../../application/useCases/GetAdminDashboard';

export function createAdminRouter(getDashboard: GetAdminDashboardUseCase): Router {
  const router = Router();

  router.get('/dashboard', async (_req, res, next) => {
    try {
      const data = await getDashboard.execute();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
