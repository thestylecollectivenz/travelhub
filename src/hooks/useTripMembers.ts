import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import { TripMembersService } from '../services/TripMembersService';
import type { TripMember } from '../models/TripMember';
import { getCurrentUserEmail } from '../utils/currentUserEmail';
import { mergeTripTravellersWithMembers } from '../utils/tripTravellers';

export function useTripMembers(tripId: string | undefined): {
  members: TripMember[];
  myMember: TripMember | undefined;
  travellers: string[];
  loading: boolean;
  refresh: () => void;
} {
  const spContext = useSpContext();
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [travellers, setTravellers] = React.useState<string[]>(['Traveller 1']);
  const [loading, setLoading] = React.useState(Boolean(tripId));

  const load = React.useCallback(() => {
    if (!tripId) {
      setMembers([]);
      setTravellers(['Traveller 1']);
      setLoading(false);
      return;
    }
    setLoading(true);
    const svc = new TripMembersService(spContext);
    void svc
      .getForTrip(tripId)
      .then((rows) => {
        setMembers(rows);
        setTravellers(mergeTripTravellersWithMembers(tripId, rows));
        setLoading(false);
      })
      .catch(() => {
        setMembers([]);
        setTravellers(mergeTripTravellersWithMembers(tripId, []));
        setLoading(false);
      });
  }, [tripId, spContext]);

  React.useEffect(() => {
    load();
  }, [load]);

  const myMember = React.useMemo(() => {
    const mine = getCurrentUserEmail(spContext);
    return members.find((m) => m.userEmail === mine);
  }, [members, spContext]);

  return { members, myMember, travellers, loading, refresh: load };
}
