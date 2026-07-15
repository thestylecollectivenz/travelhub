import * as React from 'react';
import L from 'leaflet';
import '../maps/LeafletCompat.css';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import type { DiningSuggestionRow, NearestPlaceKind, NearestPlaceRow } from '../../utils/locationInfoEntry';
import { MOBILE_NEAR_YOU_ON_SITE_KM, resolveLocationSearchContext } from '../../utils/locationGeoContext';
import { placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import {
  loadNearYouCache,
  nearYouScopeForHome,
  nearYouScopeForLocation,
  saveNearYouCache,
  type NearYouCachedResult
} from '../../utils/nearYouResultCache';
import { NearYouResultCard } from './NearYouResultCard';
import styles from './MobileNearYouResults.module.css';

export interface MobileNearYouResultsProps {
  toolId: NearYouToolId;
  onBack: () => void;
  tripTitle?: string;
  tripDateRange?: string;
  /** When set, search near this place (GPS if within 50 km, else place coords). */
  place?: Place;
  locationEntryId?: string;
  locationLabel?: string;
  /** Map-picked search centre (force trip_place semantics). */
  overrideCoords?: { lat: number; lng: number };
  onAddToItinerary?: (place: {
    name: string;
    note?: string;
    mapsUrl?: string;
    websiteUrl?: string;
  }) => void | Promise<void>;
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }) => boolean | void;
}

type ViewMode = 'map' | 'list' | 'ai';

function toolDef(id: NearYouToolId) {
  return NEAR_YOU_TOOLS.find((t) => t.id === id) ?? NEAR_YOU_TOOLS[0];
}

function addTiles(map: L.Map): void {
  const primary = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });
  let switched = false;
  let errors = 0;
  primary.on('tileerror', () => {
    errors += 1;
    if (switched || errors < 3) return;
    switched = true;
    map.removeLayer(primary);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap & CARTO'
    }).addTo(map);
  });
  primary.addTo(map);
}

function toCardsFromDining(items: DiningSuggestionRow[]): NearYouCachedResult[] {
  return items.slice(0, 10).map((p, i) => ({
    id: p.id,
    name: p.name,
    note: p.bestFor || p.description,
    rating: p.rating,
    priceLevel: p.priceLevel,
    mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name),
    websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name),
    reviewsUrl: p.reviewsUrl,
    aiBlurb: p.why || p.description || p.bestFor,
    topPick: i === 0
  }));
}

function toCardsFromNearest(places: NearestPlaceRow[]): NearYouCachedResult[] {
  return places.slice(0, 10).map((p, i) => ({
    id: p.id,
    name: p.name,
    note: p.note || p.servicesSummary,
    address: p.address,
    mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name, p.address),
    websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name, p.address),
    reviewsUrl: p.reviewsUrl,
    aiBlurb: p.note || p.servicesSummary,
    topPick: i === 0
  }));
}

export const MobileNearYouResults: React.FC<MobileNearYouResultsProps> = ({
  toolId,
  onBack,
  tripTitle,
  tripDateRange,
  place,
  locationEntryId,
  locationLabel,
  overrideCoords,
  onAddToItinerary,
  onSavePlace
}) => {
  const { config } = useConfig();
  const tool = toolDef(toolId);
  const cacheScope = locationEntryId
    ? nearYouScopeForLocation(locationEntryId, overrideCoords)
    : nearYouScopeForHome();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [view, setView] = React.useState<ViewMode>('list');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [filterOpenNow, setFilterOpenNow] = React.useState(false);
  const [filterWalkable, setFilterWalkable] = React.useState(false);
  const [filterRated, setFilterRated] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [contextLabel, setContextLabel] = React.useState('');
  const [userLat, setUserLat] = React.useState<number | null>(null);
  const [userLng, setUserLng] = React.useState<number | null>(null);
  const [results, setResults] = React.useState<NearYouCachedResult[]>([]);
  const [fromCache, setFromCache] = React.useState(false);
  const mapHostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  const subTitle = React.useMemo(() => {
    if (contextLabel) return contextLabel;
    if (locationLabel) return `${locationLabel} · based on trip place`;
    return 'Based on your current location';
  }, [contextLabel, locationLabel]);

  const load = React.useCallback(
    async (forceRefresh = false): Promise<void> => {
      const apiKey = (config.geminiApiKey || '').trim();
      if (!apiKey) {
        setError('Add a Gemini API key in Profile / User settings.');
        setResults([]);
        return;
      }

      if (!forceRefresh) {
        const cached = loadNearYouCache(cacheScope, toolId);
        if (cached?.results?.length) {
          setResults(cached.results);
          setContextLabel(cached.contextLabel);
          setFromCache(true);
          setError('');
          return;
        }
      }

      setBusy(true);
      setError('');
      setFromCache(false);
      try {
        let searchContext;
        if (place) {
          searchContext = await resolveLocationSearchContext(place, {
            onSiteKm: MOBILE_NEAR_YOU_ON_SITE_KM,
            forceTripPlace: Boolean(locationEntryId),
            overrideCoords
          });
        } else {
          if (!navigator.geolocation) {
            setError('Location is not available on this device.');
            return;
          }
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 60000
            });
          });
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          searchContext = {
            mode: 'onsite' as const,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            placeName: 'Current location',
            country: ''
          };
        }

        if (!searchContext) {
          setError('Could not resolve a search location for this place.');
          return;
        }

        setUserLat(searchContext.latitude);
        setUserLng(searchContext.longitude);
        const label =
          searchContext.mode === 'onsite'
            ? locationLabel
              ? `Near you · ${locationLabel}`
              : 'Based on your current location'
            : locationLabel
              ? `Near ${locationLabel}`
              : `Near ${searchContext.placeName}`;
        setContextLabel(label);

        let cards: NearYouCachedResult[] = [];
        if (toolId === 'dining' || toolId === 'cafes') {
          const { items } = await generateDiningSuggestions({
            apiKey,
            searchContext,
            venueFocus: toolId === 'cafes' ? 'cafes' : 'restaurants'
          });
          cards = toCardsFromDining(items);
        } else if (tool.kind) {
          const { places } = await generateNearestPlaces(tool.kind as NearestPlaceKind, { apiKey, searchContext });
          cards = toCardsFromNearest(places);
        }
        setResults(cards);
        saveNearYouCache(cacheScope, toolId, {
          results: cards,
          fetchedAt: new Date().toISOString(),
          contextLabel: label,
          aiPrompt: aiPrompt.trim() || undefined
        });
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Could not find nearby places.');
      } finally {
        setBusy(false);
      }
    },
    [aiPrompt, cacheScope, config.geminiApiKey, locationLabel, place, tool.kind, toolId]
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const visible = React.useMemo(() => {
    let rows = results.slice();
    if (filterRated) rows = rows.filter((r) => typeof r.rating === 'number' && r.rating >= 4.3);
    if (filterOpenNow || filterWalkable) rows = rows.slice().sort((a, b) => Number(b.topPick) - Number(a.topPick));
    return rows;
  }, [results, filterOpenNow, filterWalkable, filterRated]);

  const aiPicks = React.useMemo(
    () => visible.filter((r) => r.topPick || (r.rating && r.rating >= 4.5)).slice(0, 5),
    [visible]
  );

  React.useEffect(() => {
    if (view !== 'map') return undefined;
    const el = mapHostRef.current;
    if (!el) return undefined;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = L.map(el, { zoomControl: false, attributionControl: false });
    mapRef.current = map;
    addTiles(map);
    const layer = L.layerGroup().addTo(map);
    if (userLat != null && userLng != null) {
      const me = L.latLng(userLat, userLng);
      L.circleMarker(me, {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#2E90D1',
        fillOpacity: 1
      })
        .bindTooltip('Search centre', { permanent: false })
        .addTo(layer);
      map.setView(me, 14);
    } else {
      map.setView([-41.29, 174.78], 11);
    }
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [view, userLat, userLng, visible.length]);

  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const listForView = view === 'ai' ? (aiPicks.length ? aiPicks : visible.slice(0, 5)) : visible;
  const saveLabel = locationLabel ? `Save to ${locationLabel.split(',')[0]}` : 'Save';

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} onClick={onBack}>
          {`< ${locationEntryId ? locationLabel || 'Location' : 'Near you'}`}
        </button>
        <div className={styles.tripMeta}>
          <p className={styles.tripTitle}>{tripTitle || 'Near you'}</p>
          {tripDateRange ? <p className={styles.tripDates}>{tripDateRange}</p> : null}
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void load(true)}
          disabled={busy}
          aria-label="Refresh results"
          title="Refresh results"
        >
          ↻
        </button>
      </header>

      <h1 className={styles.heading}>{tool.label} Nearby</h1>
      <p className={styles.sub}>{subTitle}</p>
      {fromCache ? <p className={styles.cachedNote}>Showing saved results · tap ↻ to refresh</p> : null}

      <div className={styles.aiSearch}>
        <span className={styles.sparkle} aria-hidden>
          ✦
        </span>
        <input
          className={styles.aiInput}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={`Ask AI: refine ${tool.shortLabel.toLowerCase()}…`}
          aria-label="Ask AI to refine results"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && aiPrompt.trim()) void load(true);
          }}
        />
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${filterOpenNow ? styles.chipOn : ''}`}
          onClick={() => setFilterOpenNow((v) => !v)}
        >
          <span className={styles.dotGreen} /> Open now
        </button>
        <button
          type="button"
          className={`${styles.chip} ${filterWalkable ? styles.chipOn : ''}`}
          onClick={() => setFilterWalkable((v) => !v)}
        >
          Walkable
        </button>
        <button
          type="button"
          className={`${styles.chip} ${filterRated ? styles.chipOn : ''}`}
          onClick={() => setFilterRated((v) => !v)}
        >
          Highly rated
        </button>
      </div>

      <div className={styles.seg} role="tablist" aria-label="Results view">
        {(['map', 'list', 'ai'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            className={`${styles.segBtn} ${view === mode ? styles.segBtnOn : ''}`}
            onClick={() => setView(mode)}
          >
            {mode === 'ai' ? '✦ AI Picks' : mode === 'map' ? 'Map' : 'List'}
          </button>
        ))}
      </div>

      {view === 'map' ? (
        <div className={styles.mapCard}>
          <div ref={mapHostRef} className={styles.mapCanvas} />
          <p className={styles.mapHint}>{busy ? 'Searching…' : `${visible.length} places`}</p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {busy && !results.length ? <p className={styles.muted}>Searching…</p> : null}

      <div className={styles.list}>
        {listForView.map((r) => (
          <NearYouResultCard
            key={r.id}
            result={r}
            categoryLabel={tool.shortLabel}
            saveLabel={saveLabel}
            onSave={
              onSavePlace
                ? () => {
                    const saved = onSavePlace({
                      name: r.name,
                      note: r.note,
                      mapsUrl: r.mapsUrl,
                      websiteUrl: r.websiteUrl,
                      toolId
                    });
                    if (saved !== false) showToast(locationEntryId ? `Saved · ${r.name}` : `Saved · ${r.name}`);
                  }
                : undefined
            }
            onAddToItinerary={
              onAddToItinerary
                ? () => {
                    void Promise.resolve(
                      onAddToItinerary({
                        name: r.name,
                        note: r.note,
                        mapsUrl: r.mapsUrl,
                        websiteUrl: r.websiteUrl
                      })
                    )
                      .then(() => {
                        if (!locationEntryId) showToast('Opening itinerary editor…');
                      })
                      .catch(() => {
                        setToast('Could not add to itinerary.');
                        window.setTimeout(() => setToast(''), 2800);
                      });
                  }
                : undefined
            }
          />
        ))}
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
};
