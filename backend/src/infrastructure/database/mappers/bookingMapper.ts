/**
 * Mapper — converts Prisma Booking model to the domain Booking entity.
 */
import type { Booking as PrismaBooking } from '@prisma/client';
import { BookingStatus as PrismaBookingStatus } from '@prisma/client';
import type { Booking } from '../../../domain';
import { BookingStatus } from '../../../domain';

function toBookingStatus(prismaStatus: PrismaBookingStatus): BookingStatus {
  switch (prismaStatus) {
    case PrismaBookingStatus.CONFIRMED:
      return BookingStatus.CONFIRMED;
    case PrismaBookingStatus.CANCELLED:
      return BookingStatus.CANCELLED;
    default: {
      const _exhaustive: never = prismaStatus;
      throw new Error(`Unknown booking status: ${String(_exhaustive)}`);
    }
  }
}

export function toDomainBooking(prismaBooking: PrismaBooking): Booking {
  return {
    id: prismaBooking.id,
    mentorId: prismaBooking.mentorId,
    parentName: prismaBooking.parentName,
    parentEmail: prismaBooking.parentEmail,
    childName: prismaBooking.childName,
    parentTimezone: prismaBooking.parentTimezone,
    startTimeUtc: prismaBooking.startTimeUtc,
    endTimeUtc: prismaBooking.endTimeUtc,
    mentorTimezone: prismaBooking.mentorTimezone,
    mentorLocalDate: prismaBooking.mentorLocalDate,
    meetingLink: prismaBooking.meetingLink,
    status: toBookingStatus(prismaBooking.status),
    cancellationTokenHash: prismaBooking.cancellationTokenHash,
    accessTokenHash: prismaBooking.accessTokenHash,
    cancelledAt: prismaBooking.cancelledAt,
    idempotencyKey: prismaBooking.idempotencyKey,
    createdAt: prismaBooking.createdAt,
    updatedAt: prismaBooking.updatedAt,
  };
}
