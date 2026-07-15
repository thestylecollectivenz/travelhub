import * as React from 'react';
import * as ReactDOM from 'react-dom';
import L from 'leaflet';
import '../maps/LeafletCompat.css';
import { useShellMode } from '../../hooks/useShellMode';
import { nominatimFetch } from '../../utils/nominatimThrottle';
import styles from './MobileResultsMapSheet.module.css';

export type ResultsMapPlace = {
  id: string;
  name: string;
  address?: string;
  mapsUrl?: string;
};

export interface MobileResultsMapSheetProps {
  title: string;
  centre: { lat: number; lng: number; label?: string };
  places: ResultsMapPlace[];
  locality?: string;
  onClose: () => void;
}

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function parseCoordsFromMapsUrl(url?: string): { lat: number; lng: number } | undefined {
  const u = (url || '').trim();
  if (!u) return undefined;
  const at = u.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }
  const q = u.match(/[?&](?:q|query)=(-?\d+\.?\d*)%2C(-?\d+\.?\d*)/i) || u.match(/[?&](?:q|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (q) {
    const lat = Number(q[1]);
    const lng = Number(q[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }
  return undefined;
}

async function geocodePlace(name: string, address?: string, locality?: string): Promise<{ lat: number; lng: number } | undefined> {
  const q = [name, address, locality].filter(Boolean).join(', ');
  if (!q.trim()) return undefined;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!isValid(lat, lng)) return undefined;
    return { lat, lng };
  } catch {
    return undefined;
  }
}

export const MobileResultsMapSheet: React.FC<MobileResultsMapSheetProps> = ({
  title,
  centre,
  places,
  locality,
  onClose
}) => {
  const shellMode = useShellMode();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = React.useState('Placing pins…');

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || !isValid(centre.lat, centre.lng)) return undefined;

    const map = L.map(el, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    map.setView([centre.lat, centre.lng], 14);

    const start = L.circleMarker([centre.lat, centre.lng], {
      radius: 10,
      color: '#fff',
      weight: 2,
      fillColor: '#c45c3a',
      fillOpacity: 1
    })
      .addTo(map)
      .bindPopup(centre.label || 'Starting point');
    start.openPopup();

    const bounds = L.latLngBounds([[centre.lat, centre.lng]]);
    let cancelled = false;

    void (async () => {
      let pinned = 0;
      for (const place of places.slice(0, 12)) {
        if (cancelled) return;
        const fromUrl = parseCoordsFromMapsUrl(place.mapsUrl);
        const coords = fromUrl || (await geocodePlace(place.name, place.address, locality));
        if (!coords || cancelled) continue;
        L.circleMarker([coords.lat, coords.lng], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#2f5eb8',
          fillOpacity: 1
        })
          .addTo(map)
          .bindPopup(place.name);
        bounds.extend([coords.lat, coords.lng]);
        pinned += 1;
      }
      if (cancelled) return;
      if (pinned > 0) {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
        setStatus(`${pinned} places on map`);
      } else {
        setStatus('Could not place result pins — showing search centre');
      }
      window.setTimeout(() => map.invalidateSize(), 60);
    })();

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      map.remove();
    };
  }, [centre.lat, centre.lng, centre.label, places, locality]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role="presentation" data-shell={shellAttr}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose}>
            ‹ Back
          </button>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.spacer} aria-hidden />
        </header>
        <p className={styles.status}>{status}</p>
        <div className={styles.mapHost} ref={hostRef} />
      </div>
    </div>,
    document.body
  );
};
