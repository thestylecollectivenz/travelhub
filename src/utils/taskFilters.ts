/** Sidebar filter value for manual tasks with no category. */
export const TASK_FILTER_UNCATEGORISED = '__uncategorised__';

export type TaskCompletionFilter = 'incomplete' | 'all' | 'completed';

export function taskCompletionFilterLabel(key: TaskCompletionFilter): string {
  if (key === 'incomplete') return 'Open only';
  if (key === 'completed') return 'Completed';
  return 'All tasks';
}

export function matchesTaskCompletionFilter(isComplete: boolean, filter: TaskCompletionFilter): boolean {
  if (filter === 'incomplete') return !isComplete;
  if (filter === 'completed') return isComplete;
  return true;
}

export function reminderTaskCategory(reminder: { taskCategory?: string; entryId?: string }, entryCategory?: string): string {
  const explicit = (reminder.taskCategory || '').trim();
  if (explicit) return explicit;
  const fromEntry = (entryCategory || '').trim();
  if (fromEntry) return fromEntry;
  return '';
}
