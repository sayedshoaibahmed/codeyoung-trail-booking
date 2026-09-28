/**
 * Composition root — infrastructure/index.ts
 *
 * The ONLY file allowed to import from both application/ and infrastructure/
 * in the same place. All port-to-implementation bindings happen here.
 */
import '../loadEnv';
import prisma from './database/prismaClient';
import { PrismaMentorRepository }         from './database/PrismaMentorRepository';
import { PrismaBookingRepository }        from './database/PrismaBookingRepository';
import { PrismaIdempotencyStore }         from './database/PrismaIdempotencyStore';
import { PrismaUnitOfWork }              from './database/PrismaUnitOfWork';
import { PrismaAdminDashboardRepository } from './database/PrismaAdminDashboardRepository';
import { LuxonTimezoneService }          from './timezone/LuxonTimezoneService';
import { MockEmailService }              from './email/MockEmailService';
import { createEmailService }            from './email/createEmailService';
import { GetAvailabilityUseCase }        from '../application/useCases/GetAvailability';
import { GetNextAvailableDateUseCase }   from '../application/useCases/GetNextAvailableDate';
import { BookClassUseCase }              from '../application/useCases/BookClass';
import { CancelClassUseCase }            from '../application/useCases/CancelClass';
import { GetBookingUseCase }             from '../application/useCases/GetBooking';
import { GetBookingByAccessUseCase }     from '../application/useCases/GetBookingByAccess';
import { GetAdminDashboardUseCase }      from '../application/useCases/GetAdminDashboard';
import { AuthenticateAdminUseCase }      from '../application/useCases/AuthenticateAdmin';
import { EnvAdminCredentials }           from './auth/envAdminCredentials';
import { HmacAdminSession }              from './auth/hmacAdminSession';

// ── Infrastructure singletons ─────────────────────────────────────────────
export const mentorRepository        = new PrismaMentorRepository(prisma);
export const bookingRepository       = new PrismaBookingRepository(prisma);
export const idempotencyStore        = new PrismaIdempotencyStore(prisma);
export const unitOfWork              = new PrismaUnitOfWork(prisma);
export const adminDashboardRepository = new PrismaAdminDashboardRepository(prisma);
export const timezoneService         = new LuxonTimezoneService();

// Tests use the in-process mock. All other environments use Resend.
export const emailService =
  process.env.NODE_ENV === 'test'
    ? new MockEmailService()
    : createEmailService();

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

export const adminCredentialVerifier = EnvAdminCredentials.fromEnv();
export const adminSessionService = HmacAdminSession.fromEnv();
export const authenticateAdminUseCase = new AuthenticateAdminUseCase(
  adminCredentialVerifier,
  adminSessionService,
);

// Re-export prisma for graceful shutdown in index.ts
export { prisma };
