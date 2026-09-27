/**
 * Express router — /api/bookings
 *
 * Routes:
 *   POST /api/bookings          — create (BookClassUseCase)
 *   GET  /api/bookings/:id      — fetch (GetBookingUseCase)
 *   POST /api/bookings/:id/cancel — cancel (CancelClassUseCase)
 *
 * Design rules:
 *   - Zod validates ALL inputs at this boundary.
 *   - Controllers only translate HTTP ↔ use case; no business logic.
 *   - Domain errors are forwarded to the centralised error handler via next(err).
 *   - No Prisma imports.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { BookClassUseCase }   from '../../application/useCases/BookClass';
import type { GetBookingUseCase }  from '../../application/useCases/GetBooking';
import type { CancelClassUseCase } from '../../application/useCases/CancelClass';
import { SlotNotAvailableError }   from '../../domain/errors';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const BookClassBodySchema = z.object({
  parentName:        z.string().trim().min(1, 'parentName is required').max(200),
  parentEmail:       z.string().email('parentEmail must be a valid email address'),
  childName:         z.string().trim().min(1, 'childName is required').max(200),
  parentTimezone:    z.string().min(1, 'parentTimezone is required'),
  requestedStartIso: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      'requestedStartIso must be YYYY-MM-DDTHH:mm:ss (no timezone suffix)',
    ),
});

const BookingIdSchema = z.object({
  id: z.string().uuid('Booking id must be a valid UUID'),
});

const CancelBodySchema = z.object({
  cancellationToken: z
    .string()
    .min(1, 'cancellationToken is required')
    .max(256),
});

// ── Helper: Zod 400 response ──────────────────────────────────────────────────

function zodError(res: import('express').Response, result: z.ZodError): void {
  res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    errors: result.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  });
}

// ── Router factory ────────────────────────────────────────────────────────────

export function createBookingRouter(
  bookClass:   BookClassUseCase,
  getBooking:  GetBookingUseCase,
  cancelClass: CancelClassUseCase,
): Router {
  const router = Router();

  // ── POST /api/bookings ────────────────────────────────────────────────────
  router.post('/', async (req, res, next) => {
    try {
      // Idempotency-Key header (required)
      const rawKey = req.headers['idempotency-key'];
      if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
        res.status(400).json({
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'The Idempotency-Key header is required.',
        });
        return;
      }

      const parsed = BookClassBodySchema.safeParse(req.body);
      if (!parsed.success) { zodError(res, parsed.error); return; }

      const result = await bookClass.execute({
        ...parsed.data,
        idempotencyKey: rawKey.trim(),
      });
      res.status(201).json(result);
    } catch (err) {
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

  // ── GET /api/bookings/:id ─────────────────────────────────────────────────
  // Booking id alone must not disclose private parent/student details.
  router.get('/:id', (req, res) => {
    const parsed = BookingIdSchema.safeParse(req.params);
    if (!parsed.success) { zodError(res, parsed.error); return; }

    void getBooking;
    res.status(404).json({
      code: 'BOOKING_LINK_INVALID',
      message: 'Booking link is invalid or has expired.',
    });
  });

  // ── POST /api/bookings/:id/cancel ─────────────────────────────────────────
  router.post('/:id/cancel', async (req, res, next) => {
    try {
      const paramsParsed = BookingIdSchema.safeParse(req.params);
      if (!paramsParsed.success) { zodError(res, paramsParsed.error); return; }

      const bodyParsed = CancelBodySchema.safeParse(req.body);
      if (!bodyParsed.success) { zodError(res, bodyParsed.error); return; }

      const result = await cancelClass.execute({
        bookingId:         paramsParsed.data.id,
        cancellationToken: bodyParsed.data.cancellationToken,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
