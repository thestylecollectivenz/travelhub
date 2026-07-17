import * as React from 'react';
import * as ReactDOM from 'react-dom';
import L from 'leaflet';
import '../maps/LeafletCompat.css';
import { nominatimFetch } from '../../utils/nominatimThrottle';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobileStartPointPicker.module.css';

export type StartPointSelection = {
  lat: number;
  lng: number;
  label: string;
};

export interface MobileStartPointPickerProps {
  initialLat: number;
  initialLng: number;
  initialLabel?: string;
  onConfirm: (point: StartPointSelection) => void;
  onCancel: () => void;
}

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function shortCoordLabel(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function labelWithCountry(
  placeName: string | undefined,
  displayName: string | undefined,
  country: string | undefined,
  fallback: string
): string {
  const place =
    (placeName || '').trim() ||
    (displayName || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    '';
  const c = (country || '').trim() ||
    (displayName || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-1)[0] ||
    '';
  if (place && c && !place.toLowerCase().includes(c.toLowerCase())) return `${place}, ${c}`;
  if (place) return place;
  if (c) return c;
  return fallback;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      name?: string;
      display_name?: string;
      address?: {
        tourism?: string;
        amenity?: string;
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        country?: string;
      };
    };
    const a = data.address;
    const named = data.name || a?.tourism || a?.amenity || a?.road || a?.city || a?.town || a?.village;
    return labelWithCountry(named, data.display_name, a?.country, shortCoordLabel(lat, lng));
  } catch {
    return undefined;
  }
}

function addTiles(map: L.Map): void {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}

export const MobileStartPointPicker: React.FC<MobileStartPointPickerProps> = ({
  initialLat,
  initialLng,
  initialLabel,
  onConfirm,
  onCancel
}) => {
  const shellMode = useShellMode();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.CircleMarker | null>(null);
  const seedLabel = (initialLabel || '').trim() || shortCoordLabel(initialLat, initialLng);
  const [selected, setSelected] = React.useState<StartPointSelection>(() => ({
    lat: initialLat,
    lng: initialLng,
    label: seedLabel
  }));
  const [resolving, setResolving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [searchHits, setSearchHits] = React.useState<Array<{ lat: number; lng: number; label: string }>>([]);

  const placeMarker = React.useCallback((map: L.Map, lat: number, lng: number, label: string): void => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.bindPopup(label).openPopup();
      return;
    }
    markerRef.current = L.circleMarker([lat, lng], {
      radius: 12,
      color: '#fff',
      weight: 3,
      fillColor: '#c45c3a',
      fillOpacity: 1
    })
      .addTo(map)
      .bindPopup(label);
    markerRef.current.openPopup();
  }, []);

  React.useEffect(() => {
    setSelected({
      lat: initialLat,
      lng: initialLng,
      label: (initialLabel || '').trim() || shortCoordLabel(initialLat, initialLng)
    });
  }, [initialLat, initialLng, initialLabel]);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || !isValid(initialLat, initialLng)) return undefined;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
    const map = L.map(el, { zoomControl: true, attributionControl: false });
    mapRef.current = map;
    addTiles(map);
    const label = (initialLabel || '').trim() || shortCoordLabel(initialLat, initialLng);
    map.setView([initialLat, initialLng], 16);
    placeMarker(map, initialLat, initialLng, label);

    const onClick = (ev: L.LeafletMouseEvent): void => {
      const { lat, lng } = ev.latlng;
      const temp = shortCoordLabel(lat, lng);
      placeMarker(map, lat, lng, temp);
      setSelected({ lat, lng, label: temp });
      setResolving(true);
      void reverseGeocode(lat, lng).then((nextLabel) => {
        const finalLabel = nextLabel || temp;
        placeMarker(map, lat, lng, finalLabel);
        setSelected({ lat, lng, label: finalLabel });
        setResolving(false);
      });
    };
    map.on('click', onClick);

    // Portal layout often needs a delayed resize so the initial pin is visible.
    const t1 = window.setTimeout(() => {
      map.invalidateSize();
      map.setView([initialLat, initialLng], 16);
      placeMarker(map, initialLat, initialLng, label);
    }, 120);
    const t2 = window.setTimeout(() => {
      map.invalidateSize();
      map.setView([initialLat, initialLng], 16);
    }, 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [initialLat, initialLng, initialLabel, placeMarker]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const applyHit = (hit: { lat: number; lng: number; label: string }): void => {
    const map = mapRef.current;
    if (map) {
      map.setView([hit.lat, hit.lng], 16);
      placeMarker(map, hit.lat, hit.lng, hit.label);
    }
    setSelected(hit);
    setSearchHits([]);
    setSearchError('');
  };

  const runSearch = async (): Promise<void> => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchBusy(true);
    setSearchError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;
      const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) throw new Error('Search failed');
      const data = (await resp.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
        name?: string;
        address?: { country?: string; city?: string; town?: string; village?: string };
      }>;
      const hits = data
        .map((row) => {
          const lat = Number(row.lat);
          const lng = Number(row.lon);
          if (!isValid(lat, lng)) return null;
          const label = labelWithCountry(
            row.name || row.address?.city || row.address?.town || row.address?.village,
            row.display_name,
            row.address?.country,
            shortCoordLabel(lat, lng)
          );
          return { lat, lng, label };
        })
        .filter((h): h is { lat: number; lng: number; label: string } => Boolean(h));
      setSearchHits(hits);
      if (!hits.length) setSearchError('No places found — try a different search.');
      else if (hits.length === 1) applyHit(hits[0]);
    } catch {
      setSearchHits([]);
      setSearchError('Search unavailable right now.');
    } finally {
      setSearchBusy(false);
    }
  };

  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role="presentation" data-shell={shellAttr}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Change starting point">
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onCancel}>
            ‹ Back
          </button>
          <h2 className={styles.title}>Starting point</h2>
          <span className={styles.headerSpacer} aria-hidden />
        </header>
        <p className={styles.instruction}>
          Search for a place or tap the map to choose a new starting point
        </p>
        <form
          className={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a place or address"
            aria-label="Search starting point"
          />
          <button type="submit" className={styles.searchBtn} disabled={searchBusy || !searchQuery.trim()}>
            {searchBusy ? '…' : 'Find'}
          </button>
        </form>
        {searchError ? <p className={styles.searchError}>{searchError}</p> : null}
        {searchHits.length ? (
          <ul className={styles.searchHits} role="listbox" aria-label="Search results">
            {searchHits.map((hit) => (
              <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
                <button
                  type="button"
                  className={styles.searchHit}
                  onClick={() => applyHit(hit)}
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.mapHost} ref={hostRef} />
        <div className={styles.footer}>
          <p className={styles.selectedLabel}>
            {resolving ? 'Looking up place…' : selected.label}
          </p>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => onConfirm(selected)}
            disabled={!isValid(selected.lat, selected.lng)}
          >
            Use this location
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
