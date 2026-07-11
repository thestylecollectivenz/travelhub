import { useTripRole } from '../context/TripRoleContext';

/** Editors and Companions — Followers remain read-only without financial detail. */
export function useCanSeeFinancials(): boolean {
  const { role } = useTripRole();
  return role === 'Editor' || role === 'Companion';
}
