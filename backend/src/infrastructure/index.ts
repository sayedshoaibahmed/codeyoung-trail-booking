/**
 * Composition root — infrastructure/index.ts
 *
 * The ONLY file allowed to import from both application/ and infrastructure/
 * in the same place. All port-to-implementation bindings happen here.
 */
import prisma from './database/prismaClient';
import { PrismaMentorRepository } from './database/PrismaMentorRepository';
import { PrismaBookingRepository } from './database/PrismaBookingRepository';
import { PrismaIdempotencyStore } from './database/PrismaIdempotencyStore';
import { LuxonTimezoneService } from './timezone/LuxonTimezoneService';
import { GetAvailabilityUseCase } from '../application/useCases/GetAvailability';

// ── Infrastructure singletons ─────────────────────────────────────────────
export const mentorRepository  = new PrismaMentorRepository(prisma);
export const bookingRepository = new PrismaBookingRepository(prisma);
export const idempotencyStore  = new PrismaIdempotencyStore(prisma);
export const timezoneService   = new LuxonTimezoneService();

// ── Application use cases ─────────────────────────────────────────────────
export const getAvailabilityUseCase = new GetAvailabilityUseCase(
  mentorRepository,
  timezoneService,
);

// Re-export prisma for graceful shutdown in index.ts
export { prisma };
