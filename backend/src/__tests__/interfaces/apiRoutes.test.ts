/**
 * Item 25 — API Validation Errors
 *
 * Tests the HTTP interface layer (Express routes + error handler) in isolation.
 * Each use case is replaced by a vi.fn() mock so no database is involved.
 *
 * Validates:
 *   POST /api/bookings        — missing Idempotency-Key, invalid fields
 *   GET  /api/availability    — missing / invalid query params
 *   GET  /api/bookings/:id    — non-UUID id
 *   POST /api/bookings/:id/cancel — missing token, non-UUID id
 *   Error propagation from use-case layer (404, 409, 400, 401)
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';

import { createAvailabilityRouter } from '../../interfaces/routes/availabilityRouter';
import { createBookingRouter }      from '../../interfaces/routes/bookingRouter';
import { createBookingAccessRouter } from '../../interfaces/routes/bookingAccessRouter';
import { createClassesRouter }      from '../../interfaces/routes/classesRouter';
import { createAdminRouter }        from '../../interfaces/routes/adminRouter';
import { errorHandler }             from '../../interfaces/middleware/errorHandler';

import {
  BookingNotFoundError,
  BookingLinkInvalidError,
  LeadTimeViolationError,
  SlotNotAvailableError,
  InvalidTimezoneError,
  InvalidDateFormatError,
  CancellationTokenInvalidError,
  CancellationAfterStartError,
  IdempotencyConflictError,
  DstNonexistentTimeError,
} from '../../domain/errors';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Must be a proper RFC-4122 UUID (version nibble 1-5, variant nibble 8/9/a/b)
// so Zod v4's z.string().uuid() accepts it.
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const VALID_BOOKING_BODY = {
  parentName:        'Alice',
  parentEmail:       'alice@test.com',
  childName:         'Bob',
  parentTimezone:    'Asia/Kolkata',
  requestedStartIso: '2024-11-04T10:00:00',
};

const BOOKING_SUCCESS_RESPONSE = {
  bookingId:         VALID_UUID,
  mentorName:        'Mentor A',
  startUtc:          '2024-11-04T04:30:00.000Z',
  endUtc:            '2024-11-04T05:30:00.000Z',
  meetingLink:       'https://meet.codeyoung.com/class/test',
  cancellationToken: 'raw-token-abc',
  accessToken:       'raw-access-abc',
  status:            'CONFIRMED',
};

const BOOKING_DTO = {
  id:              VALID_UUID,
  parentName:      'Alice',
  parentEmail:     'alice@test.com',
  childName:       'Bob',
  parentTimezone:  'Asia/Kolkata',
  startTimeUtc:    '2024-11-04T04:30:00.000Z',
  endTimeUtc:      '2024-11-04T05:30:00.000Z',
  mentorId:        'mentor-1',
  mentorName:      'Mentor A',
  mentorTimezone:  'Asia/Kolkata',
  mentorLocalDate: '2024-11-04',
  meetingLink:     'https://meet.codeyoung.com/class/test',
  status:          'CONFIRMED',
  cancelledAt:     null,
  createdAt:       '2024-11-04T00:00:00.000Z',
  updatedAt:       '2024-11-04T00:00:00.000Z',
};

/**
 * Builds a minimal Express app wired with mock use cases.
 * Returns the `app` and the mock execute functions so individual tests can
 * override them with `mockRejectedValueOnce`.
 */
function buildTestApp() {
  const mockGetAvailability = {
    execute: vi.fn().mockResolvedValue({
      date: '2024-11-04', timezone: 'Asia/Kolkata', slots: [],
    }),
  };
  const mockBookClass = {
    execute: vi.fn().mockResolvedValue(BOOKING_SUCCESS_RESPONSE),
  };
  const mockGetBooking = {
    execute: vi.fn().mockResolvedValue(BOOKING_DTO),
  };
  const mockGetBookingByAccess = {
    execute: vi.fn().mockResolvedValue(BOOKING_DTO),
  };
  const mockCancelClass = {
    execute: vi.fn().mockResolvedValue({
      bookingId:        VALID_UUID,
      status:           'CANCELLED',
      cancelledAt:      '2024-11-04T08:00:00.000Z',
      alreadyCancelled: false,
    }),
  };
  const mockGetAdminDashboard = {
    execute: vi.fn().mockResolvedValue({
      generatedAt: new Date().toISOString(),
      summary:     { totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0 },
      upcomingConfirmed: [],
      recentlyCancelled: [],
      mentorUtilization: [],
    }),
  };

  const app = express();
  app.use(express.json());

  const api = express.Router();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.use(createAvailabilityRouter(mockGetAvailability as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.use('/booking-access', createBookingAccessRouter(mockGetBookingByAccess as any));
  api.use('/bookings', createBookingRouter(mockBookClass as any, mockGetBooking as any, mockCancelClass as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.use('/classes', createClassesRouter(mockGetBooking as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.use('/admin', createAdminRouter(mockGetAdminDashboard as any));
  app.use('/api', api);
  app.use(errorHandler);

  return {
    request: supertest(app),
    mocks: { mockGetAvailability, mockBookClass, mockGetBooking, mockGetBookingByAccess, mockCancelClass },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — Item 25: API Validation Errors
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 25 — API validation errors', () => {

  // ── POST /api/bookings ───────────────────────────────────────────────────

  describe('POST /api/bookings — request validation', () => {
    it('400 MISSING_IDEMPOTENCY_KEY when Idempotency-Key header is absent', async () => {
      const { request } = buildTestApp();
      const res = await request.post('/api/bookings').send(VALID_BOOKING_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('400 MISSING_IDEMPOTENCY_KEY when Idempotency-Key header is blank', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', '   ')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('400 VALIDATION_ERROR for empty parentName', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ ...VALID_BOOKING_BODY, parentName: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toBeInstanceOf(Array);
    });

    it('400 VALIDATION_ERROR for invalid parentEmail', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ ...VALID_BOOKING_BODY, parentEmail: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR for empty childName', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ ...VALID_BOOKING_BODY, childName: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR when requestedStartIso has a timezone suffix (Z)', async () => {
      // The schema requires no suffix: YYYY-MM-DDTHH:mm:ss only.
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ ...VALID_BOOKING_BODY, requestedStartIso: '2024-11-04T10:00:00Z' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR when requestedStartIso has +offset suffix', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ ...VALID_BOOKING_BODY, requestedStartIso: '2024-11-04T10:00:00+05:30' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR when required fields are missing entirely', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send({ parentEmail: 'alice@test.com' });  // missing name, childName, etc.
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('201 and booking result on a perfectly valid request', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(201);
      expect(res.body.bookingId).toBeDefined();
      expect(res.body.status).toBe('CONFIRMED');
    });
  });

  // ── POST /api/bookings — domain error propagation ────────────────────────

  describe('POST /api/bookings — domain error propagation', () => {
    it('400 LEAD_TIME_VIOLATION when use case throws it', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockBookClass.execute.mockRejectedValueOnce(new LeadTimeViolationError(2));
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LEAD_TIME_VIOLATION');
    });

    it('400 DST_NONEXISTENT_TIME when use case throws it', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockBookClass.execute.mockRejectedValueOnce(
        new DstNonexistentTimeError('2024-03-10T02:30:00', 'America/New_York'),
      );
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DST_NONEXISTENT_TIME');
    });

    it('400 IDEMPOTENCY_CONFLICT when use case throws it', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockBookClass.execute.mockRejectedValueOnce(
        new IdempotencyConflictError('test-key'),
      );
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('409 SLOT_NOT_AVAILABLE when use case throws SlotNotAvailableError', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockBookClass.execute.mockRejectedValueOnce(
        new SlotNotAvailableError([
          { startUtc: '2024-11-04T05:30:00.000Z', endUtc: '2024-11-04T06:30:00.000Z' },
        ]),
      );
      const res = await request
        .post('/api/bookings')
        .set('Idempotency-Key', 'test-key')
        .send(VALID_BOOKING_BODY);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SLOT_NOT_AVAILABLE');
      expect(res.body.alternateSlots).toBeInstanceOf(Array);
    });
  });

  // ── GET /api/availability ────────────────────────────────────────────────

  describe('GET /api/availability — query param validation', () => {
    it('400 INVALID_DATE_FORMAT when `date` query param is missing', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/availability?timezone=Asia/Kolkata');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE_FORMAT');
    });

    it('400 INVALID_TIMEZONE when `timezone` query param is missing', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/availability?date=2024-11-04');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMEZONE');
    });

    it('400 INVALID_TIMEZONE when use case rejects unknown timezone', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockGetAvailability.execute.mockRejectedValueOnce(
        new InvalidTimezoneError('America/Fake'),
      );
      const res = await request.get('/api/availability?date=2024-11-04&timezone=America/Fake');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMEZONE');
    });

    it('400 INVALID_DATE_FORMAT when use case rejects a bad date string', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockGetAvailability.execute.mockRejectedValueOnce(
        new InvalidDateFormatError('20241104'),
      );
      const res = await request.get('/api/availability?date=20241104&timezone=Asia/Kolkata');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE_FORMAT');
    });

    it('200 with slots array on valid params', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/availability?date=2024-11-04&timezone=Asia/Kolkata');
      expect(res.status).toBe(200);
      expect(res.body.slots).toBeInstanceOf(Array);
    });
  });

  // ── GET /api/bookings/:id ────────────────────────────────────────────────

  describe('GET /api/bookings/:id — id validation', () => {
    it('400 VALIDATION_ERROR for a non-UUID booking id', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/bookings/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR for a partial UUID', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/bookings/00000000-0000-0000-0000');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('404 BOOKING_LINK_INVALID without revealing whether the id exists', async () => {
      const { request, mocks } = buildTestApp();
      const res = await request.get(`/api/bookings/${VALID_UUID}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('BOOKING_LINK_INVALID');
      expect(res.body.message).toBe('Booking link is invalid or has expired.');
      expect(JSON.stringify(res.body)).not.toContain(VALID_UUID);
      expect(mocks.mockGetBooking.execute).not.toHaveBeenCalled();
    });

    it('does not return private booking fields for a booking id alone', async () => {
      const { request } = buildTestApp();
      const res = await request.get(`/api/bookings/${VALID_UUID}`);
      expect(res.status).toBe(404);
      expect(res.body.parentName).toBeUndefined();
      expect(res.body.parentEmail).toBeUndefined();
      expect(res.body.childName).toBeUndefined();
    });
  });

  describe('POST /api/booking-access', () => {
    it('200 with the booking for a valid access credential', async () => {
      const { request } = buildTestApp();
      const res = await request.post('/api/booking-access').send({ accessToken: 'valid-access-token' });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(VALID_UUID);
    });

    it('404 BOOKING_LINK_INVALID for an invalid credential', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockGetBookingByAccess.execute.mockRejectedValueOnce(new BookingLinkInvalidError());
      const res = await request.post('/api/booking-access').send({ accessToken: 'wrong-token' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('BOOKING_LINK_INVALID');
      expect(res.body.message).toBe('Booking link is invalid or has expired.');
      expect(JSON.stringify(res.body)).not.toMatch(/Alice|alice@test.com|Bob/);
    });

    it('404 BOOKING_LINK_INVALID when the access token is missing', async () => {
      const { request } = buildTestApp();
      const res = await request.post('/api/booking-access').send({});
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('BOOKING_LINK_INVALID');
    });
  });

  // ── POST /api/bookings/:id/cancel ────────────────────────────────────────

  describe('POST /api/bookings/:id/cancel — validation', () => {
    it('400 VALIDATION_ERROR for a non-UUID booking id', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post('/api/bookings/not-a-uuid/cancel')
        .send({ cancellationToken: 'token' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR when cancellationToken is missing', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 VALIDATION_ERROR when cancellationToken is an empty string', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({ cancellationToken: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('401 CANCELLATION_TOKEN_INVALID when use case rejects the token', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockCancelClass.execute.mockRejectedValueOnce(new CancellationTokenInvalidError());
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({ cancellationToken: 'wrong-token' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('CANCELLATION_TOKEN_INVALID');
    });

    it('409 CANCELLATION_AFTER_START when use case rejects late cancellation', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockCancelClass.execute.mockRejectedValueOnce(new CancellationAfterStartError());
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({ cancellationToken: 'valid-but-too-late' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANCELLATION_AFTER_START');
    });

    it('404 BOOKING_NOT_FOUND when booking does not exist', async () => {
      const { request, mocks } = buildTestApp();
      mocks.mockCancelClass.execute.mockRejectedValueOnce(new BookingNotFoundError(VALID_UUID));
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({ cancellationToken: 'some-token' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('BOOKING_NOT_FOUND');
    });

    it('200 on a valid cancellation', async () => {
      const { request } = buildTestApp();
      const res = await request
        .post(`/api/bookings/${VALID_UUID}/cancel`)
        .send({ cancellationToken: 'correct-token' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });

  // ── GET /api/admin/dashboard ─────────────────────────────────────────────

  describe('GET /api/admin/dashboard', () => {
    it('200 with dashboard shape on valid request', async () => {
      const { request } = buildTestApp();
      const res = await request.get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.upcomingConfirmed).toBeInstanceOf(Array);
      expect(res.body.recentlyCancelled).toBeInstanceOf(Array);
      expect(res.body.mentorUtilization).toBeInstanceOf(Array);
    });
  });
});
