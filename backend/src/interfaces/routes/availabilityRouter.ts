/**
 * Express router — GET /api/availability
 *               — GET /api/availability/next
 *
 * Query parameters:
 *   date     YYYY-MM-DD  — the calendar date in the parent's timezone
 *   timezone string      — IANA timezone identifier (e.g. America/New_York)
 */
import { Router } from 'express';
import type { GetAvailabilityUseCase } from '../../application/useCases/GetAvailability';
import type { GetNextAvailableDateUseCase } from '../../application/useCases/GetNextAvailableDate';
import { InvalidDateFormatError, InvalidTimezoneError } from '../../domain/errors';

export function createAvailabilityRouter(
  getAvailability: GetAvailabilityUseCase,
  getNextAvailableDate: GetNextAvailableDateUseCase,
): Router {
  const router = Router();

  router.get('/availability/next', async (req, res, next) => {
    try {
      const { date, timezone } = req.query as Record<string, string | undefined>;

      if (!date) {
        throw new InvalidDateFormatError('(missing)');
      }
      if (!timezone) {
        throw new InvalidTimezoneError('(missing)');
      }

      const result = await getNextAvailableDate.execute({ date, timezone });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

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
