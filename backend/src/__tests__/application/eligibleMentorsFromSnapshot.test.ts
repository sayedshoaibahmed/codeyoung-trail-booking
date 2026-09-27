import { describe, it, expect } from 'vitest';
import {
  eligibleMentorsFromSnapshot,
  indexAvailabilitySnapshot,
} from '../../application/services/eligibleMentorsFromSnapshot';
import { MentorShiftType } from '../../domain/entities/Mentor';
import type { Mentor } from '../../domain';

function mentor(id: string, shift: MentorShiftType, active = true): Mentor {
  return {
    id,
    name: id,
    email: `${id}@test.com`,
    timezone: 'Asia/Kolkata',
    shift,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const slot = {
  shift: MentorShiftType.SHIFT_1,
  slotStartUtc: new Date('2024-11-04T04:30:00.000Z'),
  slotEndUtc: new Date('2024-11-04T05:30:00.000Z'),
  mentorLocalDate: '2024-11-04',
  dailyCap: 2,
};

describe('eligibleMentorsFromSnapshot', () => {
  it('keeps on-shift mentors and sorts by dayCount then id', () => {
    const indexed = indexAvailabilitySnapshot({
      mentors: [
        mentor('b', MentorShiftType.SHIFT_1),
        mentor('a', MentorShiftType.SHIFT_1),
        mentor('night', MentorShiftType.SHIFT_2),
      ],
      confirmedBookings: [{
        mentorId: 'b',
        startTimeUtc: new Date('2024-11-04T03:30:00.000Z'),
        endTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
        mentorLocalDate: '2024-11-04',
      }],
    });

    const eligible = eligibleMentorsFromSnapshot(indexed, slot);
    expect(eligible.map((e) => e.mentor.id)).toEqual(['a', 'b']);
    expect(eligible[0].dayCount).toBe(0);
    expect(eligible[1].dayCount).toBe(1);
  });

  it('excludes mentors with a CONFIRMED overlap', () => {
    const indexed = indexAvailabilitySnapshot({
      mentors: [mentor('m1', MentorShiftType.SHIFT_1)],
      confirmedBookings: [{
        mentorId: 'm1',
        startTimeUtc: new Date('2024-11-04T04:00:00.000Z'),
        endTimeUtc: new Date('2024-11-04T05:00:00.000Z'),
        mentorLocalDate: '2024-11-04',
      }],
    });
    expect(eligibleMentorsFromSnapshot(indexed, slot)).toEqual([]);
  });

  it('excludes mentors at the daily cap for mentorLocalDate', () => {
    const indexed = indexAvailabilitySnapshot({
      mentors: [mentor('m1', MentorShiftType.SHIFT_1)],
      confirmedBookings: [
        {
          mentorId: 'm1',
          startTimeUtc: new Date('2024-11-04T03:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
          mentorLocalDate: '2024-11-04',
        },
        {
          mentorId: 'm1',
          startTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T06:30:00.000Z'),
          mentorLocalDate: '2024-11-04',
        },
      ],
    });
    expect(eligibleMentorsFromSnapshot(indexed, slot)).toEqual([]);
  });

  it('does not count bookings from a different mentorLocalDate toward the cap', () => {
    const indexed = indexAvailabilitySnapshot({
      mentors: [mentor('m1', MentorShiftType.SHIFT_1)],
      confirmedBookings: [
        {
          mentorId: 'm1',
          startTimeUtc: new Date('2024-11-03T03:30:00.000Z'),
          endTimeUtc: new Date('2024-11-03T04:30:00.000Z'),
          mentorLocalDate: '2024-11-03',
        },
        {
          mentorId: 'm1',
          startTimeUtc: new Date('2024-11-03T04:30:00.000Z'),
          endTimeUtc: new Date('2024-11-03T05:30:00.000Z'),
          mentorLocalDate: '2024-11-03',
        },
      ],
    });
    expect(eligibleMentorsFromSnapshot(indexed, slot)).toHaveLength(1);
  });

  it('ignores inactive mentors', () => {
    const indexed = indexAvailabilitySnapshot({
      mentors: [mentor('m1', MentorShiftType.SHIFT_1, false)],
      confirmedBookings: [],
    });
    expect(eligibleMentorsFromSnapshot(indexed, slot)).toEqual([]);
  });
});
