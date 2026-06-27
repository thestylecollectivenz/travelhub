import { useTripRole } from '../context/TripRoleContext';

/** Editors only — financial amounts, payment status, and booking references. */
export function useCanSeeFinancials(): boolean {
  const { role } = useTripRole();
  return role === 'Editor';
}
