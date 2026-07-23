import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/**
 * TaskNote is a single-line Text (255 chars). Idea Q&A and replies need a Note field.
 * Append-only: never modify the existing TaskNote column.
 */
export async function ensureReminderTaskNoteLong(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'TripReminders', [{ internalName: 'TaskNoteLong', type: 'Note' }]);
}
