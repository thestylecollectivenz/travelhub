import { useTripRole } from '../context/TripRoleContext';
import type { TripRoleLevel } from '../models/TripMember';

export interface TripPermissions {
  role: TripRoleLevel;
  loading: boolean;
  /** Full itinerary, day structure, trip settings, exports. */
  canEditItinerary: boolean;
  canManageTrip: boolean;
  canEditDayMeta: boolean;
  canUseExports: boolean;
  canDeleteTrip: boolean;
  canSeeFinancials: boolean;
  /** Ask AI, Near You, location-info AI tools — save results to trip (Companion+). */
  canUseAiHelpers: boolean;
  /** Read-only private trip (Follower on workspace). */
  isReadOnlyWorkspace: boolean;
}

export function useTripPermissions(): TripPermissions {
  const { role, loading } = useTripRole();
  const isEditor = role === 'Editor';
  const isCompanionOrEditor = role === 'Editor' || role === 'Companion';
  return {
    role,
    loading,
    canEditItinerary: isEditor,
    canManageTrip: isEditor,
    canEditDayMeta: isEditor,
    canUseExports: isEditor,
    canDeleteTrip: isEditor,
    canSeeFinancials: isCompanionOrEditor,
    canUseAiHelpers: isCompanionOrEditor,
    isReadOnlyWorkspace: role === 'Follower'
  };
}
