/**
 * Composition root — infrastructure/index.ts
 *
 * The ONLY file allowed to import from both application/ and infrastructure/
 * in the same place. All port-to-implementation bindings happen here.
 */
import prisma from './database/prismaClient';
import { PrismaMentorRepository }  from './database/PrismaMentorRepository';
import { PrismaBookingRepository } from './database/PrismaBookingRepository';
import { PrismaIdempotencyStore }  from './database/PrismaIdempotencyStore';
import { PrismaUnitOfWork }        from './database/PrismaUnitOfWork';
import { LuxonTimezoneService }    from './timezone/LuxonTimezoneService';
import { MockEmailService }        from './email/MockEmailService';
import { GetAvailabilityUseCase }  from '../application/useCases/GetAvailability';
import { BookClassUseCase }        from '../application/useCases/BookClass';

// ── Infrastructure singletons ─────────────────────────────────────────────
export const mentorRepository  = new PrismaMentorRepository(prisma);
export const bookingRepository = new PrismaBookingRepository(prisma);
export const idempotencyStore  = new PrismaIdempotencyStore(prisma);
export const unitOfWork        = new PrismaUnitOfWork(prisma);
export const timezoneService   = new LuxonTimezoneService();
export const emailService      = new MockEmailService();

// ── Application use cases ─────────────────────────────────────────────────
export const getAvailabilityUseCase = new GetAvailabilityUseCase(
  mentorRepository,
  timezoneService,
);

export const bookClassUseCase = new BookClassUseCase(
  unitOfWork,
  idempotencyStore,
  timezoneService,
  emailService,
  mentorRepository,   // used for alternate-slot queries outside the tx
);

// Re-export prisma for graceful shutdown in index.ts
export { prisma };
