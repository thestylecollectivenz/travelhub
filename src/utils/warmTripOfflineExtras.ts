import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { PackingService } from '../services/PackingService';
import { ShoppingListService } from '../services/ShoppingListService';
import { ReminderService } from '../services/ReminderService';
import { PlaceService } from '../services/PlaceService';
import { DocumentService } from '../services/DocumentService';
import { LinkService } from '../services/LinkService';
import {
  loadTripsIndexCache,
  patchTripOfflineExtrasCache,
  saveTripsIndexCache,
  type TripOfflineExtrasPatch
} from './tripOfflineCache';
import type { Trip } from '../models/Trip';

/** How often to re-fetch extras while a trip stays open (ms). */
export const TRIP_OFFLINE_EXTRAS_REFRESH_MS = 5 * 60 * 1000;

/**
 * Background warm of list/map/attachment slices into the trip offline snapshot.
 * Non-blocking; failures are ignored (core trip cache still works).
 * Returns ISO timestamp when something was written, otherwise undefined.
 */
export async function warmTripOfflineExtras(spContext: WebPartContext, tripId: string): Promise<string | undefined> {
  const id = (tripId || '').trim();
  if (!id) return undefined;

  const packingSvc = new PackingService(spContext);
  const shoppingSvc = new ShoppingListService(spContext);
  const reminderSvc = new ReminderService(spContext);
  const placeSvc = new PlaceService(spContext);
  const docSvc = new DocumentService(spContext);
  const linkSvc = new LinkService(spContext);

  const [packingItems, shoppingItems, reminders, places, documents, links] = await Promise.all([
    packingSvc.getForTrip(id).catch(() => undefined),
    shoppingSvc.getForTrip(id).catch(() => undefined),
    reminderSvc.getForTrip(id).catch(() => undefined),
    placeSvc.getAll().catch(() => undefined),
    docSvc.getAll(id).catch(() => undefined),
    linkSvc.getAll(id).catch(() => undefined)
  ]);

  const patch: TripOfflineExtrasPatch = {
    ...(packingItems ? { packingItems } : {}),
    ...(shoppingItems ? { shoppingItems } : {}),
    ...(reminders ? { reminders } : {}),
    ...(places ? { places } : {}),
    ...(documents ? { documents } : {}),
    ...(links ? { links } : {})
  };

  if (!Object.keys(patch).length) return undefined;

  const savedAt = new Date().toISOString();
  await patchTripOfflineExtrasCache(id, patch);
  return savedAt;
}

/**
 * Keep the home trips index from going completely stale when the user never
 * leaves the open trip — merge the live trip header into the cached index.
 */
export async function syncOpenTripIntoTripsIndex(trip: Trip): Promise<void> {
  const id = (trip?.id || '').trim();
  if (!id) return;
  const existing = await loadTripsIndexCache();
  if (!existing?.trips?.length) {
    await saveTripsIndexCache({
      trips: [trip],
      places: [],
      tripDays: [],
      savedAt: new Date().toISOString()
    });
    return;
  }
  const nextTrips = existing.trips.map((t) => (t.id === id ? { ...t, ...trip, id } : t));
  if (!nextTrips.some((t) => t.id === id)) nextTrips.unshift(trip);
  await saveTripsIndexCache({
    trips: nextTrips,
    places: existing.places || [],
    tripDays: existing.tripDays || [],
    savedAt: new Date().toISOString()
  });
}
