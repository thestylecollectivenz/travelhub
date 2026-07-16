import * as React from 'react';
import type { Place } from '../../models/Place';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type {
  DiningSuggestionRow,
  LocationInfoNotes,
  NearestPlaceKind,
  NearestPlaceRow
} from '../../utils/locationInfoEntry';
import {
  normalizeLocationInfoNotes,
  serializeLocationInfoNotes
} from '../../utils/locationInfoEntry';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import {
  EXPLORE_CATEGORIES,
  normalizeExploreCategory,
  savedRowToExploreCategory,
  type ExploreCategoryId,
  type SavedPlacesCategoryId
} from '../../utils/exploreCategories';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { parseDistanceKm } from '../../utils/locationDistanceLabel';
import type { StoredStartPoint } from '../../utils/locationStartPointStorage';
import { MobileStartPointBanner } from './MobileStartPointBanner';
import { MobilePlaceDiscoverCard } from './MobilePlaceDiscoverCard';
import { MobileSubpageHeader } from './MobileSubpageHeader';
import { MobileExploreCategoryPills } from './MobileExploreCategoryPills';
import { MobileResultsMapSheet } from './MobileResultsMapSheet';
import { MobileLocationTravelTip } from './MobileLocationTravelTip';
import styles from './MobileSavedPlacesView.module.css';

export interface MobileSavedPlacesViewProps {
  place: Place | undefined;
  locationLabel: string;
  data: LocationInfoNotes;
  entry?: ItineraryEntry;
  initialCategory?: string;
  startingPointLabel?: string;
  overrideCoords?: { lat: number; lng: number };
  onBack: () => void;
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
  savedStarts?: StoredStartPoint[];
  onSelectSavedStart?: (point: StoredStartPoint) => void;
  onRemoveSavedStart?: (point: StoredStartPoint) => void;
  activeStart?: StoredStartPoint | null;
  accommodationStart?: StoredStartPoint | null;
  onSaveTip?: (tipText: string) => void;
  savedTips?: string[];
}

type SavedCard = {
  id: string;
  rowId: string;
  source: 'dining' | 'nearest';
  nearestKind?: NearestPlaceKind;
  name: string;
  category: ExploreCategoryId;
  categoryLabel: string;
  rating?: number;
  description?: string;
  distance?: string;
  address?: string;
  mapsUrl?: string;
  tags: string[];
  nearLabel?: string;
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

const KNOWN_CATEGORY_ALIASES = new Set(
  [
    ...EXPLORE_CATEGORIES.map((c) => c.id),
    'dining',
    'restaurant',
    'food',
    'cafe',
    'cafés',
    'bakery',
    'bars',
    'night',
    'shop',
    'sight',
    'attractions',
    'park',
    'museum',
    'market',
    'viewpoint',
    'views',
    'grocery',
    'restrooms'
  ].map((s) => s.toLowerCase())
);

function isDiningCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && DINING_CATEGORIES.indexOf(id) >= 0;
}

function isEssentialsCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && ESSENTIALS_CATEGORIES.indexOf(id) >= 0;
}

function isAttractionCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && ATTRACTION_CATEGORIES.indexOf(id) >= 0;
}

/** Map free-form initial category; unknown / all / essentials → all; dining → restaurants. */
function normalizeInitialSavedCategory(raw?: string): SavedPlacesCategoryId {
  const k = (raw || '').trim().toLowerCase();
  if (!k || k === 'all' || k === 'unknown' || k === 'essentials' || k === 'essential') return 'all';
  if (!KNOWN_CATEGORY_ALIASES.has(k)) return 'all';
  return normalizeExploreCategory(k);
}

function kindLabel(kind: NearestPlaceKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function flattenSaved(data: LocationInfoNotes): SavedCard[] {
  const out: SavedCard[] = [];
  (data.diningSuggestions ?? []).forEach((row: DiningSuggestionRow) => {
    const category = savedRowToExploreCategory({
      source: 'dining',
      categoryLabel: row.bestFor || 'Dining'
    });
    out.push({
      id: `dining-${row.id}`,
      rowId: row.id,
      source: 'dining',
      name: row.name,
      category,
      categoryLabel: row.bestFor || 'Dining',
      rating: row.rating,
      description: row.why || row.bestFor,
      distance: row.description,
      address: row.address,
      mapsUrl: row.mapsUrl,
      tags: [row.bestFor, row.priceLevel].filter(Boolean) as string[],
      nearLabel: row.nearLabel
    });
  });
  const nearest = data.nearestPlaces ?? {};
  (Object.keys(nearest) as NearestPlaceKind[]).forEach((kind) => {
    (nearest[kind] ?? []).forEach((row: NearestPlaceRow) => {
      const category = savedRowToExploreCategory({
        source: 'nearest',
        nearestKind: kind,
        categoryLabel: kindLabel(kind)
      });
      out.push({
        id: `${kind}-${row.id}`,
        rowId: row.id,
        source: 'nearest',
        nearestKind: kind,
        name: row.name,
        category,
        categoryLabel: kindLabel(kind),
        description: row.servicesSummary,
        distance: row.note,
        address: row.address,
        mapsUrl: row.mapsUrl,
        tags: (row.servicesSummary || '')
          .split(/[,;·|/]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3),
        nearLabel: row.nearLabel
      });
    });
  });
  return out;
}

export const MobileSavedPlacesView: React.FC<MobileSavedPlacesViewProps> = ({
  place,
  locationLabel,
  data,
  entry,
  initialCategory,
  startingPointLabel,
  overrideCoords,
  onBack,
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  savedStarts,
  onSelectSavedStart,
  onRemoveSavedStart,
  activeStart,
  accommodationStart,
  onSaveTip
}) => {
  const { updateEntry } = useTripWorkspace();
  const shortPlace = placeNameFromTitle(place?.title || '') || locationLabel.split(',')[0] || 'this place';
  const stayName = (startingPointLabel || '').trim() || shortPlace;
  const defaultNearLabel = `Saved for ${shortPlace}`;

  const unsaveCard = (card: SavedCard): void => {
    if (!entry) return;
    if (card.source === 'dining') {
      const next = normalizeLocationInfoNotes({
        ...data,
        diningSuggestions: (data.diningSuggestions ?? []).filter((x) => x.id !== card.rowId)
      });
      updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
      return;
    }
    if (!card.nearestKind) return;
    const nearest = { ...(data.nearestPlaces ?? {}) };
    nearest[card.nearestKind] = (nearest[card.nearestKind] ?? []).filter((x) => x.id !== card.rowId);
    const next = normalizeLocationInfoNotes({ ...data, nearestPlaces: nearest });
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
  };

  const [category, setCategory] = React.useState<SavedPlacesCategoryId>(() =>
    normalizeInitialSavedCategory(initialCategory)
  );
  const [visibleCount, setVisibleCount] = React.useState(8);
  const [sortBy, setSortBy] = React.useState('Recently saved');
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [priceFilter, setPriceFilter] = React.useState<string | null>(null);
  const [distanceKm, setDistanceKm] = React.useState(2);
  const [openNow, setOpenNow] = React.useState(false);
  const [cuisine, setCuisine] = React.useState('');
  const [filterWifi, setFilterWifi] = React.useState(false);
  const [filterOutdoor, setFilterOutdoor] = React.useState(false);
  const [filterReservations, setFilterReservations] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [startFilter, setStartFilter] = React.useState<string>('all');

  React.useEffect(() => {
    setCategory(normalizeInitialSavedCategory(initialCategory));
  }, [initialCategory]);

  const showDiningFilters = isDiningCategory(category);
  const showEssentialsExtras = isEssentialsCategory(category);
  const showAttractionExtras = isAttractionCategory(category);
  const showOpenNow =
    category === 'all' || showDiningFilters || showEssentialsExtras || showAttractionExtras;

  const overrideLat = overrideCoords?.lat;
  const overrideLng = overrideCoords?.lng;
  const mapCentre =
    overrideLat != null &&
    overrideLng != null &&
    Number.isFinite(overrideLat) &&
    Number.isFinite(overrideLng)
      ? { lat: overrideLat, lng: overrideLng, label: stayName }
      : place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
        ? { lat: place.latitude, lng: place.longitude, label: stayName }
        : undefined;

  const allCards = React.useMemo(() => flattenSaved(data), [data]);
  const startOptions = React.useMemo(() => {
    const labels = new Set<string>();
    for (const c of allCards) {
      labels.add((c.nearLabel || '').trim() || defaultNearLabel);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allCards, defaultNearLabel]);

  const filtered = React.useMemo(() => {
    let rows = allCards;
    if (category !== 'all') rows = rows.filter((c) => c.category === category);
    if (startFilter !== 'all') {
      rows = rows.filter((c) => ((c.nearLabel || '').trim() || defaultNearLabel) === startFilter);
    }
    if (minRating != null) rows = rows.filter((c) => typeof c.rating === 'number' && c.rating >= minRating);
    if (priceFilter) {
      rows = rows.filter((c) => c.tags.some((t) => t.includes(priceFilter)));
    }
    if (cuisine) {
      const q = cuisine.toLowerCase();
      rows = rows.filter((c) =>
        [c.description, c.categoryLabel, ...(c.tags || [])].join(' ').toLowerCase().includes(q)
      );
    }
    rows = rows.filter((c) => {
      const km = parseDistanceKm(c.distance);
      if (km == null) return true;
      return km <= distanceKm;
    });
    rows = rows.slice().sort((a, b) => {
      if (sortBy === 'Name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'Distance') {
        const da = parseDistanceKm(a.distance);
        const db = parseDistanceKm(b.distance);
        if (da != null && db != null) return da - db;
        if (da != null) return -1;
        if (db != null) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      // Recently saved — keep flatten order
      return 0;
    });
    return rows;
  }, [allCards, category, startFilter, defaultNearLabel, minRating, priceFilter, cuisine, distanceKm, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  const clearFilters = (): void => {
    setSortBy('Recently saved');
    setMinRating(null);
    setPriceFilter(null);
    setDistanceKm(2);
    setOpenNow(false);
    setCuisine('');
    setFilterWifi(false);
    setFilterOutdoor(false);
    setFilterReservations(false);
  };

  return (
    <div className={styles.page}>
      <MobileSubpageHeader
        title={`Saved places in ${shortPlace}`}
        subtitle={`Places you've saved for ${shortPlace}. Use GPS when you're there for live directions.`}
        onBack={onBack}
      />

      <MobileExploreCategoryPills
        includeAll
        category={category}
        onChange={(id) => {
          setCategory(id);
          setVisibleCount(8);
        }}
      />

      {startOptions.length > 1 ? (
        <div className={styles.startFilterRow} role="list" aria-label="Filter by starting point">
          <button
            type="button"
            role="listitem"
            className={`${styles.startFilterPill} ${startFilter === 'all' ? styles.startFilterPillOn : ''}`}
            onClick={() => setStartFilter('all')}
          >
            All starts
          </button>
          {startOptions.map((label) => (
            <button
              key={label}
              type="button"
              role="listitem"
              className={`${styles.startFilterPill} ${startFilter === label ? styles.startFilterPillOn : ''}`}
              onClick={() => setStartFilter(label)}
            >
              {label.replace(/^Saved for /i, '') || label}
            </button>
          ))}
        </div>
      ) : null}

      <MobileStartPointBanner
        nearLabel={stayName}
        accommodationLabel={accommodationLabel}
        accommodationStart={accommodationStart}
        savedStarts={savedStarts}
        activeStart={activeStart}
        onChangeStartingPoint={onChangeStartingPoint}
        onResetStartingPoint={onResetStartingPoint}
        onUndoStartingPoint={onUndoStartingPoint}
        canUndoStartingPoint={canUndoStartingPoint}
        isCustomStartingPoint={isCustomStartingPoint}
        onSelectSavedStart={onSelectSavedStart}
        onRemoveSavedStart={onRemoveSavedStart}
        showOtherStarts
      />

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
              <option>Recently saved</option>
              <option>Distance</option>
              <option>Name</option>
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

          {showOpenNow ? (
            <label className={styles.toggleRow}>
              <span>Open now</span>
              <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
            </label>
          ) : null}

          {showDiningFilters ? (
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>More filters</span>
              <label className={styles.toggleRow}>
                <input type="checkbox" checked={filterWifi} onChange={(e) => setFilterWifi(e.target.checked)} />
                Free Wi‑Fi
              </label>
              <label className={styles.toggleRow}>
                <input type="checkbox" checked={filterOutdoor} onChange={(e) => setFilterOutdoor(e.target.checked)} />
                Outdoor seating
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={filterReservations}
                  onChange={(e) => setFilterReservations(e.target.checked)}
                />
                Takes reservations
              </label>
            </div>
          ) : null}
        </aside>

        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.resultsCount}>{filtered.length} saved places</p>
            {mapCentre ? (
              <button type="button" className={styles.viewMap} onClick={() => setMapOpen(true)}>
                View on map
              </button>
            ) : null}
          </div>

          {!filtered.length ? (
            <p className={styles.empty}>No saved places in this category yet. Explore and tap Save to save.</p>
          ) : null}

          <div className={styles.cardList}>
            {visible.map((r) => (
              <MobilePlaceDiscoverCard
                key={r.id}
                layout="list"
                startingPointLabel={r.nearLabel || stayName}
                cityFallback={shortPlace}
                card={{
                  id: r.id,
                  name: r.name,
                  categoryLabel: r.categoryLabel,
                  rating: r.rating,
                  description: r.description,
                  distanceRaw: r.distance,
                  address: r.address,
                  mapsUrl: r.mapsUrl,
                  tags: r.tags,
                  city: shortPlace,
                  nearLabel: r.nearLabel
                }}
                primaryAction={
                  entry
                    ? {
                        label: 'Delete',
                        kind: 'delete',
                        onClick: () => unsaveCard(r)
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {visibleCount < filtered.length ? (
            <button type="button" className={styles.loadMore} onClick={() => setVisibleCount((n) => n + 8)}>
              Load more
            </button>
          ) : null}

          <p className={styles.disclaimer}>
            Distances are estimates from your trip starting point. Open Directions for live GPS routing when
            you&apos;re on site.
          </p>
        </div>
      </div>

      <MobileLocationTravelTip
        placeLabel={shortPlace}
        startingPointLabel={stayName}
        onSaveTip={onSaveTip}
        savedTips={data.savedTravelTips || []}
        showSavedList={false}
      />

      {mapOpen && mapCentre ? (
        <MobileResultsMapSheet
          title={`Saved in ${shortPlace}`}
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
    </div>
  );
};
