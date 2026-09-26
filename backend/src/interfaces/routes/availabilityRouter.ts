/**
 * Express router — GET /api/availability
 *
 * Query parameters:
 *   date     YYYY-MM-DD  — the calendar date in the parent's timezone
 *   timezone string      — IANA timezone identifier (e.g. America/New_York)
 *
 * Calls GetAvailabilityUseCase and returns available 1-hour slots.
 */
import { Router } from 'express';
import type { GetAvailabilityUseCase } from '../../application/useCases/GetAvailability';
import { InvalidDateFormatError, InvalidTimezoneError } from '../../domain/errors';

export function createAvailabilityRouter(
  getAvailability: GetAvailabilityUseCase,
): Router {
  const router = Router();

  router.get('/availability', async (req, res, next) => {
    try {
      const { date, timezone } = req.query as Record<string, string | undefined>;

      if (!date) {
        throw new InvalidDateFormatError('(missing)');
      }
      if (!timezone) {
        throw new InvalidTimezoneError('(missing)');
      }

      const result = await getAvailability.execute({ date, timezone });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
