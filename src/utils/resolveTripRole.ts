import type { TripAuthorIdentity } from '../services/TripMembersService';
import type { TripMember, TripRoleLevel } from '../models/TripMember';

export interface TripAuthorChecker {
  isCurrentUserTripAuthor(author: TripAuthorIdentity): boolean;
}

/**
 * Resolve the signed-in user's role for a trip.
 * Trip author is always Editor (even when not listed in TripMembers).
 */
export function resolveTripRoleForUser(
  authorChecker: TripAuthorChecker,
  userEmail: string,
  members: TripMember[],
  author: TripAuthorIdentity
): TripRoleLevel {
  if (authorChecker.isCurrentUserTripAuthor(author)) return 'Editor';

  const mine = members.find((m) => m.userEmail === userEmail);
  if (mine) return mine.role;

  if (members.length > 0) return 'Follower';

  return 'Editor';
}
