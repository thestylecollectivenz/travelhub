import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

const OWNER_EMAIL_FIELD = { internalName: 'OwnerEmail', type: 'Text' as const };

export async function ensureOwnerEmailColumns(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'JournalEntries', [OWNER_EMAIL_FIELD]);
  await ensureSharePointList(ctx, 'PackingList', [OWNER_EMAIL_FIELD]);
  await ensureSharePointList(ctx, 'ShoppingList', [OWNER_EMAIL_FIELD]);
}
