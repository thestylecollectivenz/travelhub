import * as React from 'react';
import type { Place } from '../../models/Place';
import type {
  DiningSuggestionRow,
  LocationInfoNotes,
  NearestPlaceKind,
  NearestPlaceRow
} from '../../utils/locationInfoEntry';
import { placeQueryDirectionsUrl, placeQueryMapsUrl } from '../../utils/googleMapsLink';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import { explorePlacePhotoUrl } from '../../utils/explorePlacePhoto';
import type { SavedPlacesCategoryId } from '../../utils/exploreCategories';
import styles from './MobileSavedPlacesView.module.css';

export interface MobileSavedPlacesViewProps {
  place: Place | undefined;
  locationLabel: string;
  data: LocationInfoNotes;
  initialCategory?: string;
  startingPointLabel?: string;
  onBack: () => void;
  onChangeStartingPoint?: () => void;
}

type SavedCard = {
  id: string;
  name: string;
  category: SavedPlacesCategoryId;
  categoryLabel: string;
  rating?: number;
  description?: string;
  distance?: string;
  address?: string;
  mapsUrl?: string;
  tags: string[];
};

const ESSENTIAL_KINDS: NearestPlaceKind[] = ['pharmacy', 'atm', 'medical', 'restroom', 'fuel', 'transport'];

function normalizeSavedCategory(raw?: string): SavedPlacesCategoryId {
  const k = (raw || '').trim().toLowerCase();
  if (k === 'dining' || k === 'restaurants' || k === 'food') return 'dining';
  if (k === 'sights' || k === 'sight') return 'sights';
  if (k === 'shopping' || k === 'grocery' || k === 'groceries') return 'shopping';
  if (k === 'essentials' || k === 'essential') return 'essentials';
  return 'all';
}

function kindCategory(kind: NearestPlaceKind): SavedPlacesCategoryId {
  if (kind === 'grocery') return 'shopping';
  if (ESSENTIAL_KINDS.includes(kind)) return 'essentials';
  return 'all';
}

function kindLabel(kind: NearestPlaceKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function flattenSaved(data: LocationInfoNotes): SavedCard[] {
  const out: SavedCard[] = [];
  (data.diningSuggestions ?? []).forEach((row: DiningSuggestionRow) => {
    out.push({
      id: `dining-${row.id}`,
      name: row.name,
      category: 'dining',
      categoryLabel: row.bestFor || 'Dining',
      rating: row.rating,
      description: row.description || row.why,
      distance: row.description,
      mapsUrl: row.mapsUrl,
      tags: [row.bestFor, row.priceLevel].filter(Boolean) as string[]
    });
  });
  const nearest = data.nearestPlaces ?? {};
  (Object.keys(nearest) as NearestPlaceKind[]).forEach((kind) => {
    (nearest[kind] ?? []).forEach((row: NearestPlaceRow) => {
      const category = kindCategory(kind);
      out.push({
        id: `${kind}-${row.id}`,
        name: row.name,
        category,
        categoryLabel: kindLabel(kind),
        description: row.servicesSummary || row.note,
        distance: row.note,
        address: row.address,
        mapsUrl: row.mapsUrl,
        tags: (row.servicesSummary || '')
          .split(/[,;·]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3)
      });
    });
  });
  return out;
}

function IconBed(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 14h18M7 10V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const CATEGORY_PILLS: Array<{ id: SavedPlacesCategoryId; label: string }> = [
  { id: 'all', label: 'All saved' },
  { id: 'dining', label: 'Dining' },
  { id: 'sights', label: 'Sights' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'essentials', label: 'Essentials' }
];

export const MobileSavedPlacesView: React.FC<MobileSavedPlacesViewProps> = ({
  place,
  locationLabel,
  data,
  initialCategory,
  startingPointLabel,
  onBack,
  onChangeStartingPoint
}) => {
  const shortPlace = placeNameFromTitle(place?.title || '') || locationLabel.split(',')[0] || 'this place';
  const stayName = (startingPointLabel || '').trim() || shortPlace;
  const mapsUrl = placeQueryMapsUrl(place?.title || shortPlace, place?.country);
  const [category, setCategory] = React.useState<SavedPlacesCategoryId>(() =>
    normalizeSavedCategory(initialCategory)
  );
  const [visibleCount, setVisibleCount] = React.useState(8);
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [priceFilter, setPriceFilter] = React.useState<string | null>(null);
  const [distanceKm, setDistanceKm] = React.useState(2);
  const [openNow, setOpenNow] = React.useState(false);

  const allCards = React.useMemo(() => flattenSaved(data), [data]);
  const filtered = React.useMemo(() => {
    let rows = allCards;
    if (category !== 'all') rows = rows.filter((c) => c.category === category);
    if (minRating != null) rows = rows.filter((c) => typeof c.rating === 'number' && c.rating >= minRating);
    if (priceFilter) {
      rows = rows.filter((c) => c.tags.some((t) => t.includes(priceFilter)));
    }
    return rows;
  }, [allCards, category, minRating, priceFilter]);

  const visible = filtered.slice(0, visibleCount);

  const clearFilters = (): void => {
    setMinRating(null);
    setPriceFilter(null);
    setDistanceKm(2);
    setOpenNow(false);
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
          <h1 className={styles.title}>Saved places in {shortPlace}</h1>
          <p className={styles.sub}>
            Places you&apos;ve saved for {shortPlace}. Use GPS when you&apos;re there for live directions.
          </p>
          {mapsUrl ? (
            <a className={styles.mapLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Map view ›
            </a>
          ) : null}
        </div>
      </header>

      <div className={styles.catPills} role="list">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            role="listitem"
            className={`${styles.catPill} ${category === pill.id ? styles.catPillOn : ''}`}
            onClick={() => {
              setCategory(pill.id);
              setVisibleCount(8);
            }}
          >
            {pill.label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.catPill} ${styles.catPillDisabled}`}
          disabled
          title="Collections coming soon"
        >
          + New collection
        </button>
      </div>

      <div className={styles.startBanner}>
        <span className={styles.startIcon} aria-hidden>
          <IconBed />
        </span>
        <div>
          <p className={styles.startText}>
            Showing places near <strong>{stayName}</strong>
          </p>
          {onChangeStartingPoint ? (
            <button type="button" className={styles.startLink} onClick={onChangeStartingPoint}>
              Change starting point
            </button>
          ) : (
            <span className={styles.startMuted}>Change starting point</span>
          )}
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

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Sort</span>
            <select className={styles.select} value="Recently saved" disabled aria-label="Sort">
              <option>Recently saved</option>
              <option>Distance</option>
            </select>
          </div>

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
        </aside>

        <div className={styles.results}>
          <div className={styles.resultsHead}>
            <p className={styles.resultsCount}>{filtered.length} saved places</p>
            {mapsUrl ? (
              <a className={styles.viewMap} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                View on map
              </a>
            ) : null}
          </div>

          {!filtered.length ? (
            <p className={styles.empty}>No saved places in this category yet. Explore and tap Bookmark to save.</p>
          ) : null}

          <div className={styles.cardList}>
            {visible.map((r) => {
              const directions = placeQueryDirectionsUrl(r.name, r.address) || r.mapsUrl;
              const photo = explorePlacePhotoUrl(r.name, shortPlace);
              return (
                <article key={r.id} className={styles.card}>
                  <div className={styles.cardPhoto} style={{ backgroundImage: `url(${photo})` }} aria-hidden />
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>{r.name}</h3>
                      {typeof r.rating === 'number' ? (
                        <span className={styles.rating}>★ {r.rating.toFixed(1)}</span>
                      ) : null}
                    </div>
                    <div className={styles.badgeRow}>
                      <span className={styles.savedBadge}>Saved</span>
                      <span className={styles.cardTag}>{r.categoryLabel}</span>
                      <span className={styles.addedNote}>Added</span>
                    </div>
                    {r.description ? <p className={styles.cardDesc}>{r.description}</p> : null}
                    <p className={styles.cardDist}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                      {r.distance || r.address || `Near ${stayName}`}
                    </p>
                    {r.tags.length ? (
                      <div className={styles.tagRow}>
                        {r.tags.slice(0, 3).map((t) => (
                          <span key={t} className={styles.miniTag}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.cardActions}>
                      <span className={styles.actionBtnMuted}>Bookmark</span>
                      {directions ? (
                        <a
                          className={`${styles.actionBtn} ${styles.actionPrimary}`}
                          href={directions}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Directions
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
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
    </div>
  );
};
