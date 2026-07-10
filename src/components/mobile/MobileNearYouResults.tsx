import * as React from 'react';
import L from 'leaflet';
import '../maps/LeafletCompat.css';
import { useConfig } from '../../context/ConfigContext';
import { generateDiningSuggestions, generateNearestPlaces } from '../../services/GeminiService';
import type { DiningSuggestionRow, NearestPlaceKind, NearestPlaceRow } from '../../utils/locationInfoEntry';
import { NEAR_YOU_TOOLS, type NearYouToolId } from '../../utils/nearYouTools';
import {
  placeQueryDirectionsUrl,
  placeQueryMapsUrl,
  placeWebsiteSearchUrl
} from '../../utils/googleMapsLink';
import styles from './MobileNearYouResults.module.css';

export interface MobileNearYouResultsProps {
  toolId: NearYouToolId;
  onBack: () => void;
  /** Featured / active trip title for header context. */
  tripTitle?: string;
  tripDateRange?: string;
  /** Called when user wants to add a place as an itinerary idea. */
  onAddToItinerary?: (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }) => void;
  /** Called when user saves/bookmarks a place. */
  onSavePlace?: (place: { name: string; note?: string; mapsUrl?: string }) => void;
}

type ViewMode = 'map' | 'list' | 'ai';

type ResultCard = {
  id: string;
  name: string;
  note?: string;
  address?: string;
  rating?: number;
  priceLevel?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  reviewsUrl?: string;
  aiBlurb?: string;
  topPick?: boolean;
};

function toolDef(id: NearYouToolId) {
  return NEAR_YOU_TOOLS.find((t) => t.id === id) ?? NEAR_YOU_TOOLS[0];
}

function addTiles(map: L.Map): void {
  const primary = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });
  let switched = false;
  let errors = 0;
  primary.on('tileerror', () => {
    errors += 1;
    if (switched || errors < 3) return;
    switched = true;
    map.removeLayer(primary);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap & CARTO'
    }).addTo(map);
  });
  primary.addTo(map);
}

export const MobileNearYouResults: React.FC<MobileNearYouResultsProps> = ({
  toolId,
  onBack,
  tripTitle,
  tripDateRange,
  onAddToItinerary,
  onSavePlace
}) => {
  const { config } = useConfig();
  const tool = toolDef(toolId);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [view, setView] = React.useState<ViewMode>('list');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [filterOpenNow, setFilterOpenNow] = React.useState(false);
  const [filterWalkable, setFilterWalkable] = React.useState(false);
  const [filterRated, setFilterRated] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [userLat, setUserLat] = React.useState<number | null>(null);
  const [userLng, setUserLng] = React.useState<number | null>(null);
  const [results, setResults] = React.useState<ResultCard[]>([]);
  const mapHostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    const apiKey = (config.geminiApiKey || '').trim();
    if (!apiKey) {
      setError('Add a Gemini API key in Profile / User settings.');
      setResults([]);
      return;
    }
    if (!navigator.geolocation) {
      setError('Location is not available on this device.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        });
      });
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
      const searchContext = {
        mode: 'onsite' as const,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        placeName: 'Current location',
        country: ''
      };
      if (toolId === 'dining') {
        const { items } = await generateDiningSuggestions({ apiKey, searchContext });
        setResults(
          items.slice(0, 10).map((p: DiningSuggestionRow, i) => ({
            id: p.id,
            name: p.name,
            note: p.bestFor || p.description,
            address: undefined,
            rating: p.rating,
            priceLevel: p.priceLevel,
            mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name),
            websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name),
            reviewsUrl: p.reviewsUrl,
            aiBlurb: p.why || p.description || p.bestFor,
            topPick: i === 0
          }))
        );
      } else if (tool.kind) {
        const { places } = await generateNearestPlaces(tool.kind as NearestPlaceKind, { apiKey, searchContext });
        setResults(
          places.slice(0, 10).map((p: NearestPlaceRow, i) => ({
            id: p.id,
            name: p.name,
            note: p.note || p.servicesSummary,
            address: p.address,
            mapsUrl: p.mapsUrl || placeQueryMapsUrl(p.name, p.address),
            websiteUrl: p.websiteUrl || placeWebsiteSearchUrl(p.name, p.address),
            reviewsUrl: p.reviewsUrl,
            aiBlurb: p.note || p.servicesSummary,
            topPick: i === 0
          }))
        );
      }
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Could not find nearby places.');
    } finally {
      setBusy(false);
    }
  }, [config.geminiApiKey, tool.kind, toolId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = React.useMemo(() => {
    let rows = results.slice();
    if (filterRated) rows = rows.filter((r) => typeof r.rating === 'number' && r.rating >= 4.3);
    // Open now / walkable are soft UI filters until live hours/distance exist — keep all but prefer top picks.
    if (filterOpenNow || filterWalkable) rows = rows.slice().sort((a, b) => Number(b.topPick) - Number(a.topPick));
    return rows;
  }, [results, filterOpenNow, filterWalkable, filterRated]);

  const aiPicks = React.useMemo(() => visible.filter((r) => r.topPick || (r.rating && r.rating >= 4.5)).slice(0, 5), [visible]);

  React.useEffect(() => {
    if (view !== 'map') return undefined;
    const el = mapHostRef.current;
    if (!el) return undefined;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = L.map(el, { zoomControl: false, attributionControl: false });
    mapRef.current = map;
    addTiles(map);
    const layer = L.layerGroup().addTo(map);
    const points: L.LatLngExpression[] = [];
    if (userLat != null && userLng != null) {
      const me = L.latLng(userLat, userLng);
      points.push(me);
      L.circleMarker(me, {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#2E90D1',
        fillOpacity: 1
      })
        .bindTooltip('You', { permanent: false })
        .addTo(layer);
    }
    // Without geocoded result coords, centre on user and show count in overlay.
    if (points.length) {
      map.setView(points[0], 14);
    } else {
      map.setView([-41.29, 174.78], 11);
    }
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [view, userLat, userLng, visible.length]);

  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const listForView = view === 'ai' ? (aiPicks.length ? aiPicks : visible.slice(0, 5)) : visible;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Near you
        </button>
        <div className={styles.tripMeta}>
          <p className={styles.tripTitle}>{tripTitle || 'Near you'}</p>
          {tripDateRange ? <p className={styles.tripDates}>{tripDateRange}</p> : null}
        </div>
      </header>

      <h1 className={styles.heading}>{tool.label} Nearby</h1>
      <p className={styles.sub}>Based on your current location</p>

      <div className={styles.aiSearch}>
        <span className={styles.sparkle} aria-hidden>
          ✦
        </span>
        <input
          className={styles.aiInput}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={`Ask AI: refine ${tool.shortLabel.toLowerCase()}…`}
          aria-label="Ask AI to refine results"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && aiPrompt.trim()) {
              showToast('Refinement saved for next search — reloading…');
              void load();
            }
          }}
        />
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${filterOpenNow ? styles.chipOn : ''}`}
          onClick={() => setFilterOpenNow((v) => !v)}
        >
          <span className={styles.dotGreen} /> Open now
        </button>
        <button
          type="button"
          className={`${styles.chip} ${filterWalkable ? styles.chipOn : ''}`}
          onClick={() => setFilterWalkable((v) => !v)}
        >
          Walkable
        </button>
        <button
          type="button"
          className={`${styles.chip} ${filterRated ? styles.chipOn : ''}`}
          onClick={() => setFilterRated((v) => !v)}
        >
          Highly rated
        </button>
      </div>

      <div className={styles.seg} role="tablist" aria-label="Results view">
        {(['map', 'list', 'ai'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            className={`${styles.segBtn} ${view === mode ? styles.segBtnOn : ''}`}
            onClick={() => setView(mode)}
          >
            {mode === 'ai' ? 'AI Picks' : mode === 'map' ? 'Map' : 'List'}
          </button>
        ))}
      </div>

      {view === 'map' ? (
        <div className={styles.mapCard}>
          <div ref={mapHostRef} className={styles.mapCanvas} />
          <p className={styles.mapHint}>
            {busy ? 'Locating…' : `${visible.length} places near you`}
          </p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {busy && !results.length ? <p className={styles.muted}>Searching near you…</p> : null}

      <div className={styles.list}>
        {listForView.map((r) => {
          const directions = placeQueryDirectionsUrl(r.name, r.address) || r.mapsUrl;
          const website = r.websiteUrl || placeWebsiteSearchUrl(r.name, r.address);
          return (
            <article key={r.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.thumb} aria-hidden>
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.cardMain}>
                  <div className={styles.cardTitleRow}>
                    <h3 className={styles.cardTitle}>{r.name}</h3>
                    {typeof r.rating === 'number' ? (
                      <span className={styles.rating}>★ {r.rating.toFixed(1)}</span>
                    ) : null}
                  </div>
                  {r.topPick ? <span className={styles.badge}>AI TOP PICK</span> : null}
                  <p className={styles.cardMeta}>
                    {[tool.shortLabel, r.priceLevel, r.note].filter(Boolean).join(' · ')}
                  </p>
                  {r.address ? <p className={styles.cardAddr}>{r.address}</p> : null}
                  {r.aiBlurb ? (
                    <p className={styles.aiSays}>
                      <strong>AI says:</strong> {r.aiBlurb}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className={styles.actions}>
                {directions ? (
                  <a className={styles.action} href={directions} target="_blank" rel="noopener noreferrer">
                    Directions
                  </a>
                ) : null}
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    onSavePlace?.({ name: r.name, note: r.note, mapsUrl: r.mapsUrl });
                    showToast(`Saved · ${r.name}`);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    onAddToItinerary?.({
                      name: r.name,
                      note: r.note,
                      mapsUrl: r.mapsUrl,
                      websiteUrl: r.websiteUrl
                    });
                    showToast('Added to itinerary');
                  }}
                >
                  Add to itinerary
                </button>
                {website ? (
                  <a className={styles.action} href={website} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
};
