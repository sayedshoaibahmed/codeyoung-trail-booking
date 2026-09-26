/**
 * Domain entity — Mentor
 * Pure TypeScript. No Prisma types, no external library dependencies.
 */

export enum MentorShiftType {
  SHIFT_1 = 'SHIFT_1', // 09:00–21:00 IST
  SHIFT_2 = 'SHIFT_2', // 21:00–09:00 IST (overnight)
}

export interface MentorShift {
  /** Day of week: 0 = Sunday, 6 = Saturday. Null means applies to all days. */
  dayOfWeek: number | null;
  /** Local time string HH:mm in mentor's timezone */
  localStartTime: string;
  /** Local time string HH:mm in mentor's timezone */
  localEndTime: string;
  /** True when end time is on the following calendar day (overnight shift) */
  crossesMidnight: boolean;
  active: boolean;
}

export interface Mentor {
  id: string;
  name: string;
  email: string;
  /** IANA timezone identifier, e.g. 'Asia/Kolkata' */
  timezone: string;
  shift: MentorShiftType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
