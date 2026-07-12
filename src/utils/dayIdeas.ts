import type { TripReminder } from '../services/ReminderService';

export const DAY_IDEA_REMINDER_TYPE = 'DayIdea';

export function isDayIdeaReminder(reminder: Pick<TripReminder, 'reminderType'>): boolean {
  return reminder.reminderType === DAY_IDEA_REMINDER_TYPE;
}

export function formatDayIdeaStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  });
}
