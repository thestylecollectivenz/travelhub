import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { ReminderService, type TripReminder } from '../services/ReminderService';
import { getCurrentUserEmail } from './currentUserEmail';
import { travellerLabelForCurrentUser } from './tripMemberIdentity';
import type { TripMember } from '../models/TripMember';
import type { NearYouToolId } from './nearYouTools';
import {
  loadNearYouSavedPlaces,
  removeNearYouSavedPlace as removeLocalSavedPlace,
  type NearYouSavedPlace
} from './nearYouSavedPlaces';

export const SAVED_SPOT_REMINDER_TYPE = 'SavedSpot';

export interface SavedSpotMeta {
  toolId?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  authorEmail?: string;
}

export interface TripSavedSpot {
  id: string;
  tripId: string;
  name: string;
  note?: string;
  toolId?: NearYouToolId | string;
  mapsUrl?: string;
  websiteUrl?: string;
  savedAt?: string;
  savedByLabel?: string;
}

export const SAVED_SPOTS_CHANGED_EVENT = 'travelhub-saved-spots-changed';

function notifyChanged(): void {
  window.dispatchEvent(new Event(SAVED_SPOTS_CHANGED_EVENT));
}

function parseMeta(taskNote?: string): SavedSpotMeta {
  const raw = (taskNote || '').trim();
  if (!raw.startsWith('{')) return {};
  try {
    return JSON.parse(raw) as SavedSpotMeta;
  } catch {
    return {};
  }
}

function serializeMeta(meta: SavedSpotMeta): string {
  return JSON.stringify(meta);
}

export function isSavedSpotReminder(reminder: Pick<TripReminder, 'reminderType'>): boolean {
  return reminder.reminderType === SAVED_SPOT_REMINDER_TYPE;
}

function rowFromReminder(r: TripReminder): TripSavedSpot {
  const meta = parseMeta(r.taskNote);
  return {
    id: r.id,
    tripId: r.tripId,
    name: r.title || r.reminderText || '',
    note: r.reminderText?.trim() || undefined,
    toolId: meta.toolId,
    mapsUrl: meta.mapsUrl,
    websiteUrl: meta.websiteUrl,
    savedAt: r.dueDate,
    savedByLabel: r.assignedTo
  };
}

export async function loadTripSavedSpots(spContext: WebPartContext, tripId: string): Promise<TripSavedSpot[]> {
  const svc = new ReminderService(spContext);
  const rows = await svc.getForTrip(tripId);
  return rows
    .filter(isSavedSpotReminder)
    .map(rowFromReminder)
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export async function saveTripSavedSpot(
  spContext: WebPartContext,
  tripId: string,
  place: {
    name: string;
    note?: string;
    mapsUrl?: string;
    websiteUrl?: string;
    toolId?: string;
  },
  members?: TripMember[]
): Promise<TripSavedSpot> {
  const svc = new ReminderService(spContext);
  const email = getCurrentUserEmail(spContext);
  const existing = (await loadTripSavedSpots(spContext, tripId)).find(
    (x) => x.name.trim().toLowerCase() === place.name.trim().toLowerCase() && x.toolId === place.toolId
  );
  const meta: SavedSpotMeta = {
    toolId: place.toolId,
    mapsUrl: place.mapsUrl,
    websiteUrl: place.websiteUrl,
    authorEmail: email
  };
  if (existing) {
    await svc.update(existing.id, {
      title: place.name.trim(),
      reminderText: place.note?.trim() || place.name.trim(),
      taskNote: serializeMeta(meta)
    });
    notifyChanged();
    const rows = await loadTripSavedSpots(spContext, tripId);
    return rows.find((x) => x.id === existing.id) ?? existing;
  }
  const created = await svc.create({
    title: place.name.trim(),
    tripId,
    dayId: '',
    entryId: '',
    reminderType: SAVED_SPOT_REMINDER_TYPE,
    reminderText: place.note?.trim() || place.name.trim(),
    taskNote: serializeMeta(meta),
    assignedTo: travellerLabelForCurrentUser(spContext, members),
    isComplete: false,
    dueDate: new Date().toISOString()
  });
  notifyChanged();
  return rowFromReminder(created);
}

export async function updateTripSavedSpotNote(
  spContext: WebPartContext,
  id: string,
  note: string
): Promise<void> {
  const svc = new ReminderService(spContext);
  await svc.update(id, { reminderText: note.trim() });
  notifyChanged();
}

export async function deleteTripSavedSpot(spContext: WebPartContext, id: string): Promise<void> {
  const svc = new ReminderService(spContext);
  await svc.delete(id);
  notifyChanged();
}

/** One-time import of device localStorage saves into a trip (skips duplicates). */
export async function migrateLocalSavedSpotsToTrip(
  spContext: WebPartContext,
  tripId: string,
  members?: TripMember[]
): Promise<number> {
  const local = loadNearYouSavedPlaces();
  if (!local.length) return 0;
  const existing = await loadTripSavedSpots(spContext, tripId);
  const existingKeys = new Set(existing.map((x) => `${x.toolId || ''}|${x.name.toLowerCase()}`));
  let imported = 0;
  for (const row of local) {
    const key = `${row.toolId || ''}|${row.name.toLowerCase()}`;
    if (existingKeys.has(key)) continue;
    await saveTripSavedSpot(
      spContext,
      tripId,
      {
        name: row.name,
        note: row.note,
        mapsUrl: row.mapsUrl,
        websiteUrl: row.websiteUrl,
        toolId: row.toolId
      },
      members
    );
    existingKeys.add(key);
    imported += 1;
  }
  if (imported) {
    for (const row of local) {
      removeLocalSavedPlace(row.id);
    }
  }
  return imported;
}
