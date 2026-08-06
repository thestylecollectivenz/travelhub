import * as React from 'react';
import { useSpContext } from '../context/SpContext';
import { useConfig } from '../context/ConfigContext';
import { useOfflineStatus } from '../context/OfflineStatusContext';
import { TripMembersService } from '../services/TripMembersService';
import type { TripMember } from '../models/TripMember';
import { getCurrentUserEmail } from '../utils/currentUserEmail';
import { mergeTripTravellersWithMembers } from '../utils/tripTravellers';
import { loadTripOfflineCache, patchTripOfflineExtrasCache } from '../utils/tripOfflineCache';
import { isLikelyNetworkError } from '../utils/networkError';

function travellersFromCachedItems(
  tripId: string,
  members: TripMember[],
  packingTravellers: string[],
  shoppingTravellers: string[],
  currentUserEmail: string,
  journalAuthorName: string
): string[] {
  const eligible = members.filter((m) => m.role === 'Editor' || m.role === 'Companion');
  const merged = mergeTripTravellersWithMembers(tripId, eligible, {
    currentUserEmail,
    journalAuthorName
  });
  if (merged.length) return merged;
  // Offline fallback when TripMembers weren't cached yet: use labels on list items.
  const names = new Set<string>();
  for (const t of packingTravellers.concat(shoppingTravellers)) {
    const n = (t || '').trim();
    if (n) names.add(n);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

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
  const { reportNetworkFailure, setViewingCachedTrip, setLastCachedAt } = useOfflineStatus();
  const [members, setMembers] = React.useState<TripMember[]>([]);
  const [travellers, setTravellers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(Boolean(tripId));

  const applyRows = React.useCallback(
    (rows: TripMember[], packingNames: string[] = [], shoppingNames: string[] = []): void => {
      if (!tripId) return;
      setMembers(rows);
      setTravellers(
        travellersFromCachedItems(
          tripId,
          rows,
          packingNames,
          shoppingNames,
          getCurrentUserEmail(spContext),
          journalAuthorName
        )
      );
    },
    [tripId, spContext, journalAuthorName]
  );

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
        applyRows(rows);
        setLoading(false);
        void patchTripOfflineExtrasCache(tripId, { tripMembers: rows });
      })
      .catch(async (err) => {
        if (isLikelyNetworkError(err)) reportNetworkFailure(err);
        const cached = await loadTripOfflineCache(tripId);
        if (cached?.tripMembers?.length) {
          applyRows(
            cached.tripMembers,
            (cached.packingItems || []).map((i) => i.traveller || ''),
            (cached.shoppingItems || []).map((i) => i.traveller || '')
          );
          setViewingCachedTrip(true);
          setLastCachedAt(cached.savedAt || null);
        } else {
          applyRows(
            [],
            (cached?.packingItems || []).map((i) => i.traveller || ''),
            (cached?.shoppingItems || []).map((i) => i.traveller || '')
          );
        }
        setLoading(false);
      });
  }, [
    tripId,
    spContext,
    applyRows,
    reportNetworkFailure,
    setViewingCachedTrip,
    setLastCachedAt
  ]);

  React.useEffect(() => {
    load();
  }, [load]);

  const myMember = React.useMemo(() => {
    const mine = getCurrentUserEmail(spContext);
    return members.find((m) => m.userEmail === mine);
  }, [members, spContext]);

  return { members, myMember, travellers, loading, refresh: load };
}
