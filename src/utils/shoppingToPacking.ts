import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ShoppingItem } from '../services/ShoppingListService';
import { PackingService } from '../services/PackingService';
import { confirmUserAction } from './confirmAction';
import { resolveOwnerEmailForAssignee } from './tripMemberIdentity';
import type { TripMember } from '../models/TripMember';

/**
 * After marking a shopping item purchased, offer to copy it onto the packing list
 * for the traveller named on the shopping item.
 */
export async function offerAddPurchasedShoppingToPacking(
  ctx: WebPartContext,
  tripId: string,
  item: ShoppingItem,
  members?: TripMember[]
): Promise<void> {
  const traveller = (item.traveller || '').trim() || 'Traveller';
  const label = (item.itemName || 'this item').trim() || 'this item';
  const ok = await confirmUserAction(`Add "${label}" to the packing list for ${traveller}?`);
  if (!ok) return;

  const packing = new PackingService(ctx);
  const ownerEmail =
    (item.ownerEmail || '').trim() || resolveOwnerEmailForAssignee(ctx, traveller, members ?? []);
  await packing.create({
    tripId,
    category: (item.category || '').trim() || 'Other',
    itemName: label,
    quantity: 1,
    isPacked: false,
    isTemplate: false,
    traveller,
    ownerEmail,
    itemNotes: (item.notes || '').trim() || undefined
  });
}
