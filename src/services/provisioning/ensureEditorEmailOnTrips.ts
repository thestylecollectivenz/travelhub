import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

export async function ensureEditorEmailOnTrips(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'Trips', [{ internalName: 'EditorEmail', type: 'Text' }]);
}
