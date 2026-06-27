import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

export const TRIP_ACCESS_LOG_LIST = 'TripAccessLog';

export const TRIP_ACCESS_LOG_FIELDS = [
  { internalName: 'TripId', type: 'Text' as const },
  { internalName: 'UserEmail', type: 'Text' as const },
  { internalName: 'UserDisplayName', type: 'Text' as const },
  { internalName: 'Action', type: 'Text' as const },
  { internalName: 'Resource', type: 'Text' as const },
  { internalName: 'AccessedAt', type: 'DateTime' as const }
];

export async function ensureTripAccessLogList(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, TRIP_ACCESS_LOG_LIST, TRIP_ACCESS_LOG_FIELDS);
}
