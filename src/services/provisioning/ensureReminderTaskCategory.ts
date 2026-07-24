import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Append-only TaskCategory text column for standalone manual tasks. */
export async function ensureReminderTaskCategory(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'TripReminders', [{ internalName: 'TaskCategory', type: 'Text' }]);
}
