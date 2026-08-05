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
  /** Invite / manage trip members and site access settings (Editor only). */
  canManageAccess: boolean;
  /** Full trip profile (dates, hero, status) — Editors only. */
  canEditTripSettings: boolean;
  /** Ask AI, Near You, location-info AI tools (Companion+). */
  canUseAiHelpers: boolean;
  /** Packing / shopping / tasks / ideas. */
  canViewLists: boolean;
  /** Pre-trip day in day pickers / sidebar. */
  canViewPreTrip: boolean;
  /** Document files (PDFs etc). Links remain available when false. */
  canViewDocuments: boolean;
  /** Desktop workspace layout. Followers use phone / iPad shells only. */
  canUseDesktopShell: boolean;
  /** Read-only private trip (Follower on workspace). */
  isReadOnlyWorkspace: boolean;
}

export function useTripPermissions(): TripPermissions {
  const { role, loading } = useTripRole();
  const isEditor = role === 'Editor';
  const isCompanionOrEditor = role === 'Editor' || role === 'Companion';
  const isFollower = role === 'Follower';
  return {
    role,
    loading,
    canEditItinerary: isEditor,
    canManageTrip: isEditor,
    canEditDayMeta: isEditor,
    canUseExports: isEditor,
    canDeleteTrip: isEditor,
    canSeeFinancials: isCompanionOrEditor,
    canManageAccess: isEditor,
    canEditTripSettings: isEditor,
    canUseAiHelpers: isCompanionOrEditor,
    canViewLists: isCompanionOrEditor,
    canViewPreTrip: isCompanionOrEditor,
    canViewDocuments: isCompanionOrEditor,
    canUseDesktopShell: !isFollower,
    isReadOnlyWorkspace: isFollower
  };
}
