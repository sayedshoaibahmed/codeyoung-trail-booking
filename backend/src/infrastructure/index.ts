/**
 * Composition root — infrastructure/index.ts
 *
 * Instantiates all concrete infrastructure implementations and wires them to
 * the application-layer port interfaces. This is the ONLY file in the project
 * that is allowed to import from both application/ and infrastructure/ in the
 * same place.
 *
 * Nothing in domain/ or application/ imports from this file. Only interfaces/
 * and index.ts (the entry point) import from here.
 */
import prisma from './database/prismaClient';
import { PrismaMentorRepository } from './database/PrismaMentorRepository';
import { PrismaBookingRepository } from './database/PrismaBookingRepository';
import { PrismaIdempotencyStore } from './database/PrismaIdempotencyStore';

// Singletons — created once, shared across the application lifetime.
export const mentorRepository = new PrismaMentorRepository(prisma);
export const bookingRepository = new PrismaBookingRepository(prisma);
export const idempotencyStore = new PrismaIdempotencyStore(prisma);

// Re-export prisma for use in the composition root / entry point only.
export { prisma };
