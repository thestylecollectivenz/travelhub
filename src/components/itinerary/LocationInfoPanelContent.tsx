import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  locationHighlightRows,
  locationInfoIsPopulated,
  markHighlightRowsUserEdited,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  recordSuppressedHighlightLabels,
  serializeLocationInfoNotes,
  splitHighlightRows,
  type DiningSuggestionRow,
  type LocationInfoNotes,
  type NearestPlaceKind,
  type NearestPlaceRow
} from '../../utils/locationInfoEntry';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoDining, scheduleLocationInfoNearest } from '../../utils/locationInfoGeneration';
import {
  googleReviewsSearchUrl,
  placeQueryDirectionsUrl,
  placeQueryMapsUrl
} from '../../utils/googleMapsLink';
import { RichTextContent } from '../shared/RichTextContent';
import { LocationInfoAskPanel } from './LocationInfoAskPanel';
import { LocationInfoHighlights } from './LocationInfoHighlights';
import styles from './LocationInfoPanelContent.module.css';

function PinIcon(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function DiningIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 3v8a3 3 0 0 0 6 0V3M8 11v10M17 3v18M20 3v6a3 3 0 0 1-6 0V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PharmacyIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8V4M9 4h6M12 12v6M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GroceryIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 7h15l-1.5 9H7.5L6 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 7 5 3H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="19" r="1.5" fill="currentColor" />
      <circle cx="17" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FuelIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 10h2l2 3v7h-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AtmIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9h10M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MedicalIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 7v5h-5M4 17v-5h5M5.6 9.4A7 7 0 0 1 19 9M18.4 14.6A7 7 0 0 1 5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NEAREST_TOOLS: Array<{ kind: NearestPlaceKind; label: string; icon: React.ReactElement }> = [
  { kind: 'pharmacy', label: 'Nearest pharmacy', icon: <PharmacyIcon /> },
  { kind: 'grocery', label: 'Nearest grocery', icon: <GroceryIcon /> },
  { kind: 'fuel', label: 'Nearest fuel', icon: <FuelIcon /> },
  { kind: 'atm', label: 'Nearest ATM', icon: <AtmIcon /> },
  { kind: 'medical', label: 'Nearest medical', icon: <MedicalIcon /> }
];

function PlaceLinks(props: { name: string; address?: string; mapsUrl?: string; reviewsUrl?: string }): React.ReactElement {
  const { name, address, mapsUrl, reviewsUrl } = props;
  const mapHref = mapsUrl || placeQueryMapsUrl(name, address);
  const routeHref = placeQueryDirectionsUrl(name, address);
  const reviewsHref = reviewsUrl || googleReviewsSearchUrl([name, address].filter(Boolean).join(' '));
  return (
    <div className={styles.placeLinks}>
      {mapHref ? (
        <a className={styles.placeLinkIcon} href={mapHref} target="_blank" rel="noopener noreferrer" title="Map">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="11" r="2" fill="currentColor" />
          </svg>
        </a>
      ) : null}
      {routeHref ? (
        <a className={styles.placeLinkIcon} href={routeHref} target="_blank" rel="noopener noreferrer" title="Route from here">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
      {reviewsHref ? (
        <a className={styles.placeLinkIcon} href={reviewsHref} target="_blank" rel="noopener noreferrer" title="Reviews">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3l2.4 4.8L20 9l-4 3.9.9 5.6L12 16.2 7.1 18.5 8 12.9 4 9l5.6-1.2L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

function SectionHead(props: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}): React.ReactElement {
  const { title, onRefresh, refreshing, refreshLabel } = props;
  return (
    <div className={styles.sectionHead}>
      <h4 className={styles.heading}>{title}</h4>
      {onRefresh ? (
        <button
          type="button"
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnLoading : ''}`}
          title={refreshLabel || 'Refresh'}
          aria-label={refreshLabel || 'Refresh'}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshIcon />
        </button>
      ) : null}
    </div>
  );
}

export interface LocationInfoPanelContentProps {
  entry: ItineraryEntry;
  readOnly?: boolean;
}

export const LocationInfoPanelContent: React.FC<LocationInfoPanelContentProps> = ({ entry, readOnly = false }) => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const { updateEntry } = useTripWorkspace();
  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const highlightRowsRef = React.useRef(data ? locationHighlightRows(data) : []);
  const [loadingTool, setLoadingTool] = React.useState<string | null>(null);
  const [toolError, setToolError] = React.useState<string | undefined>();

  const hasKey = Boolean((config.geminiApiKey || '').trim());

  React.useEffect(() => {
    if (!data) return undefined;
    return subscribeLocationInfoAIStatus(entry.id, (detail) => {
      if (detail.loading) {
        setLoadingTool(detail.section ?? 'all');
        return;
      }
      setLoadingTool(null);
      if (detail.error) setToolError(detail.error);
      else if (detail.success) setToolError(undefined);
    });
  }, [entry.id, data]);

  if (!data) {
    return <p className={styles.emptyHint}>No location data for this place yet.</p>;
  }

  const persist = (next: LocationInfoNotes): void => {
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(next)) });
  };

  const runDining = (replaceExisting = false): void => {
    if (!place || !hasKey || readOnly) return;
    setToolError(undefined);
    scheduleLocationInfoDining({ spContext, entry, place, apiKey: config.geminiApiKey, replaceExisting });
  };

  const runNearest = (kind: NearestPlaceKind, replaceExisting = false): void => {
    if (!place || !hasKey || readOnly) return;
    setToolError(undefined);
    scheduleLocationInfoNearest({ spContext, entry, place, apiKey: config.geminiApiKey, kind, replaceExisting });
  };

  const dining = data.diningSuggestions ?? [];
  const nearest = data.nearestPlaces ?? {};

  return (
    <div className={styles.root}>
      {!readOnly ? (
        <div className={styles.toolBar} role="toolbar" aria-label="Location quick tools">
          <button
            type="button"
            className={`${styles.toolBtn} ${loadingTool === 'dining' ? styles.toolBtnLoading : ''}`}
            title="Dining suggestions"
            aria-label="Dining suggestions"
            disabled={!hasKey || loadingTool !== null}
            onClick={() => runDining(dining.length > 0)}
          >
            <DiningIcon />
          </button>
          {NEAREST_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              className={`${styles.toolBtn} ${loadingTool === tool.kind ? styles.toolBtnLoading : ''}`}
              title={tool.label}
              aria-label={tool.label}
              disabled={!hasKey || loadingTool !== null}
              onClick={() => runNearest(tool.kind, (nearest[tool.kind]?.length ?? 0) > 0)}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ) : null}
      {!hasKey && !readOnly ? (
        <p className={styles.keyHint}>Add a Gemini API key in User settings to use dining and nearest-place tools.</p>
      ) : null}
      {toolError ? <p className={styles.toolError}>{toolError}</p> : null}
      {data.aiError?.trim() ? <p className={styles.toolError}>{data.aiError.trim()}</p> : null}

      {data.overview.trim() ? (
        <section className={styles.section}>
          <h4 className={styles.heading}>Overview</h4>
          <div className={styles.overview}>
            <RichTextContent html={data.overview.trim()} />
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h4 className={styles.heading}>Highlights</h4>
        <LocationInfoHighlights
          rows={locationHighlightRows(data)}
          emptyHint={data.aiSightsPlaceholder}
          entry={entry}
          place={place}
          geminiApiKey={config.geminiApiKey}
          hasAnyContent={locationInfoIsPopulated(data)}
          readOnly={readOnly}
          onOpenSettings={() => window.dispatchEvent(new Event('travelhub-open-settings'))}
          onChange={(rows) => {
            if (readOnly) return;
            const prev = highlightRowsRef.current;
            const suppressed = recordSuppressedHighlightLabels(data, prev, rows);
            const marked = markHighlightRowsUserEdited(rows);
            highlightRowsRef.current = marked;
            persist({
              ...data,
              ...splitHighlightRows(marked),
              suppressedHighlightKeys: suppressed
            });
          }}
        />
      </section>

      {dining.length || !readOnly ? (
        <section className={styles.section}>
          <SectionHead
            title="Dining suggestions"
            refreshLabel="Refresh dining suggestions"
            refreshing={loadingTool === 'dining'}
            onRefresh={dining.length && !readOnly && hasKey ? () => runDining(true) : undefined}
          />
          {dining.length ? (
            <ul className={styles.cardList}>
              {dining.map((row) => (
                <li key={row.id} className={styles.placeCard}>
                  <div className={styles.placeCardTop}>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={Boolean(row.done)}
                        disabled={readOnly}
                        onChange={() =>
                          persist({
                            ...data,
                            diningSuggestions: dining.map((x) =>
                              x.id === row.id ? { ...x, done: !x.done } : x
                            )
                          })
                        }
                      />
                      <span className={`${styles.placeName} ${row.done ? styles.labelDone : ''}`}>{row.name}</span>
                    </label>
                    <PlaceLinks name={row.name} mapsUrl={row.mapsUrl} reviewsUrl={row.reviewsUrl} />
                  </div>
                  {row.description ? <p className={styles.placeDesc}>{row.description}</p> : null}
                  {row.why ? <p className={styles.placeWhy}>{row.why}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyHint}>Tap the dining icon above to generate suggestions.</p>
          )}
        </section>
      ) : null}

      {NEAREST_TOOLS.map((tool) => {
        const rows = nearest[tool.kind] ?? [];
        if (!rows.length) return null;
        return (
          <section key={tool.kind} className={styles.section}>
            <SectionHead
              title={tool.label}
              refreshLabel={`Refresh ${tool.label.toLowerCase()}`}
              refreshing={loadingTool === tool.kind}
              onRefresh={!readOnly && hasKey ? () => runNearest(tool.kind, true) : undefined}
            />
            <ul className={styles.cardList}>
              {rows.map((row: NearestPlaceRow) => (
                <li key={row.id} className={styles.placeCard}>
                  <div className={styles.placeCardTop}>
                    <span className={styles.placeName}>{row.name}</span>
                    <PlaceLinks name={row.name} address={row.address} mapsUrl={row.mapsUrl} reviewsUrl={row.reviewsUrl} />
                  </div>
                  {row.note ? <p className={styles.placeDesc}>{row.note}</p> : null}
                  {row.address ? <p className={styles.placeWhy}>{row.address}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {data.practicalTips.trim() ? (
        <section className={styles.section}>
          <h4 className={styles.heading}>Practical tips</h4>
          <p className={styles.overview}>{data.practicalTips.trim()}</p>
        </section>
      ) : null}

      <LocationInfoAskPanel
        entry={entry}
        place={place}
        data={data}
        geminiApiKey={config.geminiApiKey}
        readOnly={readOnly}
        onOpenSettings={() => window.dispatchEvent(new Event('travelhub-open-settings'))}
        onThreadChange={(thread) => persist({ ...data, aiQaThread: thread })}
      />
    </div>
  );
};

export function LocationInfoStripPinIcon(): React.ReactElement {
  return <PinIcon />;
}
