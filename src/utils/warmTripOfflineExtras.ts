import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { PackingService } from '../services/PackingService';
import { ShoppingListService } from '../services/ShoppingListService';
import { ReminderService } from '../services/ReminderService';
import { PlaceService } from '../services/PlaceService';
import { DocumentService } from '../services/DocumentService';
import { LinkService } from '../services/LinkService';
import { patchTripOfflineExtrasCache } from './tripOfflineCache';

/**
 * Background warm of list/map/attachment slices into the trip offline snapshot.
 * Non-blocking; failures are ignored (core trip cache still works).
 */
export async function warmTripOfflineExtras(spContext: WebPartContext, tripId: string): Promise<void> {
  const id = (tripId || '').trim();
  if (!id) return;

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

  await patchTripOfflineExtrasCache(id, {
    ...(packingItems ? { packingItems } : {}),
    ...(shoppingItems ? { shoppingItems } : {}),
    ...(reminders ? { reminders } : {}),
    ...(places ? { places } : {}),
    ...(documents ? { documents } : {}),
    ...(links ? { links } : {})
  });
}
