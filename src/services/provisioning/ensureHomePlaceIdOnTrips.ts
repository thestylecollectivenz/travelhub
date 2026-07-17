import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/** Append-only: trip-scoped home/origin place for AI idea balancing. */
export async function ensureHomePlaceIdOnTrips(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'Trips', [{ internalName: 'HomePlaceId', type: 'Text' }]);
}
