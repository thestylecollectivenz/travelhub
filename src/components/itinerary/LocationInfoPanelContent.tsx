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
  type LocationInfoCheckItem,
  type LocationInfoNotes,
  type NearestPlaceKind,
  type NearestPlaceRow
} from '../../utils/locationInfoEntry';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoDining, scheduleLocationInfoNearest } from '../../utils/locationInfoGeneration';
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
      <path d="M12 8V4M9 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12v6M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function PetrolIcon(): React.ReactElement {
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

function HospitalIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const NEAREST_TOOLS: Array<{ kind: NearestPlaceKind; label: string; icon: React.ReactElement }> = [
  { kind: 'pharmacy', label: 'Nearest pharmacy', icon: <PharmacyIcon /> },
  { kind: 'grocery', label: 'Nearest grocery', icon: <GroceryIcon /> },
  { kind: 'petrol', label: 'Nearest petrol', icon: <PetrolIcon /> },
  { kind: 'atm', label: 'Nearest ATM', icon: <AtmIcon /> },
  { kind: 'hospital', label: 'Nearest hospital', icon: <HospitalIcon /> }
];

function ChecklistSection(props: {
  title: string;
  items: LocationInfoCheckItem[];
  readOnly?: boolean;
  onChange: (items: LocationInfoCheckItem[]) => void;
}): React.ReactElement | null {
  const { title, items, readOnly, onChange } = props;
  if (!items.length && readOnly) return null;
  return (
    <section className={styles.section}>
      <h4 className={styles.heading}>{title}</h4>
      {items.length ? (
        <ul className={styles.checkList}>
          {items.map((item) => (
            <li key={item.id} className={styles.checkRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly}
                  onChange={() =>
                    onChange(items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))
                  }
                />
                <span className={item.done ? styles.labelDone : undefined}>{item.label}</span>
              </label>
              {!readOnly ? (
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label="Remove"
                  onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyHint}>Tap the icon above to generate suggestions.</p>
      )}
    </section>
  );
}

function NearestSection(props: {
  kind: NearestPlaceKind;
  title: string;
  rows: NearestPlaceRow[];
}): React.ReactElement | null {
  const { title, rows } = props;
  if (!rows.length) return null;
  return (
    <section className={styles.section}>
      <h4 className={styles.heading}>{title}</h4>
      <ul className={styles.nearestList}>
        {rows.map((row) => (
          <li key={row.id} className={styles.nearestRow}>
            <span className={styles.nearestName}>{row.name}</span>
            {row.note ? <span className={styles.nearestNote}>{row.note}</span> : null}
            {row.mapsUrl ? (
              <a className={styles.mapsLink} href={row.mapsUrl} target="_blank" rel="noopener noreferrer">
                Map
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
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

  const runDining = (): void => {
    if (!place || !hasKey || readOnly) return;
    setToolError(undefined);
    scheduleLocationInfoDining({ spContext, entry, place, apiKey: config.geminiApiKey });
  };

  const runNearest = (kind: NearestPlaceKind): void => {
    if (!place || !hasKey || readOnly) return;
    setToolError(undefined);
    scheduleLocationInfoNearest({ spContext, entry, place, apiKey: config.geminiApiKey, kind });
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
            title="Dining suggestions (AI + GPS)"
            aria-label="Dining suggestions"
            disabled={!hasKey || loadingTool !== null}
            onClick={runDining}
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
              onClick={() => runNearest(tool.kind)}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ) : null}
      {!hasKey && !readOnly ? (
        <p className={styles.keyHint}>
          Add a Gemini API key in User settings to use dining and nearest-place tools.
        </p>
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

      <ChecklistSection
        title="Dining suggestions"
        items={dining}
        readOnly={readOnly}
        onChange={(items) => persist({ ...data, diningSuggestions: items })}
      />

      {NEAREST_TOOLS.map((tool) => {
        const rows = nearest[tool.kind] ?? [];
        if (!rows.length) return null;
        return <NearestSection key={tool.kind} kind={tool.kind} title={tool.label} rows={rows} />;
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
