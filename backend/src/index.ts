/**
 * Application entry point.
 *
 * Responsibilities:
 * 1. Load environment variables.
 * 2. Import from the composition root (infrastructure/) to materialise all
 *    port implementations. This is the only place in the app that "wires"
 *    infrastructure to application use cases.
 * 3. Start the HTTP server.
 * 4. Gracefully disconnect Prisma on shutdown.
 */
import 'dotenv/config';
import express from 'express';
import { prisma } from './infrastructure';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'CodeYoung API' });
});

const port = process.env.PORT ?? 3000;
const server = app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

// Graceful shutdown — disconnect Prisma so the process can exit cleanly.
const shutdown = async (): Promise<void> => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT',  () => { void shutdown(); });
