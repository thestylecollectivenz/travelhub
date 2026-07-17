import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

/**
 * Append-only: trip-scoped home/origin place IDs for AI idea balancing.
 * Stored as semicolon-separated Place IDs so multiple homes (e.g. Wellington + Auckland) are shared for all travellers.
 */
export async function ensureHomePlaceIdOnTrips(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, 'Trips', [{ internalName: 'HomePlaceId', type: 'Text' }]);
}
