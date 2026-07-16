import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import {
  deleteTripSavedSpot,
  loadTripSavedSpots,
  SAVED_SPOTS_CHANGED_EVENT,
  type TripSavedSpot
} from '../../utils/tripSavedSpots';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import {
  exploreCategoryById,
  nearToolToExploreCategory,
  type ExploreCategoryId,
  type SavedPlacesCategoryId
} from '../../utils/exploreCategories';
import { MobileSubpageHeader } from './MobileSubpageHeader';
import { MobileExploreCategoryPills } from './MobileExploreCategoryPills';
import { MobilePlaceDiscoverCard } from './MobilePlaceDiscoverCard';
import styles from './MobileSavedPlacesView.module.css';

export interface MobileTripSavedPlacesViewProps {
  tripId?: string;
  onBack: () => void;
}

type SavedCard = {
  id: string;
  name: string;
  category: ExploreCategoryId;
  categoryLabel: string;
  note?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  tags: string[];
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

function isDiningCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && DINING_CATEGORIES.indexOf(id) >= 0;
}

function isEssentialsCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && ESSENTIALS_CATEGORIES.indexOf(id) >= 0;
}

function isAttractionCategory(id: ExploreCategoryId | 'all'): boolean {
  return id !== 'all' && ATTRACTION_CATEGORIES.indexOf(id) >= 0;
}

function toolLabel(toolId?: string): string {
  if (!toolId) return 'Saved';
  return NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.shortLabel || 'Saved';
}

function rowToCard(row: TripSavedSpot): SavedCard {
  const category = row.toolId
    ? nearToolToExploreCategory(row.toolId as Parameters<typeof nearToolToExploreCategory>[0])
    : 'restaurants';
  const catDef = exploreCategoryById(category);
  return {
    id: row.id,
    name: row.name,
    category,
    categoryLabel: toolLabel(row.toolId),
    note: row.note,
    mapsUrl: row.mapsUrl,
    websiteUrl: row.websiteUrl,
    tags: [toolLabel(row.toolId), row.savedByLabel || ''].filter(Boolean)
  };
}

export const MobileTripSavedPlacesView: React.FC<MobileTripSavedPlacesViewProps> = ({ tripId, onBack }) => {
  const spContext = useSpContext();
  const [rows, setRows] = React.useState<TripSavedSpot[]>([]);
  const [category, setCategory] = React.useState<SavedPlacesCategoryId>('all');
  const [visibleCount, setVisibleCount] = React.useState(8);
  const [sortBy, setSortBy] = React.useState('Recently saved');
  const [minRating, setMinRating] = React.useState<number | null>(null);

  const refresh = React.useCallback(() => {
    if (!tripId) {
      setRows([]);
      return;
    }
    void loadTripSavedSpots(spContext, tripId).then(setRows).catch(console.error);
  }, [spContext, tripId]);

  React.useEffect(() => {
    refresh();
    const handler = (): void => refresh();
    window.addEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SAVED_SPOTS_CHANGED_EVENT, handler);
  }, [refresh]);

  const allCards = React.useMemo(() => rows.map(rowToCard), [rows]);

  const filtered = React.useMemo(() => {
    let list = allCards;
    if (category !== 'all') list = list.filter((c) => c.category === category);
    if (minRating != null) list = list.filter(() => true);
    list = list.slice().sort((a, b) => {
      if (sortBy === 'Name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return 0;
    });
    return list;
  }, [allCards, category, minRating, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const showDiningFilters = isDiningCategory(category);
  const showEssentialsExtras = isEssentialsCategory(category);
  const showAttractionExtras = isAttractionCategory(category);
  const showOpenNow =
    category === 'all' || showDiningFilters || showEssentialsExtras || showAttractionExtras;

  const removeCard = (card: SavedCard): void => {
    void deleteTripSavedSpot(spContext, card.id).then(refresh);
  };

  return (
    <div className={styles.page}>
      <MobileSubpageHeader
        title="Saved near you"
        subtitle="Places saved from Near you using your current GPS. Open Directions when you are on site."
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

      <div className={styles.layout}>
        <aside className={styles.filters} aria-label="Filters">
          <div className={styles.filterHead}>
            <h2 className={styles.filterTitle}>Filters</h2>
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
              <option>Name</option>
            </select>
          </label>

          {showOpenNow ? (
            <label className={styles.toggleRow}>
              <span>Open now</span>
              <input type="checkbox" disabled aria-label="Open now filter unavailable for saved list" />
            </label>
          ) : null}
        </aside>

        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.resultsCount}>{filtered.length} saved places</p>
          </div>

          {!tripId ? (
            <p className={styles.empty}>Open a trip to see saved places from Near you.</p>
          ) : null}
          {tripId && !filtered.length ? (
            <p className={styles.empty}>No saved places yet. Explore Near you and tap Save.</p>
          ) : null}

          <div className={styles.cardList}>
            {visible.map((r) => (
              <MobilePlaceDiscoverCard
                key={r.id}
                layout="list"
                startingPointLabel="your current location"
                cityFallback="near you"
                card={{
                  id: r.id,
                  name: r.name,
                  categoryLabel: r.categoryLabel,
                  description: r.note,
                  mapsUrl: r.mapsUrl || r.websiteUrl,
                  tags: r.tags,
                  city: 'near you',
                  nearLabel: 'Saved near you'
                }}
                primaryAction={{
                  label: 'Remove',
                  kind: 'delete',
                  onClick: () => removeCard(r)
                }}
              />
            ))}
          </div>

          {visibleCount < filtered.length ? (
            <button type="button" className={styles.loadMore} onClick={() => setVisibleCount((n) => n + 8)}>
              Load more
            </button>
          ) : null}

          <p className={styles.disclaimer}>
            These places were saved while browsing Near you with GPS. Distances update when you open live directions on
            site.
          </p>
        </div>
      </div>
    </div>
  );
};
