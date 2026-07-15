import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  locationHighlightRows,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes,
  splitHighlightRows,
  type DiningSuggestionRow,
  type LocationHighlightKind,
  type LocationHighlightRow,
  type LocationInfoNotes,
  type NearestPlaceKind,
  type NearestPlaceRow
} from '../../utils/locationInfoEntry';
import { placeNameFromTitle } from '../../utils/placeDisplayLabel';
import { destinationHeroPhotoUrl } from '../../utils/explorePlacePhoto';
import {
  exploreCategoriesSorted,
  savedRowToExploreCategory,
  type ExploreCategoryId
} from '../../utils/exploreCategories';
import { RichTextContent } from '../shared/RichTextContent';
import { LocationInfoAskPanel } from '../itinerary/LocationInfoAskPanel';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { LocationHighlightIcon } from './LocationHighlightIcon';
import { MobilePencilButton } from './MobilePencilButton';
import { MobileStartPointActions } from './MobileStartPointActions';
import { MobilePlaceDiscoverCard } from './MobilePlaceDiscoverCard';
import { MobileLocationTravelTip } from './MobileLocationTravelTip';
import type { NearYouToolId } from '../../utils/nearYouTools';
import styles from './MobileLocationInfoContent.module.css';

const HIGHLIGHT_LABEL: Record<LocationHighlightKind, string> = {
  sight: 'Sights',
  food: 'Food',
  drink: 'Drink',
  souvenir: 'Souvenirs'
};

const DINING_CATS = new Set<ExploreCategoryId>(['restaurants', 'cafes', 'bakeries', 'nightlife']);
const SIGHTS_CATS = new Set<ExploreCategoryId>(['sights', 'parks', 'museums', 'viewpoints']);
const SHOPPING_CATS = new Set<ExploreCategoryId>(['shopping', 'groceries', 'markets']);
const ESSENTIAL_CATS = new Set<ExploreCategoryId>([
  'pharmacy',
  'atm',
  'medical',
  'restroom',
  'fuel',
  'transport'
]);

function escapeTipHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Append a travel tip as a new bullet under Notes (userNotes). */
export function appendTipBulletToUserNotes(existing: string | undefined, tip: string): string {
  const bullet = tip.trim();
  if (!bullet) return existing || '';
  const li = `<li>${escapeTipHtml(bullet)}</li>`;
  const raw = (existing || '').trim();
  if (!raw) return `<ul>${li}</ul>`;
  if (/<\/ul>/i.test(raw)) return raw.replace(/<\/ul>/i, `${li}</ul>`);
  return `${raw}<ul>${li}</ul>`;
}

function highlightKey(row: LocationHighlightRow): string {
  return `${row.kind}::${row.id}`;
}

function IconBed(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 14h18M7 10V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSparkle(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 13.8 9l5.7 1.2-4.4 3.9 1.3 5.7L12 16.8 7.6 19.8l1.3-5.7-4.4-3.9L10.2 9 12 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={open ? 'M6 14l6-6 6 6' : 'M6 10l6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoryGlyph({ id }: { id: ExploreCategoryId }): React.ReactElement {
  const toolMap: Partial<Record<ExploreCategoryId, NearYouToolId>> = {
    restaurants: 'dining',
    cafes: 'cafes',
    bakeries: 'cafes',
    nightlife: 'dining',
    shopping: 'grocery',
    groceries: 'grocery',
    markets: 'grocery',
    pharmacy: 'pharmacy',
    atm: 'atm',
    restroom: 'restroom',
    transport: 'transport',
    medical: 'medical',
    fuel: 'fuel'
  };
  const toolId = toolMap[id];
  if (toolId) return <NearYouToolIcon toolId={toolId} size="sm" />;
  return (
    <span className={styles.sightsGlyph} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 18 8 8l4 6 3-4 5 8H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type FeaturedCard = {
  id: string;
  source: 'dining' | 'nearest';
  nearestKind?: NearestPlaceKind;
  name: string;
  categoryLabel: string;
  exploreCategory: ExploreCategoryId;
  rating?: number;
  description?: string;
  distanceRaw?: string;
  address?: string;
  mapsUrl?: string;
  city?: string;
  nearLabel?: string;
};

function buildFeaturedCards(data: LocationInfoNotes, city: string): FeaturedCard[] {
  const dining = data.diningSuggestions ?? [];
  const fromDining: FeaturedCard[] = dining.map((row) => ({
    id: row.id,
    source: 'dining' as const,
    name: row.name,
    categoryLabel: row.bestFor || 'Dining',
    exploreCategory: savedRowToExploreCategory({
      source: 'dining',
      categoryLabel: row.bestFor || 'Dining'
    }),
    rating: row.rating,
    description: row.why || row.bestFor,
    distanceRaw: row.description,
    address: row.address,
    mapsUrl: row.mapsUrl,
    city,
    nearLabel: row.nearLabel
  }));

  const nearest = data.nearestPlaces ?? {};
  const extras: FeaturedCard[] = [];
  (Object.keys(nearest) as NearestPlaceKind[]).forEach((kind) => {
    (nearest[kind] ?? []).forEach((row: NearestPlaceRow) => {
      extras.push({
        id: row.id,
        source: 'nearest',
        nearestKind: kind,
        name: row.name,
        categoryLabel: kind.charAt(0).toUpperCase() + kind.slice(1),
        exploreCategory: savedRowToExploreCategory({
          source: 'nearest',
          nearestKind: kind,
          categoryLabel: kind
        }),
        description: row.servicesSummary,
        distanceRaw: row.note,
        address: row.address,
        mapsUrl: row.mapsUrl,
        city,
        nearLabel: row.nearLabel
      });
    });
  });
  return [...fromDining, ...extras];
}

export interface MobileLocationInfoContentProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  readOnly?: boolean;
  canEditSavedPlaces?: boolean;
  canEditHighlights?: boolean;
  onOpenNearTool?: (toolId: NearYouToolId) => void;
  onEditHighlights?: () => void;
  onEditOverview?: () => void;
  onEditNotes?: () => void;
  onOpenExplore?: (category?: string) => void;
  onOpenSavedPlaces?: (category?: string) => void;
  onChangeStartingPoint?: () => void;
  onResetStartingPoint?: () => void;
  onUndoStartingPoint?: () => void;
  canUndoStartingPoint?: boolean;
  isCustomStartingPoint?: boolean;
  accommodationLabel?: string;
  startingPointLabel?: string;
  calendarDate?: string;
}

export const MobileLocationInfoContent: React.FC<MobileLocationInfoContentProps> = ({
  entry,
  place,
  readOnly = false,
  canEditSavedPlaces = false,
  canEditHighlights = false,
  onOpenNearTool,
  onEditHighlights,
  onEditOverview,
  onEditNotes,
  onOpenExplore,
  onOpenSavedPlaces,
  onChangeStartingPoint,
  onResetStartingPoint,
  onUndoStartingPoint,
  canUndoStartingPoint,
  isCustomStartingPoint,
  accommodationLabel,
  startingPointLabel
}) => {
  const { config } = useConfig();
  const { updateEntry } = useTripWorkspace();
  const askRef = React.useRef<HTMLElement | null>(null);
  const pillsRef = React.useRef<HTMLDivElement | null>(null);
  const [askExpanded, setAskExpanded] = React.useState(false);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const data = parseLocationInfoNotes(entry.notes);
  const rows = data ? locationHighlightRows(data) : [];
  const rowsByKind = React.useMemo(() => {
    const map: Record<LocationHighlightKind, LocationHighlightRow[]> = {
      sight: [],
      food: [],
      drink: [],
      souvenir: []
    };
    for (const row of rows) map[row.kind].push(row);
    return map;
  }, [rows]);

  const allCats = React.useMemo(() => exploreCategoriesSorted(), []);

  const shortPlace =
    placeNameFromTitle(place?.title || '') ||
    placeNameFromTitle(entry.title || entry.location || '') ||
    'this place';
  const stayName = (startingPointLabel || '').trim() || shortPlace;
  const city = shortPlace;
  const defaultNearLabel = `Saved for ${city}`;

  const allSavedCards = React.useMemo(
    () => (data ? buildFeaturedCards(data, city) : []),
    [data, city]
  );
  const featured = React.useMemo(() => allSavedCards.slice(0, 24), [allSavedCards]);

  const featuredGroups = React.useMemo(() => {
    const map = new Map<string, FeaturedCard[]>();
    for (const card of featured) {
      const key = (card.nearLabel || '').trim() || defaultNearLabel;
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([label, cards]) => ({ label, cards }));
  }, [featured, defaultNearLabel]);

  if (!data) {
    return <p className={styles.empty}>No location data for this place yet.</p>;
  }

  const persist = (next: LocationInfoNotes): void => {
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(next)) });
  };

  const toggleHighlight = (key: string): void => {
    const nextRows = rows.map((r) => (highlightKey(r) === key ? { ...r, done: !r.done } : r));
    persist({ ...data, ...splitHighlightRows(nextRows) });
  };

  const diningCount = allSavedCards.filter((c) => DINING_CATS.has(c.exploreCategory)).length;
  const sightsCount = allSavedCards.filter((c) => SIGHTS_CATS.has(c.exploreCategory)).length;
  const shoppingCount = allSavedCards.filter((c) => SHOPPING_CATS.has(c.exploreCategory)).length;
  const essentialsCount = allSavedCards.filter((c) => ESSENTIAL_CATS.has(c.exploreCategory)).length;
  const allSavedCount = allSavedCards.length;

  const savedTiles: Array<{ id: string; label: string; count: number }> = [
    { id: 'restaurants', label: 'Dining', count: diningCount },
    { id: 'sights', label: 'Sights', count: sightsCount },
    { id: 'shopping', label: 'Shopping', count: shoppingCount },
    { id: 'essentials', label: 'Essentials', count: essentialsCount },
    { id: 'all', label: 'All saved', count: allSavedCount }
  ];

  const openExploreCat = (id: ExploreCategoryId): void => {
    if (onOpenExplore) {
      onOpenExplore(id);
      return;
    }
    const toolMap: Partial<Record<ExploreCategoryId, NearYouToolId>> = {
      restaurants: 'dining',
      nightlife: 'dining',
      cafes: 'cafes',
      bakeries: 'cafes',
      shopping: 'grocery',
      groceries: 'grocery',
      markets: 'grocery',
      pharmacy: 'pharmacy',
      atm: 'atm',
      restroom: 'restroom',
      transport: 'transport',
      medical: 'medical',
      fuel: 'fuel'
    };
    const tool = toolMap[id];
    if (tool && onOpenNearTool) onOpenNearTool(tool);
  };

  const openAsk = (): void => {
    setAskExpanded(true);
    window.setTimeout(() => askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const removeSavedCard = (card: FeaturedCard): void => {
    if (!canEditSavedPlaces) return;
    if (card.source === 'dining') {
      persist({
        ...data,
        diningSuggestions: (data.diningSuggestions ?? []).filter((x) => x.id !== card.id)
      });
      return;
    }
    if (!card.nearestKind) return;
    const nearest = { ...(data.nearestPlaces ?? {}) };
    nearest[card.nearestKind] = (nearest[card.nearestKind] ?? []).filter((x) => x.id !== card.id);
    persist({ ...data, nearestPlaces: nearest });
  };

  return (
    <div className={styles.root}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Overview</h3>
          {canEditHighlights && onEditOverview ? (
            <MobilePencilButton onClick={onEditOverview} ariaLabel="Edit overview" />
          ) : null}
        </div>
        <div className={styles.overviewSplit}>
          <div className={styles.overviewTextCol}>
            {data.overview.trim() ? (
              <div className={styles.overviewBody}>
                <RichTextContent html={data.overview.trim()} />
              </div>
            ) : (
              <p className={styles.empty}>Overview will appear here once this place has been generated or edited.</p>
            )}
          </div>
          <div
            className={styles.overviewPhoto}
            style={{
              backgroundImage: `url(${destinationHeroPhotoUrl(shortPlace, place?.country)})`
            }}
            role="img"
            aria-label={`${shortPlace} photo`}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Highlights</h3>
          {canEditHighlights && onEditHighlights ? (
            <MobilePencilButton onClick={onEditHighlights} ariaLabel="Edit highlights" />
          ) : null}
        </div>
        <div className={styles.highlightsGrid}>
          {(
            [
              ['sight', 'food'],
              ['drink', 'souvenir']
            ] as const
          ).map((pair, rowIdx) => (
            <div key={rowIdx === 0 ? 'row-top' : 'row-bottom'} className={styles.highlightsRow}>
              {pair.map((kind, colIdx) => (
                <React.Fragment key={kind}>
                  {colIdx === 1 ? <div className={styles.highlightSep} aria-hidden /> : null}
                  <div className={styles.highlightCol}>
                    <p className={styles.highlightKind}>
                      <LocationHighlightIcon kind={kind} size="sm" />
                      {HIGHLIGHT_LABEL[kind]}
                    </p>
                    <ul className={styles.highlightList}>
                      {(rowsByKind[kind] ?? []).map((row) => (
                        <li key={highlightKey(row)} className={styles.highlightItem}>
                          <label className={styles.highlightCheck}>
                            <input
                              type="checkbox"
                              checked={row.done}
                              disabled={readOnly}
                              onChange={() => toggleHighlight(highlightKey(row))}
                            />
                            <span className={row.done ? styles.done : undefined}>{row.label}</span>
                          </label>
                        </li>
                      ))}
                      {!rowsByKind[kind]?.length ? (
                        <li className={styles.highlightEmpty}>None yet</li>
                      ) : null}
                    </ul>
                  </div>
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Explore {shortPlace}</h3>
          {onOpenExplore ? (
            <button type="button" className={styles.viewAllLink} onClick={() => onOpenExplore()}>
              View all ›
            </button>
          ) : null}
        </div>
        <p className={styles.sectionSub}>Discover places near your accommodation or anywhere in the city.</p>
        <div className={styles.catPillsBlock}>
          <div className={styles.catPills} role="list" ref={pillsRef}>
            {allCats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="listitem"
                className={styles.catPill}
                style={{ color: cat.accent }}
                onClick={() => openExploreCat(cat.id)}
              >
                <span className={styles.catPillIcon} style={{ background: cat.bg, color: cat.accent }}>
                  <CategoryGlyph id={cat.id} />
                </span>
                <span className={styles.catPillLabel}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.startBanner}>
          <span className={styles.startBannerIcon} aria-hidden>
            <IconBed />
          </span>
          <div className={styles.startBannerBody}>
            <p className={styles.startBannerText}>
              Showing places near <strong>{stayName}</strong>
            </p>
            <MobileStartPointActions
              onChangeStartingPoint={onChangeStartingPoint}
              onResetStartingPoint={onResetStartingPoint}
              onUndoStartingPoint={onUndoStartingPoint}
              canUndoStartingPoint={canUndoStartingPoint}
              isCustomStartingPoint={isCustomStartingPoint}
              accommodationLabel={accommodationLabel}
              changeClassName={styles.startBannerLink}
              mutedClassName={styles.startBannerMuted}
              actionsClassName={styles.startBannerActions}
              undoClassName={styles.startBannerUndo}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Saved places</h3>
          {onOpenSavedPlaces ? (
            <button type="button" className={styles.viewAllLink} onClick={() => onOpenSavedPlaces()}>
              View all ›
            </button>
          ) : null}
        </div>
        <p className={styles.sectionSub}>
          Places you&apos;ve saved for {shortPlace}. Use GPS when you&apos;re there for live directions.
        </p>
        <div className={styles.savedTiles} role="list">
          {savedTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              role="listitem"
              className={styles.savedTile}
              onClick={() => onOpenSavedPlaces?.(tile.id === 'all' ? undefined : tile.id)}
            >
              <span className={styles.savedTileCount}>{tile.count}</span>
              <span className={styles.savedTileLabel}>{tile.label}</span>
            </button>
          ))}
        </div>
        {featuredGroups.length ? (
          <div className={styles.savedGroups}>
            {featuredGroups.map((group) => {
              const open = !collapsedGroups[group.label];
              return (
                <div key={group.label} className={styles.savedGroup}>
                  <button
                    type="button"
                    className={styles.savedGroupHead}
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsedGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
                    }
                  >
                    <span>{group.label}</span>
                    <IconChevron open={open} />
                  </button>
                  {open ? (
                    <div className={styles.featuredStrip}>
                      {group.cards.map((card) => (
                        <MobilePlaceDiscoverCard
                          key={`${card.source}-${card.id}`}
                          layout="strip"
                          startingPointLabel={stayName}
                          cityFallback={shortPlace}
                          card={{
                            id: card.id,
                            name: card.name,
                            categoryLabel: card.categoryLabel,
                            rating: card.rating,
                            description: card.description,
                            distanceRaw: card.distanceRaw,
                            address: card.address,
                            mapsUrl: card.mapsUrl,
                            city: card.city || shortPlace,
                            nearLabel: card.nearLabel
                          }}
                          primaryAction={
                            canEditSavedPlaces
                              ? {
                                  label: 'Delete',
                                  kind: 'delete',
                                  onClick: () => removeSavedCard(card)
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>Save places from Explore to see them here.</p>
        )}
      </section>

      <section className={styles.section} ref={askRef}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Q &amp; A</h3>
        </div>
        <div className={styles.askBanner}>
          <span className={styles.askBannerIcon} aria-hidden>
            <IconSparkle />
          </span>
          <div className={styles.askBannerCopy}>
            <p className={styles.askBannerTitle}>Ask AI about {shortPlace}</p>
            <p className={styles.askBannerSub}>Get tips on what to see, eat, and do while you&apos;re there.</p>
          </div>
          <button type="button" className={styles.askBannerCta} onClick={openAsk}>
            Ask a question ›
          </button>
        </div>
        {askExpanded || (data.aiQaThread && data.aiQaThread.length > 0) ? (
          <div className={styles.askPanelWrap}>
            <LocationInfoAskPanel
              entry={entry}
              place={place}
              data={data}
              geminiApiKey={config.geminiApiKey || ''}
              readOnly={readOnly}
              mobileLayout
              hideIntro
              onThreadChange={(thread) => persist({ ...data, aiQaThread: thread })}
            />
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          {canEditHighlights && onEditNotes ? (
            <MobilePencilButton onClick={onEditNotes} ariaLabel="Edit notes" />
          ) : null}
        </div>
        {(data.userNotes || '').trim() ? (
          <div className={styles.notesBody}>
            <RichTextContent html={(data.userNotes || '').trim()} />
          </div>
        ) : (
          <p className={styles.empty}>Add your own notes for this place — tips appear separately below.</p>
        )}
      </section>

      <MobileLocationTravelTip
        placeLabel={shortPlace}
        startingPointLabel={stayName}
        onAppendToNotes={
          canEditHighlights
            ? (tipText) => {
                persist({
                  ...data,
                  userNotes: appendTipBulletToUserNotes(data.userNotes, tipText)
                });
              }
            : undefined
        }
      />
    </div>
  );
};
