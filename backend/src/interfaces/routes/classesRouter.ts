/**
 * Express router — /api/classes
 *
 * Routes:
 *   GET /api/classes/:id — alias for GET /api/bookings/:id
 *
 * "Class" and "Booking" are the same entity — this route provides a
 * semantically cleaner URL for parents who think in terms of classes.
 *
 * No business logic — delegates entirely to GetBookingUseCase.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { GetBookingUseCase } from '../../application/useCases/GetBooking';

const ClassIdSchema = z.object({
  id: z.string().uuid('Class id must be a valid UUID'),
});

export function createClassesRouter(getBooking: GetBookingUseCase): Router {
  const router = Router();

  router.get('/:id', async (req, res, next) => {
    try {
      const parsed = ClassIdSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
        return;
      }
      const result = await getBooking.execute(parsed.data.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
