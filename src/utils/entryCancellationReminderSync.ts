import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import { ReminderService } from '../services/ReminderService';
import { formatWallDateTimeEnNz, serializeWallDateTime } from './wallDateTime';

const REMINDER_TYPE = 'CancellationDeadline';

function buildReminderTitle(entry: ItineraryEntry, deadlineIso: string): string {
  const title = (entry.title || '').trim() || entry.category || 'Item';
  const formatted = formatWallDateTimeEnNz(deadlineIso);
  if (!formatted) {
    return `Last chance to cancel ${title} — deadline ${deadlineIso}`;
  }
  return `Last chance to cancel ${title} — deadline ${formatted}`;
}

function buildReminderNote(entry: ItineraryEntry): string {
  const title = (entry.title || '').trim() || entry.category || 'Item';
  const addr = [entry.streetAddress, entry.location].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  let note = `Cancellation deadline for ${title}`;
  if (addr) note += ` at ${addr}`;
  note += '.';
  const policySnippet = (entry.cancellationPolicy || '').trim().slice(0, 100);
  if (policySnippet) note += ` Policy: ${policySnippet}.`;
  return note;
}

/** Auto reminder (not a manual task) when an itinerary entry has a cancellation deadline. */
export async function syncEntryCancellationDeadlineReminder(
  ctx: WebPartContext,
  entry: ItineraryEntry
): Promise<void> {
  const tripId = (entry.tripId || '').trim();
  if (!tripId || entry.id.startsWith('new-') || entry.id.startsWith('temp-')) {
    return;
  }

  const svc = new ReminderService(ctx);
  let rows: Awaited<ReturnType<ReminderService['getForTrip']>>;
  try {
    rows = await svc.getForTrip(tripId);
  } catch (err) {
    console.error('syncEntryCancellationDeadlineReminder: getForTrip failed', err);
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
        console.error('syncEntryCancellationDeadlineReminder: delete failed', err);
      }
    }
    return;
  }

  const payload = {
    title: buildReminderTitle(entry, deadline),
    taskNote: buildReminderNote(entry),
    dueDate: serializeWallDateTime(deadline) || deadline,
    dayId: entry.dayId,
    entryId: entry.id,
    reminderType: REMINDER_TYPE,
    reminderText: buildReminderTitle(entry, deadline),
    isComplete: false
  };

  try {
    if (existing) {
      await svc.update(existing.id, payload);
    } else {
      await svc.create({
        ...payload,
        tripId
      });
    }
  } catch (err) {
    console.error('syncEntryCancellationDeadlineReminder: create/update failed', err);
  }
}
