import * as React from 'react';
import L from 'leaflet';
import '../maps/LeafletCompat.css';
import styles from './MobileItinerary.module.css';

export interface MobileDayMapSnippetProps {
  /** Primary overnight / day place. */
  latitude?: number;
  longitude?: number;
  label?: string;
  /** Optional route points for the day (timed stops with coords). */
  routePoints?: Array<{ lat: number; lng: number; label?: string }>;
  mapsHref: string;
}

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
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

/** Compact Leaflet map for the day itinerary — route when possible, else primary place zoomed out. */
export const MobileDayMapSnippet: React.FC<MobileDayMapSnippetProps> = ({
  latitude,
  longitude,
  label,
  routePoints = [],
  mapsHref
}) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  const validRoute = React.useMemo(
    () => routePoints.filter((p) => isValid(p.lat, p.lng)),
    [routePoints]
  );
  const hasPrimary = typeof latitude === 'number' && typeof longitude === 'number' && isValid(latitude, longitude);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el || (!hasPrimary && !validRoute.length)) return undefined;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });
    mapRef.current = map;
    addTiles(map);

    const layer = L.layerGroup().addTo(map);
    if (validRoute.length >= 2) {
      const latlngs = validRoute.map((p) => L.latLng(p.lat, p.lng));
      L.polyline(latlngs, { color: '#3d5a80', weight: 3, opacity: 0.85, dashArray: '6 6' }).addTo(layer);
      validRoute.forEach((p, i) => {
        L.circleMarker(latlngs[i], {
          radius: i === 0 || i === validRoute.length - 1 ? 6 : 4,
          color: '#fff',
          weight: 2,
          fillColor: '#c45c3a',
          fillOpacity: 1
        })
          .bindTooltip(p.label || '', { permanent: false })
          .addTo(layer);
      });
      map.fitBounds(L.latLngBounds(latlngs), { padding: [18, 18], maxZoom: 13 });
    } else if (hasPrimary) {
      const ll = L.latLng(latitude!, longitude!);
      L.circleMarker(ll, {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: '#c45c3a',
        fillOpacity: 1
      }).addTo(layer);
      // Zoomed out a bit so the place sits in context (not street-level).
      map.setView(ll, 11);
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [hasPrimary, latitude, longitude, validRoute]);

  if (!hasPrimary && !validRoute.length) {
    return (
      <a className={styles.mapSnippet} href={mapsHref} target="_blank" rel="noopener noreferrer">
        <div className={styles.mapSnippetRoute}>
          <span className={styles.mapDot} />
          <span className={styles.mapLine} />
          <span className={styles.mapDot} />
        </div>
        <div>
          <p className={styles.mapSnippetLabel}>{label || 'Day map'}</p>
          <p className={styles.mapSnippetMeta}>Open in Maps</p>
        </div>
      </a>
    );
  }

  return (
    <a
      className={styles.mapSnippetLive}
      href={mapsHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open map for ${label || 'this day'}`}
    >
      <div ref={hostRef} className={styles.mapSnippetCanvas} />
      <div className={styles.mapSnippetOverlay}>
        <p className={styles.mapSnippetLabel}>{label || 'Day map'}</p>
        <p className={styles.mapSnippetMeta}>
          {validRoute.length >= 2 ? 'Day route' : 'Primary place'} · Open in Maps
        </p>
      </div>
    </a>
  );
};
