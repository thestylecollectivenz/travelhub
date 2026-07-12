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
import { MobilePencilButton } from './MobilePencilButton';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import styles from './MobileLocationInfoContent.module.css';

const HIGHLIGHT_KINDS: LocationHighlightKind[] = ['sight', 'food', 'drink', 'souvenir'];
const HIGHLIGHT_LABEL: Record<LocationHighlightKind, string> = {
  sight: 'Sights',
  food: 'Food',
  drink: 'Drink',
  souvenir: 'Souvenirs'
};
const HIGHLIGHT_ICON: Record<LocationHighlightKind, string> = {
  sight: '🏛',
  food: '🍽',
  drink: '🍷',
  souvenir: '🎁'
};

const ESSENTIAL_KINDS: Array<'grocery' | 'pharmacy' | 'atm'> = ['grocery', 'pharmacy', 'atm'];

function highlightKey(row: LocationHighlightRow): string {
  return `${row.kind}::${row.id}`;
}

export interface MobileLocationInfoContentProps {
  entry: ItineraryEntry;
  place: Place | undefined;
  readOnly?: boolean;
  canEditHighlights?: boolean;
  onOpenNearTool?: (toolId: NearYouToolId) => void;
  onEditHighlights?: () => void;
}

export const MobileLocationInfoContent: React.FC<MobileLocationInfoContentProps> = ({
  entry,
  place,
  readOnly = false,
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
  })).filter((x) => x.place);

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
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Highlights</h3>
          {canEditHighlights && onEditHighlights ? (
            <MobilePencilButton onClick={onEditHighlights} ariaLabel="Edit highlights" />
          ) : null}
        </div>
        <div className={styles.highlightsGrid}>
          {HIGHLIGHT_KINDS.map((kind) => (
            <div key={kind} className={styles.highlightCol}>
              <p className={styles.highlightKind}>
                <span className={styles.highlightKindIcon} aria-hidden>
                  {HIGHLIGHT_ICON[kind]}
                </span>
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
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Nearby essentials</h3>
        </div>
        {essentials.length ? (
          <div className={styles.essentialsRow}>
            {essentials.map(({ kind, place: p }) => {
              if (!p) return null;
              const directions = placeQueryDirectionsUrl(p.name, p.address) || p.mapsUrl;
              const maps = p.mapsUrl || placeQueryMapsUrl(p.name, p.address);
              return (
                <article key={kind} className={styles.essentialCard}>
                  <div className={styles.essentialTop}>
                    <NearYouToolIcon toolId={kind === 'grocery' ? 'grocery' : kind === 'pharmacy' ? 'pharmacy' : 'atm'} size="md" />
                    <strong className={styles.essentialName}>{p.name}</strong>
                  </div>
                  {p.note ? <p className={styles.essentialDist}>{p.note}</p> : null}
                  {p.servicesSummary ? <p className={styles.essentialNote}>{p.servicesSummary}</p> : null}
                  {p.address ? <p className={styles.essentialAddr}>{p.address}</p> : null}
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
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>Open Shopping, ATM, or Medical from the icons above to find essentials.</p>
        )}
      </section>

      {data.practicalTips.trim() ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          <div className={styles.overviewBody}>
            <RichTextContent html={data.practicalTips.trim()} />
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ask AI</h3>
        <p className={styles.askHint}>
          Ask AI about this place. Answers are saved here and never overwrite your lists.
        </p>
        <LocationInfoAskPanel
          entry={entry}
          place={place}
          data={data}
          geminiApiKey={config.geminiApiKey || ''}
          readOnly={readOnly}
          onThreadChange={(thread) => persist({ ...data, aiQaThread: thread })}
        />
      </section>
    </div>
  );
};
