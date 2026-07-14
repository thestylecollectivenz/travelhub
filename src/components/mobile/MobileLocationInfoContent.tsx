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
  type LocationHighlightKind,
  type LocationHighlightRow,
  type LocationInfoNotes,
  type NearestPlaceRow
} from '../../utils/locationInfoEntry';
import { placeQueryDirectionsUrl, placeQueryMapsUrl } from '../../utils/googleMapsLink';
import { RichTextContent } from '../shared/RichTextContent';
import { LocationInfoAskPanel } from '../itinerary/LocationInfoAskPanel';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { LocationHighlightIcon } from './LocationHighlightIcon';
import { MobilePencilButton } from './MobilePencilButton';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import { MobileLocationSavedPlaces } from './MobileLocationSavedPlaces';
import styles from './MobileLocationInfoContent.module.css';

const HIGHLIGHT_LABEL: Record<LocationHighlightKind, string> = {
  sight: 'Sights',
  food: 'Food',
  drink: 'Drink',
  souvenir: 'Souvenirs'
};
const ESSENTIAL_KINDS: Array<'grocery' | 'pharmacy' | 'atm'> = ['grocery', 'pharmacy', 'atm'];

const ESSENTIAL_LABEL: Record<'grocery' | 'pharmacy' | 'atm', string> = {
  grocery: 'Shopping',
  pharmacy: 'Pharmacy',
  atm: 'ATM'
};

function servicePills(summary?: string): string[] {
  if (!summary?.trim()) return [];
  return summary
    .split(/[,;·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function highlightKey(row: LocationHighlightRow): string {
  return `${row.kind}::${row.id}`;
}

export interface MobileLocationInfoContentProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  readOnly?: boolean;
  canEditSavedPlaces?: boolean;
  canEditHighlights?: boolean;
  onOpenNearTool?: (toolId: NearYouToolId) => void;
  onEditHighlights?: () => void;
}

export const MobileLocationInfoContent: React.FC<MobileLocationInfoContentProps> = ({
  entry,
  place,
  readOnly = false,
  canEditSavedPlaces = false,
  canEditHighlights = false,
  onOpenNearTool,
  onEditHighlights
}) => {
  const { config } = useConfig();
  const { updateEntry } = useTripWorkspace();
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

  if (!data) {
    return <p className={styles.empty}>No location data for this place yet.</p>;
  }

  const persist = (next: LocationInfoNotes): void => {
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(next)) });
  };

  const nearest = data.nearestPlaces ?? {};
  const essentials = ESSENTIAL_KINDS.map((kind) => ({
    kind,
    place: (nearest[kind] ?? [])[0] as NearestPlaceRow | undefined
  }));

  const toggleHighlight = (key: string): void => {
    const nextRows = rows.map((r) => (highlightKey(r) === key ? { ...r, done: !r.done } : r));
    persist({ ...data, ...splitHighlightRows(nextRows) });
  };

  return (
    <div className={styles.root}>
      {onOpenNearTool ? (
        <nav className={styles.toolRow} aria-label="Near this place">
          {NEAR_YOU_TOOLS.map((t) => (
            <button key={t.id} type="button" className={styles.toolBtn} onClick={() => onOpenNearTool(t.id)}>
              <NearYouToolIcon toolId={t.id} size="lg" />
              <span className={styles.toolLabel}>{t.shortLabel}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {data.overview.trim() ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Overview</h3>
          <div className={styles.overviewBody}>
            <RichTextContent html={data.overview.trim()} />
          </div>
        </section>
      ) : (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Overview</h3>
          <p className={styles.empty}>Overview will appear here once this place has been generated or edited.</p>
        </section>
      )}

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
          <h3 className={styles.sectionTitle}>Nearby essentials</h3>
        </div>
        <div className={styles.essentialsRow}>
          {essentials.map(({ kind, place: p }) => {
            const toolId = kind;
            const directions = p ? placeQueryDirectionsUrl(p.name, p.address) || p.mapsUrl : undefined;
            const maps = p ? p.mapsUrl || placeQueryMapsUrl(p.name, p.address) : undefined;
            const pills = servicePills(p?.servicesSummary);
            return (
              <article key={kind} className={styles.essentialCard}>
                <div className={styles.essentialPhoto} aria-hidden>
                  <NearYouToolIcon toolId={toolId} size="lg" />
                </div>
                <div className={styles.essentialTop}>
                  <strong className={styles.essentialName}>{p?.name || ESSENTIAL_LABEL[kind]}</strong>
                </div>
                {p?.note ? <p className={styles.essentialDist}>{p.note}</p> : null}
                {p?.address ? <p className={styles.essentialAddr}>{p.address}</p> : null}
                {pills.length ? (
                  <div className={styles.essentialPills}>
                    {pills.map((pill) => (
                      <span key={pill} className={styles.essentialPill}>
                        {pill}
                      </span>
                    ))}
                  </div>
                ) : null}
                {p?.servicesSummary && !pills.length ? (
                  <p className={styles.essentialNote}>{p.servicesSummary}</p>
                ) : null}
                <div className={styles.essentialFooter}>
                  <div className={styles.essentialActions}>
                    {directions ? (
                      <a className={styles.essentialAction} href={directions} target="_blank" rel="noopener noreferrer" title="Directions" aria-label="Directions">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M12 2 4 20l8-4 8 4L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ) : null}
                    {maps ? (
                      <a className={styles.essentialAction} href={maps} target="_blank" rel="noopener noreferrer" title="Map" aria-label="Map">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="12" cy="11" r="2" fill="currentColor" />
                        </svg>
                      </a>
                    ) : null}
                  </div>
                  {onOpenNearTool ? (
                    <button type="button" className={styles.viewAllBtn} onClick={() => onOpenNearTool(toolId)}>
                      View all
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {!essentials.some((e) => e.place) ? (
          <p className={styles.empty}>Open Shopping, Pharmacy, or ATM from the icons above to find essentials near this place.</p>
        ) : null}
      </section>

      <MobileLocationSavedPlaces data={data} readOnly={!canEditSavedPlaces} onChange={persist} />

      {data.practicalTips.trim() ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          <div className={styles.overviewBody}>
            <RichTextContent html={data.practicalTips.trim()} />
          </div>
        </section>
      ) : null}

      <section className={styles.askSection}>
        <div className={styles.askBar}>
          <span className={styles.askBarIcon} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3a7 7 0 0 0-4 10v4l4-2 4 2v-4A7 7 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={styles.askBarLabel}>Ask AI about {place?.title || entry.title || 'this place'}</span>
        </div>
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
      </section>
    </div>
  );
};
