/**
 * Mapper — converts Prisma MentorShift model to the domain MentorShift entity.
 */
import type { MentorShift as PrismaMentorShift } from '@prisma/client';
import type { MentorShift } from '../../../domain';

export function toDomainMentorShift(p: PrismaMentorShift): MentorShift {
  return {
    id: p.id,
    mentorId: p.mentorId,
    dayOfWeek: p.dayOfWeek,
    localStartTime: p.localStartTime,
    localEndTime: p.localEndTime,
    crossesMidnight: p.crossesMidnight,
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
