import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import { TripMembersService } from '../services/TripMembersService';

/**
 * True when the signed-in user only has Follower TripMembers rows (no Editor/Companion).
 * Used to force phone/iPad shells on the home screen.
 */
export function useFollowerOnlyShell(): boolean {
  const spContext = useSpContext();
  const [followerOnly, setFollowerOnly] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const svc = new TripMembersService(spContext);
    void svc
      .getRolesForCurrentUser()
      .then((roles) => {
        if (cancelled) return;
        if (!roles.length) {
          setFollowerOnly(false);
          return;
        }
        const hasElevated = roles.some((r) => r === 'Editor' || r === 'Companion');
        setFollowerOnly(!hasElevated && roles.some((r) => r === 'Follower'));
      })
      .catch(() => {
        if (!cancelled) setFollowerOnly(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spContext]);

  return followerOnly;
}
