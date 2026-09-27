import type { AvailableSlot } from '../model/types';
import { isSlotSelectable, slotStatusLabel } from '../lib/groupSlots';

interface SlotCardProps {
  slot: AvailableSlot;
  isSelected: boolean;
  onClick: () => void;
  timezone: string;
}

function formatLocalTime(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

export function SlotCard({ slot, isSelected, onClick, timezone }: SlotCardProps) {
  const selectable = isSlotSelectable(slot);
  const startLabel = formatLocalTime(slot.startUtc, timezone);
  const endLabel = formatLocalTime(slot.endUtc, timezone);
  const statusLabel = slotStatusLabel(slot);

  const stateClass = isSelected
    ? 'bg-amber-50 text-amber-900 border-amber-500 shadow-sm'
    : slot.status === 'available'
      ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100 hover:border-green-400'
      : 'bg-white text-slate-500 border-slate-200 cursor-not-allowed';

  return (
    <button
      type="button"
      onClick={selectable ? onClick : undefined}
      disabled={!selectable}
      aria-disabled={!selectable}
      aria-pressed={isSelected}
      title={statusLabel ?? undefined}
      className={`
        w-full min-w-0 min-h-12 px-2 sm:px-3 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all
        ${stateClass}
      `}
    >
      <span className="block leading-snug break-words">
        {startLabel} – {endLabel}
      </span>
      {statusLabel && (
        <span className="mt-0.5 block text-[10px] sm:text-xs font-semibold text-slate-400">
          {statusLabel}
        </span>
      )}
    </button>
  );
}
