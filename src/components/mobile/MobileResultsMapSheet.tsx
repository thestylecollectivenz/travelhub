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

export type ResultsMapStart = {
  lat: number;
  lng: number;
  label?: string;
};

export interface MobileResultsMapSheetProps {
  title: string;
  centre: ResultsMapStart;
  /** Extra starting points (e.g. accommodation + custom pin). */
  starts?: ResultsMapStart[];
  places: ResultsMapPlace[];
  locality?: string;
  onClose: () => void;
}

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const q =
    u.match(/[?&](?:q|query)=(-?\d+\.?\d*)%2C(-?\d+\.?\d*)/i) ||
    u.match(/[?&](?:q|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/i) ||
    u.match(/\/search\/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i) ||
    u.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (q) {
    const lat = Number(q[1]);
    const lng = Number(q[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }
  return undefined;
}

async function geocodePlace(
  name: string,
  address?: string,
  locality?: string
): Promise<{ lat: number; lng: number } | undefined> {
  const attempts = [
    [name, address, locality].filter(Boolean).join(', '),
    [name, locality].filter(Boolean).join(', '),
    name
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  for (const q of attempts) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) continue;
      const data = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
      const hit = data[0];
      const lat = Number(hit?.lat);
      const lng = Number(hit?.lon);
      if (isValid(lat, lng)) return { lat, lng };
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function addLabeledMarker(
  map: L.Map,
  lat: number,
  lng: number,
  label: string,
  kind: 'start' | 'place'
): L.Marker {
  const color = kind === 'start' ? '#c45c3a' : '#2f5eb8';
  const icon = L.divIcon({
    className: styles.pinWrap,
    html: `<div class="${styles.pin}"><span class="${styles.pinDot}" style="background:${color}"></span><span class="${styles.pinLabel}">${escapeHtml(label)}</span></div>`,
    iconSize: [160, 28],
    iconAnchor: [8, 14]
  });
  return L.marker([lat, lng], { icon, zIndexOffset: kind === 'start' ? 600 : 400 })
    .addTo(map)
    .bindPopup(label);
}

function uniqueStarts(centre: ResultsMapStart, starts?: ResultsMapStart[]): ResultsMapStart[] {
  const out: ResultsMapStart[] = [];
  const seen = new Set<string>();
  const add = (s: ResultsMapStart | undefined): void => {
    if (!s || !isValid(s.lat, s.lng)) return;
    const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  add(centre);
  for (const s of starts || []) add(s);
  return out;
}

export const MobileResultsMapSheet: React.FC<MobileResultsMapSheetProps> = ({
  title,
  centre,
  starts,
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

    const startPoints = uniqueStarts(centre, starts);
    const bounds = L.latLngBounds(startPoints.map((s) => [s.lat, s.lng] as [number, number]));
    for (const s of startPoints) {
      addLabeledMarker(map, s.lat, s.lng, s.label || 'Starting point', 'start');
    }

    let cancelled = false;

    void (async () => {
      let pinned = 0;
      let failed = 0;
      const total = places.length;
      for (let i = 0; i < places.length; i++) {
        if (cancelled) return;
        const place = places[i];
        setStatus(`Placing pins… ${i + 1}/${total}`);
        const fromUrl = parseCoordsFromMapsUrl(place.mapsUrl);
        const coords = fromUrl || (await geocodePlace(place.name, place.address, locality));
        if (!coords || cancelled) {
          if (!coords) failed += 1;
          continue;
        }
        addLabeledMarker(map, coords.lat, coords.lng, place.name, 'place');
        bounds.extend([coords.lat, coords.lng]);
        pinned += 1;
        if (pinned === 1 || pinned % 2 === 0) {
          map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
        }
      }
      if (cancelled) return;
      if (pinned > 0) {
        map.fitBounds(bounds.pad(0.22), { maxZoom: 15 });
        setStatus(
          `${pinned} place${pinned === 1 ? '' : 's'} · ${startPoints.length} start pin${
            startPoints.length === 1 ? '' : 's'
          }${failed ? ` · ${failed} could not be located` : ''}`
        );
      } else {
        setStatus(
          failed
            ? `Could not place result pins (${failed}) — showing starting point${startPoints.length > 1 ? 's' : ''}`
            : 'Showing starting point'
        );
      }
      window.setTimeout(() => map.invalidateSize(), 60);
    })();

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      map.remove();
    };
  }, [centre.lat, centre.lng, centre.label, starts, places, locality]);

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
