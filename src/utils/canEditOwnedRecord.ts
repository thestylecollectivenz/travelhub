import { WebPartContext } from '@microsoft/sp-webpart-base';
import { getCurrentUserEmail } from './currentUserEmail';

/** True when the current user may edit/delete this owned record (Companion own-items rule). */
export function canEditOwnedRecord(
  ctx: WebPartContext,
  ownerEmail: string | undefined,
  userRole: 'Editor' | 'Companion' | 'Follower'
): boolean {
  if (userRole === 'Editor') return true;
  if (userRole === 'Follower') return false;
  const mine = getCurrentUserEmail(ctx);
  const owner = (ownerEmail ?? '').trim().toLowerCase();
  if (!owner) return true;
  return owner === mine;
}
