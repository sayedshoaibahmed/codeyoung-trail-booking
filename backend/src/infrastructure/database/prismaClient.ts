/**
 * Prisma client singleton.
 *
 * Instantiated once and reused across the entire application lifecycle.
 * Prevents connection pool exhaustion from multiple PrismaClient instances.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;
