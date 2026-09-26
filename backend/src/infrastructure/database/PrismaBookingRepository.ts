/**
 * Infrastructure — PrismaBookingRepository
 *
 * Concrete implementation of the BookingRepository port.
 * Injected at the composition root; never imported by application or domain layers.
 */
import type { PrismaClient } from '@prisma/client';
import { BookingStatus as PrismaBookingStatus } from '@prisma/client';
import type {
  BookingRepository,
  CreateBookingData,
  ListBookingsFilter,
} from '../../application/ports';
import type { Booking } from '../../domain';
import { BookingStatus } from '../../domain';
import { toDomainBooking } from './mappers/bookingMapper';

function toPrismaStatus(s: BookingStatus): PrismaBookingStatus {
  return s === BookingStatus.CONFIRMED
    ? PrismaBookingStatus.CONFIRMED
    : PrismaBookingStatus.CANCELLED;
}

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateBookingData, tx: unknown): Promise<Booking> {
    const client = tx as PrismaClient;
    const record = await client.booking.create({
      data: {
        id: data.id,
        mentorId: data.mentorId,
        parentName: data.parentName,
        parentEmail: data.parentEmail,
        childName: data.childName,
        parentTimezone: data.parentTimezone,
        startTimeUtc: data.startTimeUtc,
        endTimeUtc: data.endTimeUtc,
        mentorTimezone: data.mentorTimezone,
        mentorLocalDate: data.mentorLocalDate,
        meetingLink: data.meetingLink,
        cancellationTokenHash: data.cancellationTokenHash,
        idempotencyKey: data.idempotencyKey,
        status: PrismaBookingStatus.CONFIRMED,
      },
    });
    return toDomainBooking(record);
  }

  async findById(id: string, tx?: unknown): Promise<Booking | null> {
    const client = (tx as PrismaClient | undefined) ?? this.db;
    const record = await client.booking.findUnique({ where: { id } });
    return record ? toDomainBooking(record) : null;
  }

  async findByIdForUpdate(id: string, tx: unknown): Promise<Booking | null> {
    // Prisma does not expose SELECT FOR UPDATE natively.
    // We use $queryRaw to lock the row, then re-read via typed query.
    const client = tx as PrismaClient;
    await client.$queryRaw`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`;
    const record = await client.booking.findUnique({ where: { id } });
    return record ? toDomainBooking(record) : null;
  }

  async cancel(id: string, cancelledAt: Date, tx: unknown): Promise<Booking> {
    const client = tx as PrismaClient;
    const record = await client.booking.update({
      where: { id },
      data: { status: PrismaBookingStatus.CANCELLED, cancelledAt },
    });
    return toDomainBooking(record);
  }

  async findAll(filter?: ListBookingsFilter): Promise<Booking[]> {
    const records = await this.db.booking.findMany({
      where: {
        ...(filter?.date && { mentorLocalDate: filter.date }),
        ...(filter?.mentorId && { mentorId: filter.mentorId }),
        ...(filter?.status && { status: toPrismaStatus(filter.status) }),
      },
      orderBy: { startTimeUtc: 'asc' },
    });
    return records.map(toDomainBooking);
  }

  async countConfirmedByMentorAndDate(
    mentorId: string,
    mentorLocalDate: string,
    tx: unknown,
  ): Promise<number> {
    const client = tx as PrismaClient;
    return client.booking.count({
      where: {
        mentorId,
        mentorLocalDate,
        status: PrismaBookingStatus.CONFIRMED,
      },
    });
  }
}
