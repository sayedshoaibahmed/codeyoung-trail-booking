/**
 * Prisma seed — runs idempotently.
 *
 * Creates exactly 10 mentors (5 on Shift 1, 5 on Shift 2) and their
 * corresponding MentorShift records if they do not already exist.
 * Matched by email (mentor) and mentorId+shift (MentorShift).
 * Safe to re-run at any time.
 *
 * Execute via:  npx tsx prisma/seed.ts
 *           or: npm run db:seed
 */
import { PrismaClient, ShiftType } from '@prisma/client';

const prisma = new PrismaClient();

const MENTOR_TIMEZONE = 'Asia/Kolkata';

interface MentorSeed {
  name: string;
  email: string;
  shift: ShiftType;
  /** Local start time HH:mm in IST */
  localStartTime: string;
  /** Local end time HH:mm in IST */
  localEndTime: string;
  /** True when the shift crosses midnight (Shift 2: 21:00–09:00) */
  crossesMidnight: boolean;
}

const mentors: MentorSeed[] = [
  // ── Shift 1: 09:00–21:00 IST (same calendar day) ─────────────────────
  { name: 'Aisha Sharma', email: 'aisha.sharma@codeyoung.com', shift: ShiftType.SHIFT_1, localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false },
  { name: 'Rohan Mehta',  email: 'rohan.mehta@codeyoung.com',  shift: ShiftType.SHIFT_1, localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false },
  { name: 'Priya Nair',   email: 'priya.nair@codeyoung.com',   shift: ShiftType.SHIFT_1, localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false },
  { name: 'Kabir Singh',  email: 'kabir.singh@codeyoung.com',  shift: ShiftType.SHIFT_1, localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false },
  { name: 'Divya Reddy',  email: 'divya.reddy@codeyoung.com',  shift: ShiftType.SHIFT_1, localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false },

  // ── Shift 2: 21:00–09:00 IST (overnight — crosses midnight) ──────────
  { name: 'Arjun Patel',  email: 'arjun.patel@codeyoung.com',  shift: ShiftType.SHIFT_2, localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true },
  { name: 'Sneha Gupta',  email: 'sneha.gupta@codeyoung.com',  shift: ShiftType.SHIFT_2, localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true },
  { name: 'Vikram Bose',  email: 'vikram.bose@codeyoung.com',  shift: ShiftType.SHIFT_2, localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true },
  { name: 'Meera Iyer',   email: 'meera.iyer@codeyoung.com',   shift: ShiftType.SHIFT_2, localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true },
  { name: 'Rahul Verma',  email: 'rahul.verma@codeyoung.com',  shift: ShiftType.SHIFT_2, localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding mentors and shift schedules...\n');

  for (const m of mentors) {
    // 1. Upsert the mentor (no-op on conflict)
    const mentor = await prisma.mentor.upsert({
      where: { email: m.email },
      update: {},
      create: {
        name: m.name,
        email: m.email,
        timezone: MENTOR_TIMEZONE,
        shift: m.shift,
        active: true,
      },
    });

    // 2. Upsert the MentorShift record.
    //    Idempotency key: unique on (mentorId, localStartTime, localEndTime).
    //    dayOfWeek=null means the schedule applies every day of the week.
    const existing = await prisma.mentorShift.findFirst({
      where: {
        mentorId: mentor.id,
        localStartTime: m.localStartTime,
        localEndTime: m.localEndTime,
      },
    });

    if (existing) {
      console.log(`  ↺ ${mentor.name} (${mentor.shift}) shift already exists — skipping`);
    } else {
      await prisma.mentorShift.create({
        data: {
          mentorId: mentor.id,
          dayOfWeek: null,      // applies every day
          localStartTime: m.localStartTime,
          localEndTime: m.localEndTime,
          crossesMidnight: m.crossesMidnight,
          active: true,
        },
      });
      console.log(
        `  ✓ ${mentor.name} (${mentor.shift}) shift ${m.localStartTime}–${m.localEndTime}` +
        `${m.crossesMidnight ? ' [overnight ✓]' : ''}`,
      );
    }
  }

  const mentorCount = await prisma.mentor.count();
  const shiftCount  = await prisma.mentorShift.count();
  console.log(`\n✅ Seed complete. Mentors: ${mentorCount}, MentorShifts: ${shiftCount}`);
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
