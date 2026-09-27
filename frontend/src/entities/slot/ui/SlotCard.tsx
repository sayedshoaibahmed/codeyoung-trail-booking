interface SlotCardProps {
  slot: { startUtc: string; endUtc: string };
  isSelected: boolean;
  onClick: () => void;
  timezone: string;
}

export function SlotCard({ slot, isSelected, onClick, timezone }: SlotCardProps) {
  // We want to format the time in the parent's timezone
  const date = new Date(slot.startUtc);
  const timeString = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full min-w-0 min-h-12 px-2 sm:px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all
        ${isSelected 
          ? 'bg-amber-50 text-amber-900 border-amber-500 shadow-sm' 
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-amber-400 hover:text-amber-700'
        }
      `}
    >
      {timeString}
    </button>
  );
}
