import { formatCalendarDateLabel } from '../../../shared/lib/calendarDate';

interface NextAvailableDateNoticeProps {
  selectedDate: string;
  nextAvailableDate: string | null;
  isLoading: boolean;
  error: string | null;
  onViewSlots: (date: string) => void;
}

export function NextAvailableDateNotice({
  selectedDate,
  nextAvailableDate,
  isLoading,
  error,
  onViewSlots,
}: NextAvailableDateNoticeProps) {
  if (isLoading) {
    return (
      <div className="p-5 sm:p-8 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
        <p className="text-slate-500 font-medium">Checking the next available date...</p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 font-medium p-3 bg-red-50 rounded-lg break-words">{error}</p>
    );
  }

  if (!nextAvailableDate) {
    return (
      <div className="p-5 sm:p-8 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
        <p className="text-slate-500 font-medium">No trial slots are currently available in the next 30 days.</p>
      </div>
    );
  }

  return (
    <div
      className="p-5 sm:p-8 border-2 border-amber-100 rounded-xl bg-amber-50"
      aria-label={`All slots are booked for ${formatCalendarDateLabel(selectedDate)}`}
    >
      <p className="text-amber-900 font-semibold break-words">
        All slots are booked for this date.
      </p>
      <p className="text-teal-950 text-lg font-extrabold mt-4">
        Next available date: {formatCalendarDateLabel(nextAvailableDate)}
      </p>
      <button
        type="button"
        onClick={() => onViewSlots(nextAvailableDate)}
        className="mt-5 inline-flex items-center justify-center rounded-xl text-sm font-bold bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm h-11 px-5"
      >
        Select this date
      </button>
    </div>
  );
}
