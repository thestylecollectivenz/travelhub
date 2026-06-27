export type TripRoleLevel = 'Editor' | 'Companion' | 'Follower';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  role: TripRoleLevel;
  invitedBy: string;
  invitedAt: string;
}

export const TRIP_ROLE_RANK: Record<TripRoleLevel, number> = {
  Follower: 0,
  Companion: 1,
  Editor: 2
};

export function parseTripRoleLevel(raw: string | undefined): TripRoleLevel | null {
  const v = (raw ?? '').trim();
  if (v === 'Editor' || v === 'Companion' || v === 'Follower') return v;
  return null;
}

export function roleMeetsRequirement(userRole: TripRoleLevel, required: TripRoleLevel): boolean {
  return TRIP_ROLE_RANK[userRole] >= TRIP_ROLE_RANK[required];
}
