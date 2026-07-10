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
  placeWebsiteSearchUrl,
  placeQueryDirectionsUrl,
  placeQueryMapsUrl
} from '../../utils/googleMapsLink';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import { resolveLocationSearchContext } from '../../utils/locationGeoContext';
import { RichTextContent } from '../shared/RichTextContent';
import { desktopNearestTools } from '../../utils/nearYouTools';
import { LocationInfoAskPanel } from './LocationInfoAskPanel';
import { LocationInfoHighlights } from './LocationInfoHighlights';
import styles from './LocationInfoPanelContent.module.css';

type SectionKey =
  | 'overview'
  | 'highlights'
  | 'dining'
  | 'pharmacy'
  | 'grocery'
  | 'fuel'
  | 'atm'
  | 'medical'
  | 'restroom'
  | 'transport'
  | 'tips'
  | 'qa';

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

function RestroomIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 20v-7.5A2.5 2.5 0 0 1 8 10h0a2.5 2.5 0 0 1 2.5 2.5V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 20v-6h5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TransportIcon(): React.ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 12h14M8 19h.01M16 19h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function LinkIcon(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14 14 10M7 17l-2 2a3 3 0 1 1-4-4l2-2M17 7l2-2a3 3 0 1 1 4 4l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const NEAREST_ICON: Record<NearestPlaceKind, React.ReactElement> = {
  pharmacy: <PharmacyIcon />,
  grocery: <GroceryIcon />,
  fuel: <FuelIcon />,
  atm: <AtmIcon />,
  medical: <MedicalIcon />,
  restroom: <RestroomIcon />,
  transport: <TransportIcon />
};

const NEAREST_TOOLS: Array<{ kind: NearestPlaceKind; label: string; icon: React.ReactElement }> =
  desktopNearestTools().map((t) => ({
    kind: t.kind,
    label: t.label,
    icon: NEAREST_ICON[t.kind]
  }));

function PlaceLinks(props: { name: string; address?: string; mapsUrl?: string; reviewsUrl?: string; websiteUrl?: string }): React.ReactElement {
  const { name, address, mapsUrl, reviewsUrl, websiteUrl } = props;
  const mapHref = mapsUrl || placeQueryMapsUrl(name, address);
  const routeHref = placeQueryDirectionsUrl(name, address);
  const reviewsHref = reviewsUrl || googleReviewsSearchUrl([name, address].filter(Boolean).join(' '));
  const siteHref = websiteUrl || placeWebsiteSearchUrl(name, address);
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
      {siteHref ? (
        <a className={styles.placeLinkIcon} href={siteHref} target="_blank" rel="noopener noreferrer" title="Website">
          <LinkIcon />
        </a>
      ) : null}
    </div>
  );
}

function SectionHead(props: {
  sectionKey: SectionKey;
  collapsed: boolean;
  onToggle: (key: SectionKey) => void;
  title: string;
  onRefresh?: () => void;
  onClear?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}): React.ReactElement {
  const { sectionKey, collapsed, onToggle, title, onRefresh, onClear, refreshing, refreshLabel } = props;
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadMain}>
        <button type="button" className={styles.collapseBtn} onClick={() => onToggle(sectionKey)} aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}>
          {collapsed ? '▸' : '▾'}
        </button>
        <h4 className={styles.heading}>{title}</h4>
      </div>
      <div className={styles.sectionActions}>
        {onClear ? (
          <button type="button" className={styles.clearBtn} title={`Clear ${title.toLowerCase()}`} aria-label={`Clear ${title.toLowerCase()}`} onClick={onClear}>
            Clear
          </button>
        ) : null}
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
    </div>
  );
}

export interface LocationInfoPanelContentProps {
  entry: ItineraryEntry;
  readOnly?: boolean;
  /** When true, sections expose data-li-section for mobile jump nav. */
  enableSectionAnchors?: boolean;
}

export const LocationInfoPanelContent: React.FC<LocationInfoPanelContentProps> = ({
  entry,
  readOnly = false,
  enableSectionAnchors = false
}) => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const { updateEntry } = useTripWorkspace();
  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const highlightRowsRef = React.useRef(data ? locationHighlightRows(data) : []);
  const [loadingTool, setLoadingTool] = React.useState<string | null>(null);
  const [toolError, setToolError] = React.useState<string | undefined>();
  const [voiceListening, setVoiceListening] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<SectionKey, boolean>>({
    overview: false,
    highlights: false,
    dining: false,
    pharmacy: false,
    grocery: false,
    fuel: false,
    atm: false,
    medical: false,
    restroom: false,
    transport: false,
    tips: false,
    qa: false
  });

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

  const runVoiceCommand = (): void => {
    if (typeof window === 'undefined') return;
    const Ctor = (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!Ctor) {
      setToolError('Voice commands are not supported in this browser.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-NZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceListening(true);
    recognition.onresult = (event: { results?: Array<{ 0?: { transcript?: string } }> }): void => {
      const text = event.results?.[0]?.[0]?.transcript?.toLowerCase().trim() || '';
      if (!text) return;
      if (text.includes('dining')) {
        runDining(text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('pharmacy')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, pharmacy: [] } });
        else runNearest('pharmacy', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('grocery')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, grocery: [] } });
        else runNearest('grocery', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('fuel')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, fuel: [] } });
        else runNearest('fuel', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('atm')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, atm: [] } });
        else runNearest('atm', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('medical')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, medical: [] } });
        else runNearest('medical', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('restroom') || text.includes('toilet') || text.includes('bathroom')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, restroom: [] } });
        else runNearest('restroom', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('transport') || text.includes('bus') || text.includes('transit')) {
        if (text.includes('clear')) persist({ ...data, nearestPlaces: { ...nearest, transport: [] } });
        else runNearest('transport', text.includes('refresh') || text.includes('regenerate'));
        return;
      }
      if (text.includes('clear dining')) {
        persist({ ...data, diningSuggestions: [] });
        return;
      }
      setToolError('Voice command not recognised. Try "refresh dining", "nearest pharmacy", or "clear grocery".');
    };
    recognition.onerror = (): void => {
      setToolError('Could not capture voice command. Please try again.');
    };
    recognition.onend = (): void => setVoiceListening(false);
    recognition.start();
  };

  const toggleSection = (key: SectionKey): void => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const normalizeDistanceOnly = (text?: string): string | undefined => {
    const raw = (text || '').trim();
    if (!raw) return undefined;
    const m = raw.match(/(\d+(?:\.\d+)?)\s*(km|m)\b/i);
    if (!m) return raw;
    return `${m[1]}${m[2].toLowerCase()}`;
  };
  const displayNearestNote = (kind: NearestPlaceKind, note?: string): string | undefined => {
    if (kind !== 'grocery') return note;
    return normalizeDistanceOnly(note);
  };

  const refreshDiningItem = async (itemId: string): Promise<void> => {
    if (!place || !hasKey || readOnly) return;
    setLoadingTool('dining');
    setToolError(undefined);
    try {
      const ctx = await resolveLocationSearchContext(place);
      if (!ctx) throw new Error('Could not resolve location for dining refresh.');
      const existing = data.diningSuggestions ?? [];
      const target = existing.find((x) => x.id === itemId);
      if (!target) return;
      const { items } = await generateDiningSuggestions({ apiKey: config.geminiApiKey, searchContext: ctx });
      const candidate = items.find((x) => x.name.trim().toLowerCase() !== target.name.trim().toLowerCase()) ?? items[0];
      if (!candidate) return;
      persist({
        ...data,
        diningSuggestions: existing.map((x) => (x.id === itemId ? { ...candidate, id: itemId, done: x.done } : x))
      });
    } catch (err) {
      setToolError(err instanceof Error ? err.message : 'Could not refresh this dining suggestion.');
    } finally {
      setLoadingTool(null);
    }
  };

  const refreshNearestItem = async (kind: NearestPlaceKind, itemId: string): Promise<void> => {
    if (!place || !hasKey || readOnly) return;
    setLoadingTool(kind);
    setToolError(undefined);
    try {
      const ctx = await resolveLocationSearchContext(place);
      if (!ctx) throw new Error('Could not resolve location for nearest refresh.');
      const rows = nearest[kind] ?? [];
      const target = rows.find((x) => x.id === itemId);
      if (!target) return;
      const { places } = await generateNearestPlaces(kind, { apiKey: config.geminiApiKey, searchContext: ctx });
      const candidate = places.find((x) => x.name.trim().toLowerCase() !== target.name.trim().toLowerCase()) ?? places[0];
      if (!candidate) return;
      persist({
        ...data,
        nearestPlaces: {
          ...nearest,
          [kind]: rows.map((x) => (x.id === itemId ? { ...candidate, id: itemId } : x))
        }
      });
    } catch (err) {
      setToolError(err instanceof Error ? err.message : 'Could not refresh this nearest place.');
    } finally {
      setLoadingTool(null);
    }
  };

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
          <button
            type="button"
            className={`${styles.toolBtn} ${voiceListening ? styles.toolBtnLoading : ''}`}
            title="Voice command for AI helpers"
            aria-label="Voice command for AI helpers"
            disabled={!hasKey || loadingTool !== null}
            onClick={runVoiceCommand}
          >
            🎙
          </button>
        </div>
      ) : null}
      {!hasKey && !readOnly ? (
        <p className={styles.keyHint}>Add a Gemini API key in User settings to use dining and nearest-place tools.</p>
      ) : null}
      {toolError ? <p className={styles.toolError}>{toolError}</p> : null}
      {data.aiError?.trim() ? <p className={styles.toolError}>{data.aiError.trim()}</p> : null}

      {data.overview.trim() ? (
        <section className={styles.section} {...(enableSectionAnchors ? { 'data-li-section': 'overview' } : {})}>
          <SectionHead sectionKey="overview" collapsed={Boolean(collapsed.overview)} onToggle={toggleSection} title="Overview" />
          {!collapsed.overview ? (
            <div className={styles.sectionBody}>
              <div className={styles.overview}>
                <RichTextContent html={data.overview.trim()} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.section} {...(enableSectionAnchors ? { 'data-li-section': 'highlights' } : {})}>
        <SectionHead sectionKey="highlights" collapsed={Boolean(collapsed.highlights)} onToggle={toggleSection} title="Highlights" />
        {!collapsed.highlights ? (
          <div className={styles.sectionBody}>
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
          </div>
        ) : null}
      </section>

      {dining.length || !readOnly ? (
        <section className={styles.section} {...(enableSectionAnchors ? { 'data-li-section': 'food' } : {})}>
          <SectionHead
            sectionKey="dining"
            collapsed={Boolean(collapsed.dining)}
            onToggle={toggleSection}
            title="Dining suggestions"
            refreshLabel="Refresh dining suggestions"
            refreshing={loadingTool === 'dining'}
            onRefresh={dining.length && !readOnly && hasKey ? () => runDining(true) : undefined}
            onClear={!readOnly && dining.length ? () => persist({ ...data, diningSuggestions: [] }) : undefined}
          />
          {!collapsed.dining ? dining.length ? (
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
                    <PlaceLinks name={row.name} mapsUrl={row.mapsUrl} reviewsUrl={row.reviewsUrl} websiteUrl={row.websiteUrl} />
                  </div>
                  <div className={styles.placeMetaRow}>
                    {row.priceLevel ? <span className={styles.chip}>{row.priceLevel}</span> : null}
                    {typeof row.rating === 'number' ? (
                      <span className={styles.chip}>
                        <span className={styles.ratingValue}>★ {row.rating.toFixed(1)}</span>
                        {row.ratingSource ? ` · ${row.ratingSource}` : ''}
                      </span>
                    ) : null}
                  </div>
                  {row.description ? <p className={styles.placeDesc}>{row.description}</p> : null}
                  {row.why ? <p className={styles.placeWhy}>{row.why}</p> : null}
                  {row.bestFor ? <p className={styles.placeBestFor}>Best for: {row.bestFor}</p> : null}
                  {!readOnly ? (
                    <div className={styles.itemActions}>
                      <button type="button" className={styles.itemIconBtn} title="Refresh this suggestion" onClick={() => void refreshDiningItem(row.id)}>
                        <RefreshIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.itemIconBtn}
                        title="Delete this suggestion"
                        onClick={() =>
                          persist({
                            ...data,
                            diningSuggestions: dining.filter((x) => x.id !== row.id)
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyHint}>Tap the dining icon above to generate suggestions.</p>
          ) : null}
        </section>
      ) : null}

      {NEAREST_TOOLS.map((tool) => {
        const rows = nearest[tool.kind] ?? [];
        if (!rows.length) return null;
        return (
          <section
            key={tool.kind}
            className={styles.section}
            {...(enableSectionAnchors ? { 'data-li-section': tool.kind } : {})}
          >
            <SectionHead
              sectionKey={tool.kind}
              collapsed={Boolean(collapsed[tool.kind])}
              onToggle={toggleSection}
              title={tool.label}
              refreshLabel={`Refresh ${tool.label.toLowerCase()}`}
              refreshing={loadingTool === tool.kind}
              onRefresh={!readOnly && hasKey ? () => runNearest(tool.kind, true) : undefined}
              onClear={!readOnly && rows.length ? () => persist({ ...data, nearestPlaces: { ...nearest, [tool.kind]: [] } }) : undefined}
            />
            {!collapsed[tool.kind] ? (
              <ul className={styles.cardList}>
                {rows.map((row: NearestPlaceRow) => (
                  <li key={row.id} className={styles.placeCard}>
                    <div className={styles.placeCardTop}>
                      <span className={styles.placeName}>{row.name}</span>
                      <PlaceLinks name={row.name} address={row.address} mapsUrl={row.mapsUrl} reviewsUrl={row.reviewsUrl} websiteUrl={row.websiteUrl} />
                    </div>
                    {displayNearestNote(tool.kind, row.note) ? <p className={styles.placeDesc}>{displayNearestNote(tool.kind, row.note)}</p> : null}
                    {row.servicesSummary ? <p className={styles.placeBestFor}>Services: {row.servicesSummary}</p> : null}
                    {row.address ? <p className={styles.placeWhy}>{row.address}</p> : null}
                    {!readOnly ? (
                      <div className={styles.itemActions}>
                        <button type="button" className={styles.itemIconBtn} title="Refresh this place" onClick={() => void refreshNearestItem(tool.kind, row.id)}>
                          <RefreshIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.itemIconBtn}
                          title="Delete this place"
                          onClick={() =>
                            persist({
                              ...data,
                              nearestPlaces: {
                                ...nearest,
                                [tool.kind]: rows.filter((x) => x.id !== row.id)
                              }
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      {data.practicalTips.trim() ? (
        <section className={styles.section} {...(enableSectionAnchors ? { 'data-li-section': 'notes' } : {})}>
          <SectionHead sectionKey="tips" collapsed={Boolean(collapsed.tips)} onToggle={toggleSection} title="Practical tips" />
          {!collapsed.tips ? <p className={styles.overview}>{data.practicalTips.trim()}</p> : null}
        </section>
      ) : null}

      <div {...(enableSectionAnchors ? { 'data-li-section': 'ask' } : {})}>
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
    </div>
  );
};

export function LocationInfoStripPinIcon(): React.ReactElement {
  return <PinIcon />;
}
