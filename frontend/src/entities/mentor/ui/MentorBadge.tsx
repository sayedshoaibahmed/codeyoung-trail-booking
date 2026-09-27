/**
 * entities/mentor — ui/MentorBadge.tsx
 *
 * Minimal display component for a mentor.
 * Shows name and optionally the mentor's IANA timezone.
 *
 * FSD rule: no imports from features, widgets, or pages.
 */
import type { Mentor } from '../model/types';

interface MentorBadgeProps {
  mentor: Mentor;
  /** If true, show the mentor's timezone below the name */
  showTimezone?: boolean;
}

export function MentorBadge({ mentor, showTimezone = false }: MentorBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Avatar placeholder using mentor initials */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800 text-sm font-bold shadow-sm">
        {mentor.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{mentor.name}</p>
        {showTimezone && (
          <p className="text-xs font-medium text-slate-500">{mentor.timezone}</p>
        )}
      </div>
    </div>
  );
}
