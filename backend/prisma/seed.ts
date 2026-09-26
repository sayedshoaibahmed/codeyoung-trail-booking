/**
 * Prisma seed — runs idempotently.
 *
 * Creates exactly 10 mentors (5 on Shift 1, 5 on Shift 2) if they do not
 * already exist (matched by email). Safe to re-run at any time.
 *
 * Execute via:  npx prisma db seed
 * or:           npx tsx prisma/seed.ts
 */
import { PrismaClient, ShiftType } from '@prisma/client';

const prisma = new PrismaClient();

const MENTOR_TIMEZONE = 'Asia/Kolkata';

const mentors: Array<{
  name: string;
  email: string;
  shift: ShiftType;
}> = [
  // ── Shift 1: 09:00–21:00 IST ──────────────────────────────────────────
  { name: 'Aisha Sharma',    email: 'aisha.sharma@codeyoung.com',    shift: ShiftType.SHIFT_1 },
  { name: 'Rohan Mehta',     email: 'rohan.mehta@codeyoung.com',     shift: ShiftType.SHIFT_1 },
  { name: 'Priya Nair',      email: 'priya.nair@codeyoung.com',      shift: ShiftType.SHIFT_1 },
  { name: 'Kabir Singh',     email: 'kabir.singh@codeyoung.com',     shift: ShiftType.SHIFT_1 },
  { name: 'Divya Reddy',     email: 'divya.reddy@codeyoung.com',     shift: ShiftType.SHIFT_1 },

  // ── Shift 2: 21:00–09:00 IST (overnight) ─────────────────────────────
  { name: 'Arjun Patel',     email: 'arjun.patel@codeyoung.com',     shift: ShiftType.SHIFT_2 },
  { name: 'Sneha Gupta',     email: 'sneha.gupta@codeyoung.com',     shift: ShiftType.SHIFT_2 },
  { name: 'Vikram Bose',     email: 'vikram.bose@codeyoung.com',     shift: ShiftType.SHIFT_2 },
  { name: 'Meera Iyer',      email: 'meera.iyer@codeyoung.com',      shift: ShiftType.SHIFT_2 },
  { name: 'Rahul Verma',     email: 'rahul.verma@codeyoung.com',     shift: ShiftType.SHIFT_2 },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding mentors...');

  for (const mentor of mentors) {
    const result = await prisma.mentor.upsert({
      where: { email: mentor.email },
      update: {}, // no-op on conflict — preserves existing data
      create: {
        name: mentor.name,
        email: mentor.email,
        timezone: MENTOR_TIMEZONE,
        shift: mentor.shift,
        active: true,
      },
    });
    console.log(
      `  ✓ ${result.name} (${result.shift}) — ${result.id.slice(0, 8)}... [${result.createdAt.toISOString() === result.updatedAt.toISOString() ? 'created' : 'already exists'}]`,
    );
  }

  const total = await prisma.mentor.count();
  console.log(`\n✅ Seed complete. Total mentors in DB: ${total}`);
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
