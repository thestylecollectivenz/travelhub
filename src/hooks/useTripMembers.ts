import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import { useConfig } from '../context/ConfigContext';
import { TripMembersService } from '../services/TripMembersService';
import type { TripMember } from '../models/TripMember';
import { getCurrentUserEmail } from '../utils/currentUserEmail';
import { mergeTripTravellersWithMembers } from '../utils/tripTravellers';

export function useTripMembers(tripId: string | undefined): {
  members: TripMember[];
  myMember: TripMember | undefined;
  /** Editor + Companion display labels only (never Follower / Traveller N). */
  travellers: string[];
  loading: boolean;
  refresh: () => void;
} {
  const spContext = useSpContext();
  const { journalAuthorName } = useConfig();
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [travellers, setTravellers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(Boolean(tripId));

  const load = React.useCallback(() => {
    if (!tripId) {
      setMembers([]);
      setTravellers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const svc = new TripMembersService(spContext);
    void svc
      .getForTrip(tripId)
      .then((rows) => {
        setMembers(rows);
        const eligible = rows.filter((m) => m.role === 'Editor' || m.role === 'Companion');
        const merged = mergeTripTravellersWithMembers(tripId, eligible, {
          currentUserEmail: getCurrentUserEmail(spContext),
          journalAuthorName
        });
        setTravellers(merged);
        setLoading(false);
      })
      .catch(() => {
        setMembers([]);
        setTravellers(
          mergeTripTravellersWithMembers(tripId, [], {
            currentUserEmail: getCurrentUserEmail(spContext),
            journalAuthorName
          })
        );
        setLoading(false);
      });
  }, [tripId, spContext, journalAuthorName]);

  React.useEffect(() => {
    load();
  }, [load]);

  const myMember = React.useMemo(() => {
    const mine = getCurrentUserEmail(spContext);
    return members.find((m) => m.userEmail === mine);
  }, [members, spContext]);

  return { members, myMember, travellers, loading, refresh: load };
}
