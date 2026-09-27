/**
 * Composition root — infrastructure/index.ts
 *
 * The ONLY file allowed to import from both application/ and infrastructure/
 * in the same place. All port-to-implementation bindings happen here.
 */
import prisma from './database/prismaClient';
import { PrismaMentorRepository }         from './database/PrismaMentorRepository';
import { PrismaBookingRepository }        from './database/PrismaBookingRepository';
import { PrismaIdempotencyStore }         from './database/PrismaIdempotencyStore';
import { PrismaUnitOfWork }              from './database/PrismaUnitOfWork';
import { PrismaAdminDashboardRepository } from './database/PrismaAdminDashboardRepository';
import { LuxonTimezoneService }          from './timezone/LuxonTimezoneService';
import { NodemailerEmailService }         from './email/NodemailerEmailService';
import { MockEmailService }              from './email/MockEmailService';
import { GetAvailabilityUseCase }        from '../application/useCases/GetAvailability';
import { GetNextAvailableDateUseCase }   from '../application/useCases/GetNextAvailableDate';
import { BookClassUseCase }              from '../application/useCases/BookClass';
import { CancelClassUseCase }            from '../application/useCases/CancelClass';
import { GetBookingUseCase }             from '../application/useCases/GetBooking';
import { GetBookingByAccessUseCase }     from '../application/useCases/GetBookingByAccess';
import { GetAdminDashboardUseCase }      from '../application/useCases/GetAdminDashboard';

// ── Infrastructure singletons ─────────────────────────────────────────────
export const mentorRepository        = new PrismaMentorRepository(prisma);
export const bookingRepository       = new PrismaBookingRepository(prisma);
export const idempotencyStore        = new PrismaIdempotencyStore(prisma);
export const unitOfWork              = new PrismaUnitOfWork(prisma);
export const adminDashboardRepository = new PrismaAdminDashboardRepository(prisma);
export const timezoneService         = new LuxonTimezoneService();

// Use Nodemailer/Ethereal in dev/prod; MockEmailService in tests.
export const emailService =
  process.env.NODE_ENV === 'test'
    ? new MockEmailService()
    : new NodemailerEmailService();

// ── Application use cases ─────────────────────────────────────────────────
export const getAvailabilityUseCase = new GetAvailabilityUseCase(
  mentorRepository,
  timezoneService,
);

export const getNextAvailableDateUseCase = new GetNextAvailableDateUseCase(
  getAvailabilityUseCase,
  timezoneService,
);

export const bookClassUseCase = new BookClassUseCase(
  unitOfWork,
  idempotencyStore,
  timezoneService,
  emailService,
  mentorRepository,
);

export const cancelClassUseCase = new CancelClassUseCase(
  unitOfWork,
  bookingRepository,
  mentorRepository,
  timezoneService,
  emailService,
);

export const getBookingUseCase = new GetBookingUseCase(
  bookingRepository,
  mentorRepository,
);

export const getBookingByAccessUseCase = new GetBookingByAccessUseCase(
  bookingRepository,
  mentorRepository,
);

export const getAdminDashboardUseCase = new GetAdminDashboardUseCase(
  adminDashboardRepository,
  timezoneService,
);

// Re-export prisma for graceful shutdown in index.ts
export { prisma };
