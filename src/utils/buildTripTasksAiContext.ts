import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { TripReminder } from '../services/ReminderService';
import { paymentDueTaskTitle } from './paymentDueLabels';

function twoDigit(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${twoDigit(d.getMonth() + 1)}-${twoDigit(d.getDate())}`;
}

function ymdFromIso(iso?: string): string {
  return (iso || '').slice(0, 10);
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${twoDigit(d.getMonth() + 1)}-${twoDigit(d.getDate())}`;
}

function isManualTodo(reminder: TripReminder): boolean {
  const rt = (reminder.reminderType || '').trim();
  return rt === 'Manual' || rt === 'ManualEntryTask' || rt === 'Custom';
}

function reminderLine(reminder: TripReminder, tripDays: TripDay[], entries: ItineraryEntry[]): string {
  const parts: string[] = [];
  const text = (reminder.reminderText || reminder.title || 'Task').trim();
  parts.push(text);
  const due = ymdFromIso(reminder.dueDate);
  if (due) parts.push(`due ${due}`);
  if (reminder.assignedTo?.trim()) parts.push(`assigned to ${reminder.assignedTo.trim()}`);
  if (reminder.taskNote?.trim()) parts.push(`note: ${reminder.taskNote.trim()}`);
  const entryId = (reminder.entryId || '').trim();
  if (entryId) {
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      parts.push(`linked: ${entry.category} · ${(entry.title || 'Untitled').trim()}`);
      const day = tripDays.find((d) => d.id === entry.dayId);
      if (day) parts.push(`trip day ${day.dayNumber}`);
    }
  }
  return parts.join(' · ');
}

function entryTaskLine(
  prefix: string,
  entry: ItineraryEntry,
  tripDays: TripDay[],
  extra?: string
): string {
  const day = tripDays.find((d) => d.id === entry.dayId);
  const parts = [
    prefix,
    `${entry.category} · ${(entry.title || 'Untitled').trim()}`,
    entry.decisionStatus === 'Idea' ? 'idea only' : entry.decisionStatus === 'Confirmed' ? 'confirmed' : 'planned'
  ];
  if (entry.bookingRequired) {
    parts.push(entry.bookingStatus === 'Booked' ? 'booked' : 'needs booking');
  }
  if (entry.paymentStatus && entry.paymentStatus !== 'Not paid') {
    parts.push(`payment: ${entry.paymentStatus}`);
  } else if (entry.paymentStatus === 'Not paid' && entry.amount > 0) {
    parts.push('unpaid');
  }
  if (day) parts.push(`day ${day.dayNumber}${day.calendarDate ? ` (${day.calendarDate.slice(0, 10)})` : ''}`);
  if (extra) parts.push(extra);
  return parts.join(' · ');
}

export function buildTripTasksAiContext(options: {
  trip: Trip;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  reminders: TripReminder[];
  todayYmd?: string;
}): string {
  const { trip, tripDays, entries, reminders } = options;
  const today = options.todayYmd ?? localTodayYmd();
  const tomorrow = addDaysYmd(today, 1);

  const incomplete = reminders.filter((r) => !r.isComplete);
  const manualTodos = incomplete.filter(isManualTodo);
  const cancellations = incomplete.filter((r) => (r.reminderType || '').trim() === 'CancellationDeadline');

  const overdue: TripReminder[] = [];
  const dueToday: TripReminder[] = [];
  const dueTomorrow: TripReminder[] = [];
  const noDueDate: TripReminder[] = [];

  for (const m of manualTodos) {
    const due = ymdFromIso(m.dueDate);
    if (!due) {
      noDueDate.push(m);
      continue;
    }
    if (due < today) overdue.push(m);
    else if (due === today) dueToday.push(m);
    else if (due === tomorrow) dueTomorrow.push(m);
  }

  const bookingTasks = entries.filter((e) => e.bookingRequired && e.bookingStatus === 'Not booked' && !e.parentEntryId);
  const paymentTasks = entries.filter(
    (e) =>
      !e.parentEntryId &&
      ((e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid')
  );

  const lines: string[] = [];
  lines.push(`Trip: ${trip.title || 'Untitled'}`);
  lines.push(`Today's date (local): ${today}`);
  lines.push('');
  lines.push(
    'You are helping with the trip to-do list. Answer questions like what is overdue, due today, due tomorrow, or what still needs booking or payment. Use the lists below — do not invent tasks.'
  );

  const pushSection = (title: string, items: string[]): void => {
    lines.push('');
    lines.push(`${title}:`);
    if (!items.length) lines.push('  (none)');
    else items.forEach((item) => lines.push(`  - ${item}`));
  };

  pushSection('Overdue manual tasks / reminders', overdue.map((m) => reminderLine(m, tripDays, entries)));
  pushSection('Due today', dueToday.map((m) => reminderLine(m, tripDays, entries)));
  pushSection('Due tomorrow', dueTomorrow.map((m) => reminderLine(m, tripDays, entries)));
  pushSection(
    'Incomplete manual tasks with no due date',
    noDueDate.map((m) => reminderLine(m, tripDays, entries))
  );
  pushSection(
    'Cancellation deadlines (incomplete)',
    cancellations.map((m) => reminderLine(m, tripDays, entries))
  );
  pushSection(
    'Bookings still required (itinerary)',
    bookingTasks.map((e) => {
      const due = e.bookingDueDate ? `book by ${e.bookingDueDate.slice(0, 10)}` : undefined;
      return entryTaskLine('Book', e, tripDays, due);
    })
  );
  pushSection(
    'Payments outstanding (itinerary)',
    paymentTasks.map((e) => {
      const due = e.paymentDueDate ? `due ${e.paymentDueDate.slice(0, 10)}` : undefined;
      return entryTaskLine(paymentDueTaskTitle(e), e, tripDays, due);
    })
  );

  lines.push('');
  lines.push(
    'When the traveller asks "what do I need to do today/tomorrow" or "what is overdue", prioritise overdue first, then due today, then due tomorrow, then bookings/payments with imminent due dates.'
  );

  return lines.join('\n');
}
