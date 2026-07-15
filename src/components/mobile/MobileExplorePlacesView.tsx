import * as React from 'react';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import type { DiningSuggestionRow, NearestPlaceRow } from '../../utils/locationInfoEntry';
import { MOBILE_NEAR_YOU_ON_SITE_KM, resolveLocationSearchContext } from '../../utils/locationGeoContext';
import { placeQueryMapsUrl, placeWebsiteSearchUrl } from '../../utils/googleMapsLink';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import {
  exploreCategoriesSorted,
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
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import type { NearYouToolId } from '../../utils/nearYouTools';
import { MobileStartPointActions } from './MobileStartPointActions';
import { MobilePlaceDiscoverCard } from './MobilePlaceDiscoverCard';
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
  onBack: () => void;
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
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
      .split(/[,;·]/)
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

function CategoryGlyph({ id }: { id: ExploreCategoryId }): React.ReactElement {
  const tool = exploreCategoryToNearTool(id);
  if (tool) return <NearYouToolIcon toolId={tool} size="sm" />;
  return (
    <span className={styles.sightsGlyph} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 18 8 8l4 6 3-4 5 8H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function cacheToolKey(category: ExploreCategoryId): NearYouToolId {
  return exploreCategoryToNearTool(category) ?? 'dining';
}

export const MobileExplorePlacesView: React.FC<MobileExplorePlacesViewProps> = ({
  place,
  locationEntryId,
  locationLabel,
  startingPointLabel,
  overrideCoords,
  searchAnchorLabel,
  initialCategory,
  onBack,
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
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
  const [moreOpen, setMoreOpen] = React.useState(false);

  const [sortBy] = React.useState('Distance');
  const [distanceKm, setDistanceKm] = React.useState(2);
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [priceFilter, setPriceFilter] = React.useState<string | null>(null);
  const [openNow, setOpenNow] = React.useState(false);
  const [cuisine, setCuisine] = React.useState('');
  const [filterWifi, setFilterWifi] = React.useState(false);
  const [filterOutdoor, setFilterOutdoor] = React.useState(false);
  const [filterReservations, setFilterReservations] = React.useState(false);

  const catDef = exploreCategoryById(category);
  const sortedCats = React.useMemo(() => exploreCategoriesSorted(), []);
  const primaryCats = sortedCats.slice(0, 6);
  const moreCats = sortedCats.slice(6);
  const stayName = (startingPointLabel || '').trim() || shortPlace;
  const mapsUrl = placeQueryMapsUrl(place?.title || shortPlace, place?.country);
  const overrideLat = overrideCoords?.lat;
  const overrideLng = overrideCoords?.lng;
  const coordsKey =
    overrideLat != null && overrideLng != null
      ? `${overrideLat.toFixed(4)},${overrideLng.toFixed(4)}`
      : 'default';
  const anchorLabel = (searchAnchorLabel || startingPointLabel || '').trim() || undefined;

  const clearFilters = (): void => {
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
      const useCache =
        focus !== 'attractions' &&
        Boolean(exploreCategoryToNearTool(category) || exploreCategoryNearestKind(category));

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
        const nearestKind = exploreCategoryNearestKind(category);
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
    rows = rows.filter((r) => {
      const km = parseDistanceKm(r.distanceRaw || r.note || r.walkHint);
      if (km == null) return true;
      return km <= distanceKm;
    });
    rows = rows.slice().sort((a, b) => {
      const da = parseDistanceKm(a.distanceRaw || a.note);
      const db = parseDistanceKm(b.distanceRaw || b.note);
      if (da != null && db != null) return da - db;
      if (da != null) return -1;
      if (db != null) return 1;
      return Number(b.topPick) - Number(a.topPick);
    });
    return rows;
  }, [results, minRating, priceFilter, distanceKm]);

  const visible = filtered.slice(0, visibleCount);
  const saveToolId = exploreCategoryToNearTool(category) ?? 'dining';

  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={styles.topMain}>
          <h1 className={styles.title}>Explore {shortPlace}</h1>
          <p className={styles.sub}>Discover places near your accommodation or anywhere in the city.</p>
          {mapsUrl ? (
            <a className={styles.mapLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Map view ›
            </a>
          ) : null}
        </div>
      </header>

      <div className={styles.catPills} role="list">
        {primaryCats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="listitem"
            className={`${styles.catPill} ${category === cat.id ? styles.catPillOn : ''}`}
            style={{ '--cat-accent': cat.accent, '--cat-bg': cat.bg } as React.CSSProperties}
            onClick={() => setCategory(cat.id)}
          >
            <span className={styles.catPillIcon}>
              <CategoryGlyph id={cat.id} />
            </span>
            {cat.label}
          </button>
        ))}
        <div className={styles.moreWrap}>
          <button type="button" className={styles.catPill} onClick={() => setMoreOpen((v) => !v)}>
            More
          </button>
          {moreOpen ? (
            <div className={styles.moreMenu} role="menu">
              {moreCats.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    setCategory(cat.id);
                  }}
                >
                  <CategoryGlyph id={cat.id} />
                  {cat.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

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
            <select className={styles.select} value={sortBy} disabled aria-label="Sort">
              <option>Distance</option>
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

          <label className={styles.toggleRow}>
            <span>Open now</span>
            <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
          </label>

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
            {mapsUrl ? (
              <a className={styles.viewMap} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                View on map
              </a>
            ) : null}
          </div>

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
                        label: 'Bookmark',
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

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
};
