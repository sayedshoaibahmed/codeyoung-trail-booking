/**
 * Application entry point.
 */
import 'dotenv/config';
import express from 'express';
import { prisma, getAvailabilityUseCase } from './infrastructure';
import { createAvailabilityRouter } from './interfaces/routes/availabilityRouter';
import { errorHandler } from './interfaces/middleware/errorHandler';

const app = express();
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'CodeYoung API' });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api', createAvailabilityRouter(getAvailabilityUseCase));

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
