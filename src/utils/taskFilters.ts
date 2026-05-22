/** Sidebar filter value for manual tasks with no category. */
export const TASK_FILTER_UNCATEGORISED = '__uncategorised__';

export function reminderTaskCategory(reminder: { taskCategory?: string; entryId?: string }, entryCategory?: string): string {
  const explicit = (reminder.taskCategory || '').trim();
  if (explicit) return explicit;
  const fromEntry = (entryCategory || '').trim();
  if (fromEntry) return fromEntry;
  return '';
}
