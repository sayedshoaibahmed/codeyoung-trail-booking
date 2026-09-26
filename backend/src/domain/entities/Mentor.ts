/**
 * Domain entity — Mentor
 * Pure TypeScript. No Prisma types, no external library dependencies.
 */

export enum MentorShiftType {
  SHIFT_1 = 'SHIFT_1', // 09:00–21:00 IST
  SHIFT_2 = 'SHIFT_2', // 21:00–09:00 IST (overnight)
}

export interface MentorShift {
  id: string;
  mentorId: string;
  /** Day of week: 0=Sunday … 6=Saturday. null means applies to every day. */
  dayOfWeek: number | null;
  /** Local time string HH:mm in the mentor's IANA timezone, e.g. '09:00' or '21:00' */
  localStartTime: string;
  /** Local time string HH:mm in the mentor's IANA timezone, e.g. '21:00' or '09:00' */
  localEndTime: string;
  /**
   * True when localEndTime is on the following calendar day.
   * Example: localStartTime='21:00', localEndTime='09:00' → crossesMidnight=true (Shift 2)
   */
  crossesMidnight: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
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
