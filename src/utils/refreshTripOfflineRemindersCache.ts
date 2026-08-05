import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripReminder } from '../services/ReminderService';
import { ReminderService } from '../services/ReminderService';
import { loadTripOfflineCache, patchTripOfflineExtrasCache } from './tripOfflineCache';

/**
 * Re-fetch all trip reminders (tasks, day ideas, jotter, saved spots) and write
 * them into the offline snapshot immediately — used after idea/task saves so
 * offline mode sees the latest rows without waiting for the 5‑minute warm.
 */
export async function refreshTripOfflineRemindersCache(
  spContext: WebPartContext,
  tripId: string
): Promise<string | undefined> {
  const id = (tripId || '').trim();
  if (!id) return undefined;
  try {
    const rows = await new ReminderService(spContext).getForTrip(id);
    const savedAt = new Date().toISOString();
    await patchTripOfflineExtrasCache(id, { reminders: rows });
    return savedAt;
  } catch {
    return undefined;
  }
}

/** Merge one reminder into the offline snapshot without a full re-fetch (post-create). */
export async function upsertReminderIntoOfflineCache(
  tripId: string,
  reminder: TripReminder
): Promise<void> {
  const id = (tripId || '').trim();
  if (!id || !reminder?.id) return;
  const cached = await loadTripOfflineCache(id);
  const prev = cached?.reminders || [];
  const next = [...prev.filter((r) => r.id !== reminder.id), reminder];
  await patchTripOfflineExtrasCache(id, { reminders: next });
}

export async function removeReminderFromOfflineCache(tripId: string, reminderId: string): Promise<void> {
  const id = (tripId || '').trim();
  const rid = (reminderId || '').trim();
  if (!id || !rid) return;
  const cached = await loadTripOfflineCache(id);
  if (!cached?.reminders?.length) return;
  await patchTripOfflineExtrasCache(id, {
    reminders: cached.reminders.filter((r) => r.id !== rid)
  });
}
