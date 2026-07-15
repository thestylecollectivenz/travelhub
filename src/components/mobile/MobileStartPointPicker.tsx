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
  const seedLabel = (initialLabel || '').trim() || shortCoordLabel(initialLat, initialLng);
  const [selected, setSelected] = React.useState<StartPointSelection>(() => ({
    lat: initialLat,
    lng: initialLng,
    label: seedLabel
  }));
  const [resolving, setResolving] = React.useState(false);

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
          Current selection is marked below — tap the map to choose a new starting point
        </p>
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
