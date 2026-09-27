/**
 * Express router — POST /api/booking-access
 *
 * Token is accepted in the request body (not a query string) so access-log
 * URLs do not carry the credential. Controllers do not log the token.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { GetBookingByAccessUseCase } from '../../application/useCases/GetBookingByAccess';
import { BookingLinkInvalidError } from '../../domain/errors';

const AccessBodySchema = z.object({
  accessToken: z.string().min(1).max(256),
});

export function createBookingAccessRouter(getBookingByAccess: GetBookingByAccessUseCase): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const parsed = AccessBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BookingLinkInvalidError();
      }

      const result = await getBookingByAccess.execute({
        accessToken: parsed.data.accessToken,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
