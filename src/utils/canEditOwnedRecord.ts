import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripMember } from '../models/TripMember';
import { getCurrentUserEmail } from './currentUserEmail';
import { assigneeLabelMatchesCurrentUser } from './tripMemberIdentity';

/** True when the current user may edit/delete this owned record (Companion own-items rule). */
export function canEditOwnedRecord(
  ctx: WebPartContext,
  ownerEmail: string | undefined,
  userRole: 'Editor' | 'Companion' | 'Follower',
  assigneeLabel?: string,
  members?: TripMember[]
): boolean {
  if (userRole === 'Editor') return true;
  if (userRole === 'Follower') return false;
  const mine = getCurrentUserEmail(ctx);
  const owner = (ownerEmail ?? '').trim().toLowerCase();
  if (owner && owner === mine) return true;
  if (assigneeLabel && assigneeLabelMatchesCurrentUser(ctx, assigneeLabel, members)) return true;
  if (!owner) return false;
  return false;
}
