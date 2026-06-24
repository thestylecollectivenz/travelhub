import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripReminder } from '../services/ReminderService';

export type TaskDueFilter = 'all' | 'overdue' | 'today' | 'tomorrow';

function twoDigit(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${twoDigit(d.getMonth() + 1)}-${twoDigit(d.getDate())}`;
}

export function ymdFromIso(iso?: string): string {
  return (iso || '').slice(0, 10);
}

export function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${twoDigit(d.getMonth() + 1)}-${twoDigit(d.getDate())}`;
}

export function dueYmdBucket(dueYmd: string, today: string): 'overdue' | 'today' | 'tomorrow' | 'later' | 'none' {
  if (!dueYmd) return 'none';
  if (dueYmd < today) return 'overdue';
  if (dueYmd === today) return 'today';
  const tomorrow = addDaysYmd(today, 1);
  if (dueYmd === tomorrow) return 'tomorrow';
  return 'later';
}

export function matchesTaskDueFilter(dueYmd: string | undefined, filter: TaskDueFilter, today: string): boolean {
  if (filter === 'all') return true;
  const bucket = dueYmdBucket(ymdFromIso(dueYmd), today);
  if (filter === 'overdue') return bucket === 'overdue';
  if (filter === 'today') return bucket === 'today';
  if (filter === 'tomorrow') return bucket === 'tomorrow';
  return true;
}

export function isManualTodoReminder(reminder: TripReminder): boolean {
  const rt = (reminder.reminderType || '').trim();
  return rt === 'Manual' || rt === 'ManualEntryTask' || rt === 'Custom';
}

export function partitionPaymentTasksByDue(
  entries: ItineraryEntry[],
  today: string
): {
  overdue: ItineraryEntry[];
  dueToday: ItineraryEntry[];
  dueTomorrow: ItineraryEntry[];
  noDueDate: ItineraryEntry[];
  later: ItineraryEntry[];
} {
  const overdue: ItineraryEntry[] = [];
  const dueToday: ItineraryEntry[] = [];
  const dueTomorrow: ItineraryEntry[] = [];
  const noDueDate: ItineraryEntry[] = [];
  const later: ItineraryEntry[] = [];
  for (const e of entries) {
    const due = ymdFromIso(e.paymentDueDate);
    const bucket = dueYmdBucket(due, today);
    if (bucket === 'none') noDueDate.push(e);
    else if (bucket === 'overdue') overdue.push(e);
    else if (bucket === 'today') dueToday.push(e);
    else if (bucket === 'tomorrow') dueTomorrow.push(e);
    else later.push(e);
  }
  return { overdue, dueToday, dueTomorrow, noDueDate, later };
}
