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

async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      name?: string;
      display_name?: string;
      address?: { tourism?: string; amenity?: string; road?: string; suburb?: string; city?: string };
    };
    const a = data.address;
    const named = data.name || a?.tourism || a?.amenity;
    if (named) return named;
    if (a?.road && a?.suburb) return `${a.road}, ${a.suburb}`;
    if (a?.road) return a.road;
    if (a?.city) return a.city;
    const display = (data.display_name || '').split(',').slice(0, 2).join(',').trim();
    return display || undefined;
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
  const [selected, setSelected] = React.useState<StartPointSelection>(() => ({
    lat: initialLat,
    lng: initialLng,
    label: (initialLabel || '').trim() || 'Selected point'
  }));
  const [resolving, setResolving] = React.useState(false);

  const placeMarker = React.useCallback((map: L.Map, lat: number, lng: number): void => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }
    markerRef.current = L.circleMarker([lat, lng], {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: '#c45c3a',
      fillOpacity: 1
    }).addTo(map);
  }, []);

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
    map.setView([initialLat, initialLng], 14);
    placeMarker(map, initialLat, initialLng);

    const onClick = (ev: L.LeafletMouseEvent): void => {
      const { lat, lng } = ev.latlng;
      placeMarker(map, lat, lng);
      setSelected({ lat, lng, label: shortCoordLabel(lat, lng) });
      setResolving(true);
      void reverseGeocode(lat, lng).then((label) => {
        setSelected((prev) => ({
          lat,
          lng,
          label: label || prev.label || 'Selected point'
        }));
        setResolving(false);
      });
    };
    map.on('click', onClick);
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [initialLat, initialLng, placeMarker]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

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
        <p className={styles.instruction}>Tap the map to set your search starting point</p>
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
