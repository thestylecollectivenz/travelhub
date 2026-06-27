import * as React from 'react';
import type { TripRoleLevel } from '../models/TripMember';
import { useCurrentUserRole } from '../hooks/useCurrentUserRole';

const TripRoleContext = React.createContext<{
  role: TripRoleLevel;
  loading: boolean;
  refreshRole: () => void;
}>({ role: 'Editor', loading: false, refreshRole: () => undefined });

export const TripRoleProvider: React.FC<{ tripId: string; children: React.ReactNode }> = ({ tripId, children }) => {
  const { role, loading, refresh } = useCurrentUserRole(tripId);
  const value = React.useMemo(() => ({ role, loading, refreshRole: refresh }), [role, loading, refresh]);
  return <TripRoleContext.Provider value={value}>{children}</TripRoleContext.Provider>;
};

export function useTripRole(): { role: TripRoleLevel; loading: boolean; refreshRole: () => void } {
  return React.useContext(TripRoleContext);
}
