import * as React from 'react';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import type { DiningSuggestionRow, NearestPlaceRow } from '../../utils/locationInfoEntry';
import { MOBILE_NEAR_YOU_ON_SITE_KM, resolveLocationSearchContext } from '../../utils/locationGeoContext';
import { placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import {
  exploreCategoryById,
  exploreCategoryDiningFocus,
  exploreCategoryNearestKind,
  exploreCategoryToNearTool,
  normalizeExploreCategory,
  type ExploreCategoryId
} from '../../utils/exploreCategories';
import {
  loadNearYouCache,
  nearYouScopeForLocation,
  saveNearYouCache,
  type NearYouCachedResult
} from '../../utils/nearYouResultCache';
import { parseDistanceKm } from '../../utils/locationDistanceLabel';
import type { NearYouToolId } from '../../utils/nearYouTools';
import type { StoredStartPoint } from '../../utils/locationStartPointStorage';
import { MobileStartPointActions } from './MobileStartPointActions';
import { MobilePlaceDiscoverCard } from './MobilePlaceDiscoverCard';
import { MobileSubpageHeader } from './MobileSubpageHeader';
import { MobileExploreCategoryPills } from './MobileExploreCategoryPills';
import { MobileResultsMapSheet } from './MobileResultsMapSheet';
import { MobileLocationTravelTip } from './MobileLocationTravelTip';
import styles from './MobileExplorePlacesView.module.css';

export interface MobileExplorePlacesViewProps {
  place: Place | undefined;
  locationEntryId: string;
  locationLabel: string;
  startingPointLabel?: string;
  /** Map-picked search centre (force trip_place semantics). */
  overrideCoords?: { lat: number; lng: number };
  searchAnchorLabel?: string;
  initialCategory?: string;
  /** Practical tips from location notes for the bottom tip strip. */
  practicalTipsHtml?: string;
  onBack: () => void;
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
  savedStarts?: StoredStartPoint[];
  onSelectSavedStart?: (point: StoredStartPoint) => void;
  activeStart?: StoredStartPoint | null;
  onAppendToNotes?: (tipText: string) => void;
  onSavePlace?: (place: {
    name: string;
    note?: string;
    mapsUrl?: string;
    websiteUrl?: string;
    toolId?: string;
    address?: string;
    why?: string;
    bestFor?: string;
    rating?: number;
    priceLevel?: string;
    servicesSummary?: string;
  }) => boolean | void;
}

type ExploreCard = NearYouCachedResult & {
  categoryLabel: string;
  tags: string[];
  walkHint?: string;
  distanceRaw?: string;
};

const DINING_CATEGORIES: ExploreCategoryId[] = ['restaurants', 'cafes', 'bakeries', 'nightlife'];
const ESSENTIALS_CATEGORIES: ExploreCategoryId[] = [
  'pharmacy',
  'atm',
  'medical',
  'restroom',
  'fuel',
  'transport',
  'groceries',
  'shopping',
  'markets'
];
const ATTRACTION_CATEGORIES: ExploreCategoryId[] = ['sights', 'parks', 'museums', 'viewpoints'];

function isDiningCategory(id: ExploreCategoryId): boolean {
  return DINING_CATEGORIES.indexOf(id) >= 0;
}

function isEssentialsCategory(id: ExploreCategoryId): boolean {
  return ESSENTIALS_CATEGORIES.indexOf(id) >= 0;
}

function isAttractionCategory(id: ExploreCategoryId): boolean {
  return ATTRACTION_CATEGORIES.indexOf(id) >= 0;
}

function toCardsFromDining(items: DiningSuggestionRow[], categoryLabel: string): ExploreCard[] {
  return items.map((p, i) => ({
    id: p.id,
    name: p.name,
    note: p.description || p.bestFor,
    address: p.address,
    rating: p.rating,
    priceLevel: p.priceLevel,
    mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name, p.address),
    websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name, p.address),
    reviewsUrl: p.reviewsUrl,
    aiBlurb: p.why || p.bestFor,
    topPick: i === 0,
    categoryLabel,
    tags: [p.bestFor, p.priceLevel].filter(Boolean).slice(0, 3) as string[],
    walkHint: p.description,
    distanceRaw: p.description
  }));
}

function toCardsFromNearest(places: NearestPlaceRow[], categoryLabel: string): ExploreCard[] {
  return places.map((p, i) => ({
    id: p.id,
    name: p.name,
    note: p.note || p.servicesSummary,
    address: p.address,
    mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name, p.address),
    websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name, p.address),
    reviewsUrl: p.reviewsUrl,
    aiBlurb: p.servicesSummary || p.note,
    topPick: i === 0,
    categoryLabel,
    tags: (p.servicesSummary || '')
      .split(/[,;·|/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3),
    walkHint: p.note,
    distanceRaw: p.note
  }));
}

function IconBed(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 14h18M7 10V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function cacheToolKey(category: ExploreCategoryId): string {
  return `explore:${category}`;
}

export const MobileExplorePlacesView: React.FC<MobileExplorePlacesViewProps> = ({
  place,
  locationEntryId,
  locationLabel,
  startingPointLabel,
  overrideCoords,
  searchAnchorLabel,
  initialCategory,
  practicalTipsHtml,
  onBack,
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  savedStarts,
  onSelectSavedStart,
  activeStart,
  onAppendToNotes,
  onSavePlace
}) => {
  const { config } = useConfig();
  const shortPlace = placeNameFromTitle(place?.title || '') || locationLabel.split(',')[0] || 'this place';
  const [category, setCategory] = React.useState<ExploreCategoryId>(() => normalizeExploreCategory(initialCategory));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fromCache, setFromCache] = React.useState(false);
  const [results, setResults] = React.useState<ExploreCard[]>([]);
  const [visibleCount, setVisibleCount] = React.useState(6);
  const [toast, setToast] = React.useState('');
  const [mapOpen, setMapOpen] = React.useState(false);

  React.useEffect(() => {
    setCategory(normalizeExploreCategory(initialCategory));
  }, [initialCategory]);

  const [sortBy, setSortBy] = React.useState('Distance');
  const [distanceKm, setDistanceKm] = React.useState(2);
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [priceFilter, setPriceFilter] = React.useState<string | null>(null);
  const [openNow, setOpenNow] = React.useState(false);
  const [cuisine, setCuisine] = React.useState('');
  const [filterWifi, setFilterWifi] = React.useState(false);
  const [filterOutdoor, setFilterOutdoor] = React.useState(false);
  const [filterReservations, setFilterReservations] = React.useState(false);

  const catDef = exploreCategoryById(category);
  const stayName = (startingPointLabel || '').trim() || shortPlace;
  const showDiningFilters = isDiningCategory(category);
  const showEssentialsExtras = isEssentialsCategory(category);
  const showAttractionExtras = isAttractionCategory(category);
  const overrideLat = overrideCoords?.lat;
  const overrideLng = overrideCoords?.lng;
  const coordsKey =
    overrideLat != null && overrideLng != null
      ? `${overrideLat.toFixed(4)},${overrideLng.toFixed(4)}`
      : 'default';
  const anchorLabel = (searchAnchorLabel || startingPointLabel || '').trim() || undefined;
  const mapCentre =
    overrideLat != null && overrideLng != null
      ? { lat: overrideLat, lng: overrideLng, label: stayName }
      : place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
        ? { lat: place.latitude, lng: place.longitude, label: stayName }
        : undefined;

  const clearFilters = (): void => {
    setSortBy('Distance');
    setDistanceKm(2);
    setMinRating(null);
    setPriceFilter(null);
    setOpenNow(false);
    setCuisine('');
    setFilterWifi(false);
    setFilterOutdoor(false);
    setFilterReservations(false);
  };

  const load = React.useCallback(
    async (forceRefresh = false): Promise<void> => {
      const apiKey = (config.geminiApiKey || '').trim();
      if (!apiKey) {
        setError('Add a Gemini API key in Profile / User settings.');
        setResults([]);
        return;
      }
      const coords =
        overrideLat != null && overrideLng != null ? { lat: overrideLat, lng: overrideLng } : undefined;
      const cacheScope = nearYouScopeForLocation(locationEntryId, coords);
      const toolKey = cacheToolKey(category);
      const focus = exploreCategoryDiningFocus(category);
      const nearestKind = exploreCategoryNearestKind(category);
      const useCache = Boolean(focus || nearestKind || exploreCategoryToNearTool(category));

      if (!forceRefresh && useCache) {
        const cached = loadNearYouCache(cacheScope, toolKey);
        if (cached?.results?.length) {
          setResults(
            cached.results.map((r, i) => ({
              ...r,
              categoryLabel: catDef.label,
              tags: [r.priceLevel, r.note].filter(Boolean).slice(0, 3) as string[],
              walkHint: r.note,
              distanceRaw: r.note,
              topPick: i === 0
            }))
          );
          setFromCache(true);
          setError('');
          return;
        }
      }

      setBusy(true);
      setError('');
      setFromCache(false);
      setResults([]);
      try {
        if (!place) {
          setError('Could not resolve a search location for this place.');
          return;
        }
        const searchContext = await resolveLocationSearchContext(place, {
          onSiteKm: MOBILE_NEAR_YOU_ON_SITE_KM,
          forceTripPlace: true,
          overrideCoords: coords,
          searchAnchorLabel: anchorLabel
        });
        if (!searchContext) {
          setError('Could not resolve a search location for this place.');
          return;
        }

        let cards: ExploreCard[] = [];
        const diningFocus = exploreCategoryDiningFocus(category);
        if (diningFocus) {
          const { items } = await generateDiningSuggestions({
            apiKey,
            searchContext,
            venueFocus: diningFocus
          });
          cards = toCardsFromDining(items, catDef.label);
        } else if (nearestKind) {
          const { places } = await generateNearestPlaces(nearestKind, { apiKey, searchContext });
          cards = toCardsFromNearest(places, catDef.label);
        } else {
          setError(`No AI search configured for ${catDef.label}.`);
          return;
        }
        setResults(cards);
        setVisibleCount(6);
        if (useCache) {
          saveNearYouCache(cacheScope, toolKey, {
            results: cards,
            fetchedAt: new Date().toISOString(),
            contextLabel: `Near ${stayName}`
          });
        }
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Could not find nearby places.');
      } finally {
        setBusy(false);
      }
    },
    [
      anchorLabel,
      catDef.label,
      category,
      config.geminiApiKey,
      locationEntryId,
      overrideLat,
      overrideLng,
      place,
      stayName
    ]
  );

  React.useEffect(() => {
    void load(false);
  }, [load, coordsKey, category]);

  const filtered = React.useMemo(() => {
    let rows = results.slice();
    if (minRating != null) {
      rows = rows.filter((r) => typeof r.rating === 'number' && r.rating >= minRating);
    }
    if (priceFilter) {
      rows = rows.filter((r) => (r.priceLevel || '').includes(priceFilter));
    }
    if (cuisine) {
      const q = cuisine.toLowerCase();
      rows = rows.filter((r) =>
        [r.aiBlurb, r.note, r.categoryLabel, ...(r.tags || [])].join(' ').toLowerCase().includes(q)
      );
    }
    rows = rows.filter((r) => {
      const km = parseDistanceKm(r.distanceRaw || r.note || r.walkHint);
      if (km == null) return true;
      return km <= distanceKm;
    });
    rows = rows.slice().sort((a, b) => {
      if (sortBy === 'Name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'Rating') {
        const ra = typeof a.rating === 'number' ? a.rating : -1;
        const rb = typeof b.rating === 'number' ? b.rating : -1;
        if (rb !== ra) return rb - ra;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      const da = parseDistanceKm(a.distanceRaw || a.note);
      const db = parseDistanceKm(b.distanceRaw || b.note);
      if (da != null && db != null) return da - db;
      if (da != null) return -1;
      if (db != null) return 1;
      return Number(b.topPick) - Number(a.topPick);
    });
    return rows;
  }, [results, minRating, priceFilter, cuisine, distanceKm, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const saveToolId = exploreCategoryToNearTool(category) ?? 'dining';

  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className={styles.page}>
      <MobileSubpageHeader
        title={`Explore ${shortPlace}`}
        subtitle="Discover places near your accommodation or anywhere in the city."
        onBack={onBack}
      />

      <MobileExploreCategoryPills
        category={category}
        onChange={(id) => {
          if (id !== 'all') setCategory(id);
        }}
      />

      <div className={styles.startBanner}>
        <span className={styles.startIcon} aria-hidden>
          <IconBed />
        </span>
        <div className={styles.startBody}>
          <p className={styles.startText}>
            Showing places near <strong>{stayName}</strong>
          </p>
          <MobileStartPointActions
            onChangeStartingPoint={onChangeStartingPoint}
            onResetStartingPoint={onResetStartingPoint}
            onUndoStartingPoint={onUndoStartingPoint}
            canUndoStartingPoint={canUndoStartingPoint}
            isCustomStartingPoint={isCustomStartingPoint}
            accommodationLabel={accommodationLabel}
            savedStarts={savedStarts}
            onSelectSavedStart={onSelectSavedStart}
            activeStart={activeStart}
            changeClassName={styles.startLink}
            mutedClassName={styles.startMuted}
            actionsClassName={styles.startActions}
            undoClassName={styles.startUndo}
          />
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.filters} aria-label="Filters">
          <div className={styles.filterHead}>
            <h2 className={styles.filterTitle}>Filters</h2>
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>
              Clear all
            </button>
          </div>

          <label className={styles.filterBlock}>
            <span className={styles.filterLabel}>Sort</span>
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort"
            >
              <option>Distance</option>
              <option>Name</option>
              <option>Rating</option>
            </select>
          </label>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Distance</span>
            <p className={styles.filterHint}>Within {distanceKm.toFixed(1)} km</p>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className={styles.slider}
              aria-label="Distance"
            />
          </div>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Rating</span>
            <div className={styles.pillRow}>
              {[4, 4.5, 4.7].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.filterPill} ${minRating === r ? styles.filterPillOn : ''}`}
                  onClick={() => setMinRating((v) => (v === r ? null : r))}
                >
                  {r}+
                </button>
              ))}
            </div>
          </div>

          {showDiningFilters ? (
            <>
              <div className={styles.filterBlock}>
                <span className={styles.filterLabel}>Price</span>
                <div className={styles.pillRow}>
                  {['$', '$$', '$$$'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.filterPill} ${priceFilter === p ? styles.filterPillOn : ''}`}
                      onClick={() => setPriceFilter((v) => (v === p ? null : p))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <label className={styles.filterBlock}>
                <span className={styles.filterLabel}>Cuisine</span>
                <select
                  className={styles.select}
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  aria-label="Cuisine"
                >
                  <option value="">Any</option>
                  <option value="local">Local</option>
                  <option value="european">European</option>
                  <option value="asian">Asian</option>
                  <option value="seafood">Seafood</option>
                </select>
              </label>
            </>
          ) : null}

          {showDiningFilters || showEssentialsExtras || showAttractionExtras ? (
            <label className={styles.toggleRow}>
              <span>Open now</span>
              <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
            </label>
          ) : null}

          {showDiningFilters ? (
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>More filters</span>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={filterWifi} onChange={(e) => setFilterWifi(e.target.checked)} />
                Free Wi‑Fi
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={filterOutdoor} onChange={(e) => setFilterOutdoor(e.target.checked)} />
                Outdoor seating
              </label>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={filterReservations}
                  onChange={(e) => setFilterReservations(e.target.checked)}
                />
                Takes reservations
              </label>
            </div>
          ) : null}

          <button type="button" className={styles.saveSearch} disabled title="Coming soon">
            Save search
          </button>
        </aside>

        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.resultsCount}>
              {busy && !results.length ? 'Searching…' : `${filtered.length} places found`}
              {fromCache ? ' · cached' : ''}
            </p>
            <div className={styles.resultsHeadActions}>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={() => void load(true)}
                disabled={busy}
                aria-label="Refresh results"
                title="Refresh results (ignore cache)"
              >
                ↻
              </button>
              {mapCentre ? (
                <button type="button" className={styles.viewMap} onClick={() => setMapOpen(true)}>
                  View on map
                </button>
              ) : null}
            </div>
          </div>
          {fromCache ? (
            <p className={styles.cachedNote}>Showing cached results · tap ↻ to refresh</p>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.cardList}>
            {visible.map((r) => (
              <MobilePlaceDiscoverCard
                key={r.id}
                layout="list"
                startingPointLabel={stayName}
                cityFallback={shortPlace}
                card={{
                  id: r.id,
                  name: r.name,
                  categoryLabel: r.categoryLabel,
                  rating: r.rating,
                  description: r.aiBlurb,
                  distanceRaw: r.distanceRaw || r.note,
                  address: r.address,
                  mapsUrl: r.mapsUrl,
                  tags: r.tags,
                  city: shortPlace
                }}
                primaryAction={
                  onSavePlace
                    ? {
                        label: 'Save',
                        kind: 'save',
                        onClick: () => {
                          const saved = onSavePlace({
                            name: r.name,
                            note: r.distanceRaw || r.note,
                            mapsUrl: r.mapsUrl,
                            websiteUrl: r.websiteUrl,
                            toolId: saveToolId,
                            address: r.address,
                            why: r.aiBlurb,
                            bestFor: r.categoryLabel,
                            rating: r.rating,
                            priceLevel: r.priceLevel,
                            servicesSummary: r.aiBlurb
                          });
                          if (saved !== false) showToast(`Saved · ${r.name}`);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {visibleCount < filtered.length ? (
            <button type="button" className={styles.loadMore} onClick={() => setVisibleCount((n) => n + 6)}>
              Load more
            </button>
          ) : null}

          <p className={styles.disclaimer}>
            Place suggestions are AI-generated and may be incomplete or outdated. Always verify opening hours,
            prices, and directions before you go.
          </p>
        </div>
      </div>

      <MobileLocationTravelTip
        placeLabel={shortPlace}
        categoryLabel={catDef.label}
        startingPointLabel={stayName}
        onAppendToNotes={onAppendToNotes}
      />

      {mapOpen && mapCentre ? (
        <MobileResultsMapSheet
          title={`${catDef.label} near ${shortPlace}`}
          centre={mapCentre}
          locality={shortPlace}
          places={filtered.map((r) => ({
            id: r.id,
            name: r.name,
            address: r.address,
            mapsUrl: r.mapsUrl
          }))}
          onClose={() => setMapOpen(false)}
        />
      ) : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
};
