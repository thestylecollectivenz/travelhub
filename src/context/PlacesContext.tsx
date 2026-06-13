import * as React from 'react';
import type { Place, PlaceCandidate } from '../models';
import { PlaceService } from '../services/PlaceService';
import { useSpContext } from './SpContext';

interface PlacesContextValue {
  places: Place[];
  loading: boolean;
  searchPlaces: (query: string) => Promise<PlaceCandidate[]>;
  createOrReusePlace: (candidate: PlaceCandidate) => Promise<Place>;
  placeById: (id?: string) => Place | undefined;
  /** Fetch any place rows referenced by id but not yet in memory. */
  ensurePlacesLoaded: (ids: string[]) => Promise<void>;
  refreshPlaces: () => Promise<void>;
}

const PlacesContext = React.createContext<PlacesContextValue | undefined>(undefined);

export const PlacesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refreshPlaces = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const svc = new PlaceService(spContext);
      const all = await svc.getAll();
      setPlaces(all);
    } finally {
      setLoading(false);
    }
  }, [spContext]);

  React.useEffect(() => {
    refreshPlaces().catch(console.error);
  }, [refreshPlaces]);

  const searchPlaces = React.useCallback(
    async (query: string): Promise<PlaceCandidate[]> => {
      const svc = new PlaceService(spContext);
      return svc.search(query);
    },
    [spContext]
  );

  const createOrReusePlace = React.useCallback(
    async (candidate: PlaceCandidate): Promise<Place> => {
      const svc = new PlaceService(spContext);
      const created = await svc.create({
        title: candidate.title,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        country: candidate.country,
        countryCode: candidate.countryCode,
        placeType: (candidate.placeType || 'other').toLowerCase() as Place['placeType'],
        timeZone: candidate.timeZone || '',
        nominatimId: candidate.nominatimId
      });
      setPlaces((prev) => {
        const idx = prev.findIndex((p) => p.id === created.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = created;
          return next;
        }
        return [created, ...prev];
      });
      return created;
    },
    [spContext]
  );

  const placeById = React.useCallback(
    (id?: string): Place | undefined => {
      if (!id) return undefined;
      return places.find((p) => p.id === id);
    },
    [places]
  );

  const ensurePlacesLoaded = React.useCallback(
    async (ids: string[]): Promise<void> => {
      const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
      const missing = unique.filter((id) => !places.some((p) => p.id === id));
      if (missing.length === 0) return;
      const svc = new PlaceService(spContext);
      const loaded = await Promise.all(
        missing.map((id) =>
          svc.getById(id).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('ensurePlacesLoaded', id, err);
            return undefined;
          })
        )
      );
      const found = loaded.filter((p): p is Place => p !== undefined);
      if (found.length === 0) return;
      setPlaces((prev) => {
        const next = [...prev];
        for (const place of found) {
          if (!next.some((p) => p.id === place.id)) {
            next.push(place);
          }
        }
        return next;
      });
    },
    [places, spContext]
  );

  const value = React.useMemo<PlacesContextValue>(
    () => ({
      places,
      loading,
      searchPlaces,
      createOrReusePlace,
      placeById,
      ensurePlacesLoaded,
      refreshPlaces
    }),
    [places, loading, searchPlaces, createOrReusePlace, placeById, ensurePlacesLoaded, refreshPlaces]
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
};

export function usePlaces(): PlacesContextValue {
  const ctx = React.useContext(PlacesContext);
  if (!ctx) throw new Error('usePlaces must be used within PlacesProvider');
  return ctx;
}
