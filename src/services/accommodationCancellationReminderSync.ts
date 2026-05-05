import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import { ReminderService } from './ReminderService';

const REMINDER_TYPE = 'CancellationDeadline';

function buildReminderTitle(entry: ItineraryEntry, deadlineIso: string): string {
  const title = (entry.title || '').trim() || 'Accommodation';
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) {
    return `Last chance to cancel ${title} — deadline ${deadlineIso}`;
  }
  const dateStr = d.toLocaleDateString('en-NZ');
  const timeStr = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `Last chance to cancel ${title} — deadline ${dateStr} at ${timeStr}`;
}

function buildTaskNote(entry: ItineraryEntry): string {
  const title = (entry.title || '').trim() || 'Accommodation';
  const addr = [entry.streetAddress, entry.location].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  let note = `Cancellation deadline for ${title}`;
  if (addr) {
    note += ` at ${addr}`;
  }
  note += '.';
  if (entry.dateStart?.trim()) {
    note += ` Check-in: ${entry.dateStart.trim()}.`;
  }
  const policySnippet = (entry.cancellationPolicy || '').trim().slice(0, 100);
  if (policySnippet) {
    note += ` Policy: ${policySnippet}.`;
  }
  return note;
}

/**
 * Creates, updates, or removes the auto-generated cancellation-deadline reminder for an accommodation entry.
 */
export async function syncAccommodationCancellationDeadlineReminder(
  ctx: WebPartContext,
  entry: ItineraryEntry
): Promise<void> {
  if (entry.category !== 'Accommodation') {
    return;
  }
  const tripId = (entry.tripId || '').trim();
  if (!tripId) {
    return;
  }
  if (entry.id.startsWith('new-') || entry.id.startsWith('temp-')) {
    return;
  }

  const svc = new ReminderService(ctx);
  let rows: Awaited<ReturnType<ReminderService['getForTrip']>>;
  try {
    rows = await svc.getForTrip(tripId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('syncAccommodationCancellationDeadlineReminder: getForTrip failed', err);
    return;
  }

  const existing = rows.find(
    (r) => (r.entryId || '').trim() === entry.id && (r.reminderType || '').trim() === REMINDER_TYPE
  );

  const deadline = (entry.cancellationDeadline || '').trim();
  if (!deadline) {
    if (existing) {
      try {
        await svc.delete(existing.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('syncAccommodationCancellationDeadlineReminder: failed to remove stale reminder', err);
      }
    }
    return;
  }

  const reminderTitle = buildReminderTitle(entry, deadline);
  const taskNote = buildTaskNote(entry);

  try {
    if (existing) {
      await svc.update(existing.id, {
        title: reminderTitle,
        taskNote,
        dueDate: deadline,
        dayId: entry.dayId,
        entryId: entry.id,
        reminderType: REMINDER_TYPE,
        reminderText: '',
        isComplete: false
      });
    } else {
      await svc.create({
        title: reminderTitle,
        tripId,
        dayId: entry.dayId,
        entryId: entry.id,
        reminderType: REMINDER_TYPE,
        reminderText: '',
        taskNote,
        dueDate: deadline,
        isComplete: false
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('syncAccommodationCancellationDeadlineReminder: create/update failed', err);
  }
}
