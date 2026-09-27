/**
 * Infrastructure — PrismaBookingRepository
 *
 * Implements BookingRepository. The constructor receives whatever Prisma client
 * is appropriate for the call site:
 *   - The global shared client when used outside a transaction.
 *   - The transaction-scoped ITX client when constructed by PrismaUnitOfWork.
 *
 * No methods accept a `tx` parameter — the client is set at construction time.
 */
import type { PrismaClient } from '@prisma/client';
import { BookingStatus as PrismaBookingStatus } from '@prisma/client';
import type { BookingRepository, CreateBookingData, ListBookingsFilter } from '../../application/ports';
import type { Booking } from '../../domain';
import { BookingStatus, ConfirmedSlotConflictError } from '../../domain';
import { toDomainBooking } from './mappers/bookingMapper';

/**
 * P2002 on the CONFIRMED (mentorId, startTimeUtc) partial unique index.
 * Idempotency and access-token collisions are not slot conflicts.
 */
export function isConfirmedSlotUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if ((err as { code?: string }).code !== 'P2002') return false;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const text = Array.isArray(target) ? target.join(' ') : String(target ?? '');
  const message = err instanceof Error ? err.message : '';
  const haystack = `${text} ${message}`;
  if (haystack.includes('idempotencyKey') || haystack.includes('accessTokenHash')) return false;
  return haystack.includes('bookings_mentor_slot_confirmed_unique')
    || (haystack.includes('mentorId') && haystack.includes('startTimeUtc'));
}

function toPrismaStatus(s: BookingStatus): PrismaBookingStatus {
  return s === BookingStatus.CONFIRMED
    ? PrismaBookingStatus.CONFIRMED
    : PrismaBookingStatus.CANCELLED;
}

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateBookingData): Promise<Booking> {
    // A unique violation aborts the PostgreSQL transaction unless we roll
    // back to a savepoint. That lets BookClass try the next eligible mentor.
    await this.db.$executeRawUnsafe('SAVEPOINT booking_mentor_insert');
    try {
      const record = await this.insertBooking(data);
      await this.db.$executeRawUnsafe('RELEASE SAVEPOINT booking_mentor_insert');
      return record;
    } catch (err) {
      await this.db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT booking_mentor_insert');
      if (isConfirmedSlotUniqueViolation(err)) throw new ConfirmedSlotConflictError();
      throw err;
    }
  }

  private async insertBooking(data: CreateBookingData): Promise<Booking> {
    const record = await this.db.booking.create({
      data: {
        id:                   data.id,
        mentorId:             data.mentorId,
        parentName:           data.parentName,
        parentEmail:          data.parentEmail,
        childName:            data.childName,
        parentTimezone:       data.parentTimezone,
        startTimeUtc:         data.startTimeUtc,
        endTimeUtc:           data.endTimeUtc,
        mentorTimezone:       data.mentorTimezone,
        mentorLocalDate:      data.mentorLocalDate,
        meetingLink:          data.meetingLink,
        cancellationTokenHash: data.cancellationTokenHash,
        accessTokenHash:      data.accessTokenHash,
        idempotencyKey:       data.idempotencyKey,
        status:               PrismaBookingStatus.CONFIRMED,
      },
    });
    return toDomainBooking(record);
  }

  async findById(id: string): Promise<Booking | null> {
    const record = await this.db.booking.findUnique({ where: { id } });
    return record ? toDomainBooking(record) : null;
  }

  async findByAccessTokenHash(accessTokenHash: string): Promise<Booking | null> {
    const record = await this.db.booking.findUnique({ where: { accessTokenHash } });
    return record ? toDomainBooking(record) : null;
  }

  async findByIdForUpdate(id: string): Promise<Booking | null> {
    // SELECT FOR UPDATE — must be called on a transaction-scoped repo.
    await this.db.$queryRaw`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`;
    const record = await this.db.booking.findUnique({ where: { id } });
    return record ? toDomainBooking(record) : null;
  }

  async cancel(id: string, cancelledAt: Date): Promise<Booking> {
    const record = await this.db.booking.update({
      where: { id },
      data: { status: PrismaBookingStatus.CANCELLED, cancelledAt },
    });
    return toDomainBooking(record);
  }

  async findAll(filter?: ListBookingsFilter): Promise<Booking[]> {
    const records = await this.db.booking.findMany({
      where: {
        ...(filter?.date     && { mentorLocalDate: filter.date }),
        ...(filter?.mentorId && { mentorId: filter.mentorId }),
        ...(filter?.status   && { status: toPrismaStatus(filter.status) }),
      },
      orderBy: { startTimeUtc: 'asc' },
    });
    return records.map(toDomainBooking);
  }
}
