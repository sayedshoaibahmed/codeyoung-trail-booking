/**
 * Express router — POST /api/bookings
 *
 * Validates the request body with Zod at this boundary; a clean, typed DTO
 * is passed into the use case. No Prisma or Luxon imports here.
 *
 * Idempotency-Key header is required for all POST requests.
 *
 * Error mapping for SlotNotAvailableError: returns HTTP 409 with alternate slots.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { BookClassUseCase } from '../../application/useCases/BookClass';
import { SlotNotAvailableError } from '../../domain/errors';

// ── Zod schema ────────────────────────────────────────────────────────────────

const BookClassBodySchema = z.object({
  parentName: z
    .string()
    .trim()
    .min(1, 'parentName is required and must not be blank')
    .max(200),
  parentEmail: z
    .string()
    .email('parentEmail must be a valid email address'),
  childName: z
    .string()
    .trim()
    .min(1, 'childName is required and must not be blank')
    .max(200),
  parentTimezone: z
    .string()
    .min(1, 'parentTimezone is required'),
  /** Local date-time in the parent's timezone — NO timezone suffix. */
  requestedStartIso: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      'requestedStartIso must be YYYY-MM-DDTHH:mm:ss (no timezone suffix)',
    ),
});


export function createBookingRouter(bookClass: BookClassUseCase): Router {
  const router = Router();

  router.post('/bookings', async (req, res, next) => {
    try {
      // ── Validate Idempotency-Key header ───────────────────────────────────
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
        res.status(400).json({
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'The Idempotency-Key header is required for booking creation.',
        });
        return;
      }

      // ── Validate request body with Zod ────────────────────────────────────
      const parseResult = BookClassBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request body is invalid.',
          errors: parseResult.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      // ── Invoke use case with clean DTO ────────────────────────────────────
      const dto = { ...parseResult.data, idempotencyKey: idempotencyKey.trim() };
      const result = await bookClass.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      // Special handling for SlotNotAvailableError: include alternate slots in body
      if (err instanceof SlotNotAvailableError) {
        res.status(409).json({
          code: err.code,
          message: err.message,
          alternateSlots: err.alternateSlots,
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
