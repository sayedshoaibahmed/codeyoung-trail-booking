/**
 * Application entry point.
 *
 * Route map:
 *   GET  /api/availability           — available 1-hour slots
 *   POST /api/bookings               — create booking (with Idempotency-Key)
 *   GET  /api/bookings/:id           — fetch booking
 *   POST /api/bookings/:id/cancel    — cancel booking (with cancellationToken)
 *   GET  /api/classes/:id            — alias for GET /api/bookings/:id
 *   GET  /api/admin/dashboard        — admin read-only dashboard
 */
import 'dotenv/config';
import express from 'express';
import {
  prisma,
  getAvailabilityUseCase,
  bookClassUseCase,
  cancelClassUseCase,
  getBookingUseCase,
  getAdminDashboardUseCase,
} from './infrastructure';
import { createAvailabilityRouter } from './interfaces/routes/availabilityRouter';
import { createBookingRouter }      from './interfaces/routes/bookingRouter';
import { createClassesRouter }      from './interfaces/routes/classesRouter';
import { createAdminRouter }        from './interfaces/routes/adminRouter';
import { errorHandler }             from './interfaces/middleware/errorHandler';

const app = express();
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'CodeYoung API', version: '1.0.0' });
});

// ── API routes ────────────────────────────────────────────────────────────
const api = express.Router();
api.use(createAvailabilityRouter(getAvailabilityUseCase));
api.use('/bookings', createBookingRouter(bookClassUseCase, getBookingUseCase, cancelClassUseCase));
api.use('/classes', createClassesRouter(getBookingUseCase));
api.use('/admin', createAdminRouter(getAdminDashboardUseCase));
app.use('/api', api);

// ── Error handler (must come AFTER all routes) ────────────────────────────
app.use(errorHandler);

// ── Server ────────────────────────────────────────────────────────────────
const port = process.env.PORT ?? 3000;
const server = app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

const shutdown = async (): Promise<void> => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT',  () => { void shutdown(); });
