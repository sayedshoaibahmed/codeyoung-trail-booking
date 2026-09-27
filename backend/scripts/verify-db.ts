import { PrismaClient, ShiftType } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const totalMentors = await p.mentor.count();
  const shift1Count  = await p.mentor.count({ where: { shift: ShiftType.SHIFT_1 } });
  const shift2Count  = await p.mentor.count({ where: { shift: ShiftType.SHIFT_2 } });
  const shift1Shifts = await p.mentorShift.count({ where: { localStartTime: '09:00', localEndTime: '21:00', crossesMidnight: false } });
  const shift2Shifts = await p.mentorShift.count({ where: { localStartTime: '21:00', localEndTime: '09:00', crossesMidnight: true } });

  console.log('=== MENTOR / SHIFT COUNTS ===');
  console.log('Total mentors:', totalMentors);
  console.log('Shift 1 mentors (09:00-21:00):', shift1Count);
  console.log('Shift 2 mentors (21:00-09:00):', shift2Count);
  console.log('Shift 1 MentorShift records:', shift1Shifts);
  console.log('Shift 2 MentorShift records (overnight):', shift2Shifts);

  // Verify relationships
  const mentorsWithShifts = await p.mentor.findMany({ include: { shifts: true } });
  const allHaveShifts = mentorsWithShifts.every(m => m.shifts.length > 0);
  console.log('All mentors have at least one MentorShift:', allHaveShifts);

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
