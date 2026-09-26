/**
 * Mapper — converts Prisma Mentor model to the domain Mentor entity.
 * Keeps the infrastructure-to-domain boundary explicit.
 */
import type { Mentor as PrismaMentor } from '@prisma/client';
import { ShiftType as PrismaShiftType } from '@prisma/client';
import type { Mentor } from '../../../domain';
import { MentorShiftType } from '../../../domain';

function toShiftType(prismaShift: PrismaShiftType): MentorShiftType {
  switch (prismaShift) {
    case PrismaShiftType.SHIFT_1:
      return MentorShiftType.SHIFT_1;
    case PrismaShiftType.SHIFT_2:
      return MentorShiftType.SHIFT_2;
    default: {
      const _exhaustive: never = prismaShift;
      throw new Error(`Unknown shift type: ${String(_exhaustive)}`);
    }
  }
}

export function toDomainMentor(prismaMentor: PrismaMentor): Mentor {
  return {
    id: prismaMentor.id,
    name: prismaMentor.name,
    email: prismaMentor.email,
    timezone: prismaMentor.timezone,
    shift: toShiftType(prismaMentor.shift),
    active: prismaMentor.active,
    createdAt: prismaMentor.createdAt,
    updatedAt: prismaMentor.updatedAt,
  };
}
