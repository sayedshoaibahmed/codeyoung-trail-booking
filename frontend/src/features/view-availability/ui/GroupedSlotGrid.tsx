import { SlotCard } from '../../../entities/slot/ui/SlotCard';
import { DAY_PARTS, groupSlotsByDayPart } from '../../../entities/slot/lib/groupSlots';
import type { AvailableSlot } from '../../../entities/slot/model/types';

interface GroupedSlotGridProps {
  slots: AvailableSlot[];
  timezone: string;
  selectedSlotIso: string | null;
  onSelect: (startUtc: string) => void;
}

export function GroupedSlotGrid({
  slots,
  timezone,
  selectedSlotIso,
  onSelect,
}: GroupedSlotGridProps) {
  const groups = groupSlotsByDayPart(slots);

  return (
    <div className="space-y-6">
      {DAY_PARTS.map(({ id, label }) => {
        const partSlots = groups[id];
        if (partSlots.length === 0) return null;
        return (
          <section key={id} aria-label={label}>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{label}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 min-w-0">
              {partSlots.map((slot) => (
                <SlotCard
                  key={slot.startUtc}
                  slot={slot}
                  timezone={timezone}
                  isSelected={selectedSlotIso === slot.startUtc}
                  onClick={() => onSelect(slot.startUtc)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
