import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ensureSharePointList } from './sharePointListProvisioning';

export const TRIP_MEMBERS_LIST = 'TripMembers';

/** TripMembers columns per ES4 spec — append-only provisioning contract. */
export const TRIP_MEMBERS_FIELDS = [
  { internalName: 'TripId', type: 'Text' as const },
  { internalName: 'UserId', type: 'Text' as const },
  { internalName: 'UserEmail', type: 'Text' as const },
  { internalName: 'UserDisplayName', type: 'Text' as const },
  { internalName: 'AvatarUrl', type: 'Text' as const },
  { internalName: 'Role', type: 'Text' as const },
  { internalName: 'InvitedBy', type: 'Text' as const },
  { internalName: 'InvitedAt', type: 'DateTime' as const }
];

export async function ensureTripMembersList(ctx: WebPartContext): Promise<void> {
  await ensureSharePointList(ctx, TRIP_MEMBERS_LIST, TRIP_MEMBERS_FIELDS);
}
