/**
 * Application entry point.
 *
 * Route map:
 *   GET  /api/availability           — available 1-hour slots
 *   POST /api/bookings               — create booking (with Idempotency-Key)
 *   GET  /api/bookings/:id           — does not return private booking details
 *   POST /api/booking-access         — fetch booking by access token (body)
 *   POST /api/bookings/:id/cancel    — cancel booking (with cancellationToken)
 *   GET  /api/classes/:id            — same privacy rule as GET /api/bookings/:id
 *   GET  /api/admin/dashboard        — admin read-only dashboard
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  prisma,
  getAvailabilityUseCase,
  getNextAvailableDateUseCase,
  bookClassUseCase,
  cancelClassUseCase,
  getBookingUseCase,
  getBookingByAccessUseCase,
  getAdminDashboardUseCase,
} from './infrastructure';
import { createAvailabilityRouter } from './interfaces/routes/availabilityRouter';
import { createBookingRouter }      from './interfaces/routes/bookingRouter';
import { createBookingAccessRouter } from './interfaces/routes/bookingAccessRouter';
import { createClassesRouter }      from './interfaces/routes/classesRouter';
import { createAdminRouter }        from './interfaces/routes/adminRouter';
import { errorHandler }             from './interfaces/middleware/errorHandler';

/** Local Vite origins used during development. */
const LOCAL_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

/**
 * Extra browser origins from FRONTEND_ORIGIN / FRONTEND_ORIGINS
 * (comma-separated). Use these for the Vercel production URL and any
 * custom domain. Example: https://codeyoung.vercel.app
 */
function configuredFrontendOrigins(): string[] {
  const raw = [process.env.FRONTEND_ORIGIN, process.env.FRONTEND_ORIGINS]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(',');
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedFrontendOrigin(origin: string): boolean {
  if (LOCAL_FRONTEND_ORIGINS.includes(origin)) return true;
  if (configuredFrontendOrigins().includes(origin)) return true;

  // Vercel preview and default production hosts: https://<project>.vercel.app
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const app = express();
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients (curl, Render health checks) send no Origin.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isAllowedFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'CodeYoung API', version: '1.0.0' });
});

// ── API routes ────────────────────────────────────────────────────────────
const api = express.Router();
api.use(createAvailabilityRouter(getAvailabilityUseCase, getNextAvailableDateUseCase));
api.use('/booking-access', createBookingAccessRouter(getBookingByAccessUseCase));
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
