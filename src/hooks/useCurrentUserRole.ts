import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import { TripMembersService } from '../services/TripMembersService';
import type { TripRoleLevel } from '../models/TripMember';
import { resolveTripRoleForUser } from '../utils/resolveTripRole';

const roleCache = new Map<string, TripRoleLevel>();

export function clearTripRoleCache(tripId?: string): void {
  if (!tripId) {
    roleCache.clear();
    return;
  }
  roleCache.delete(tripId);
}

export function useCurrentUserRole(tripId: string | undefined): {
  role: TripRoleLevel;
  loading: boolean;
  refresh: () => void;
} {
  const spContext = useSpContext();
  const [role, setRole] = React.useState<TripRoleLevel>('Editor');
  const [loading, setLoading] = React.useState(Boolean(tripId));

  const load = React.useCallback(() => {
    if (!tripId) {
      setRole('Editor');
      setLoading(false);
      return;
    }
    const cached = roleCache.get(tripId);
    if (cached) {
      setRole(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    const svc = new TripMembersService(spContext);
    void (async () => {
      try {
        const me = svc.currentUserSnapshot();
        const [members, author] = await Promise.all([svc.getForTrip(tripId), svc.getTripAuthorIdentity(tripId)]);
        const resolved = resolveTripRoleForUser(svc, me.email, members, author);
        roleCache.set(tripId, resolved);
        setRole(resolved);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('useCurrentUserRole: defaulting to Editor', err);
        setRole('Editor');
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId, spContext]);

  React.useEffect(() => {
    load();
  }, [load]);

  const refresh = React.useCallback(() => {
    if (tripId) roleCache.delete(tripId);
    load();
  }, [tripId, load]);

  return { role, loading, refresh };
}
