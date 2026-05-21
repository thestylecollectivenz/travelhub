import * as React from 'react';
import L from 'leaflet';
import './LeafletCompat.css';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { parseAdditionalPlaceRefs } from '../../utils/tripDayPlaces';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { TRAVELHUB_MAP_FOCUS, type MapFocusDetail } from '../../utils/mapFocus';
import styles from './TripMap.module.css';

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortMapLabel(title: string): string {
  const t = (title || '').split(',')[0].trim();
  return t.length > 24 ? `${t.slice(0, 22)}…` : t;
}

type RouteMarker = {
  id: string;
  placeId: string;
  title: string;
  latitude: number;
  longitude: number;
  dayNumber: number;
  isPrimary: boolean;
};

function isValidLatLng(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function addResilientTileLayer(map: L.Map): void {
  const primary = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  });
  let switched = false;
  let tileErrors = 0;
  primary.on('tileerror', () => {
    tileErrors += 1;
    if (switched || tileErrors < 4) return;
    switched = true;
    map.removeLayer(primary);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
  });
  primary.addTo(map);
}

export const TripMap: React.FC = () => {
  const { trip, tripDays } = useTripWorkspace();
  const { placeById } = usePlaces();
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);
  const layerGroupRef = React.useRef<L.LayerGroup | null>(null);
  const polylineGroupRef = React.useRef<L.LayerGroup | null>(null);
  const initStartedRef = React.useRef(false);
  const layerRunRef = React.useRef(0);
  const [mapBoot, setMapBoot] = React.useState(0);
  const [lastMarkers, setLastMarkers] = React.useState<RouteMarker[]>([]);

  const fitMapToPoints = React.useCallback((map: L.Map, points: L.LatLngExpression[]): void => {
    if (!points.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    try {
      map.fitBounds(L.latLngBounds(points), { padding: [20, 20] });
    } catch {
      map.setView(points[0], 6);
    }
  }, []);

  const routeMarkers = React.useMemo((): RouteMarker[] => {
    if (!trip) return [];
    const orderedDays = tripDays
      .filter((d) => d.tripId === trip.id && !isPreTripDayRow(d))
      .sort((a, b) => a.dayNumber - b.dayNumber);
    const out: RouteMarker[] = [];
    for (const day of orderedDays) {
      const place = placeById(day.primaryPlaceId);
      if (place) {
        const lat = Number(place.latitude);
        const lon = Number(place.longitude);
        if (isValidLatLng(lat, lon)) {
          out.push({
            id: `primary-${day.id}`,
            placeId: place.id,
            title: place.title,
            latitude: lat,
            longitude: lon,
            dayNumber: day.dayNumber,
            isPrimary: true
          });
        }
      }
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        const add = placeById(ref.placeId);
        if (!add) continue;
        const alat = Number(add.latitude);
        const alon = Number(add.longitude);
        if (!isValidLatLng(alat, alon)) continue;
        out.push({
          id: `add-${day.id}-${add.id}`,
          placeId: add.id,
          title: add.title,
          latitude: alat,
          longitude: alon,
          dayNumber: day.dayNumber,
          isPrimary: false
        });
      }
    }
    return out;
  }, [trip, tripDays, placeById]);

  React.useEffect(() => {
    if (routeMarkers.length) setLastMarkers(routeMarkers);
  }, [routeMarkers]);

  const renderedMarkers = routeMarkers.length ? routeMarkers : lastMarkers;

  const mapStats = React.useMemo(() => {
    if (!trip) return { primaryStops: 0, tripDays: 0, countries: 0 };
    const primary = renderedMarkers.filter((s) => s.isPrimary);
    const countries = new Set<string>();
    for (const s of primary) {
      const parts = (s.title || '').split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) countries.add(parts[parts.length - 1]);
    }
    return {
      primaryStops: primary.length,
      tripDays: tripDays.filter((d) => d.tripId === trip.id).length,
      countries: countries.size
    };
  }, [trip, tripDays, renderedMarkers]);

  React.useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const tryInit = (): void => {
      if (cancelled || initStartedRef.current) return;
      const el = mapRef.current;
      if (!el || el.clientHeight < 4) {
        raf = window.requestAnimationFrame(tryInit);
        return;
      }
      if (mapInstanceRef.current) return;
      initStartedRef.current = true;
      try {
        mapInstanceRef.current = L.map(el, { zoomControl: true });
        addResilientTileLayer(mapInstanceRef.current);
        layerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        mapInstanceRef.current.setView([20, 0], 2);
        window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 0);
        setMapBoot((n) => n + 1);
      } catch (err) {
        initStartedRef.current = false;
        // eslint-disable-next-line no-console
        console.error('TripMap: Leaflet init failed', err);
      }
    };

    raf = window.requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [trip?.id]);

  React.useEffect(() => {
    const el = mapRef.current;
    const map = mapInstanceRef.current;
    if (!el || !map) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [trip?.id]);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;
    const onFocus = (ev: Event): void => {
      const detail = (ev as CustomEvent<MapFocusDetail>).detail;
      if (!detail || !isValidLatLng(detail.latitude, detail.longitude)) return;
      try {
        map.flyTo([detail.latitude, detail.longitude], 8, { duration: 0.5 });
      } catch {
        map.setView([detail.latitude, detail.longitude], 8);
      }
    };
    window.addEventListener(TRAVELHUB_MAP_FOCUS, onFocus as EventListener);
    return () => window.removeEventListener(TRAVELHUB_MAP_FOCUS, onFocus as EventListener);
  }, [mapBoot]);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;

    const runId = layerRunRef.current + 1;
    layerRunRef.current = runId;
    let cancelled = false;

    const applyLayers = (): void => {
      if (cancelled || runId !== layerRunRef.current) return;
      try {
        const layerGroup = layerGroupRef.current ?? L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        layerGroup.clearLayers();
        if (polylineGroupRef.current) {
          map.removeLayer(polylineGroupRef.current);
          polylineGroupRef.current = null;
        }

        if (!renderedMarkers.length) {
          map.setView([20, 0], 2);
          window.setTimeout(() => map.invalidateSize(), 0);
          return;
        }

        const points: L.LatLngExpression[] = [];
        const seenLabelCoords = new Set<string>();
        const coordVisitCount = new Map<string, number>();
        for (const s of renderedMarkers) {
          if (!isValidLatLng(s.latitude, s.longitude)) continue;
          const coordKey = `${s.latitude.toFixed(4)}|${s.longitude.toFixed(4)}`;
          const visit = coordVisitCount.get(coordKey) ?? 0;
          coordVisitCount.set(coordKey, visit + 1);
          const lat = s.latitude + visit * 0.012;
          const lon = s.longitude + visit * 0.008;
          const ll: L.LatLngExpression = [lat, lon];
          points.push(ll);
          const label = shortMapLabel(s.title);
          const labelKey = `${label.toLowerCase()}|${s.latitude.toFixed(3)}|${s.longitude.toFixed(3)}`;
          const showLabel = !seenLabelCoords.has(labelKey);
          if (showLabel) seenLabelCoords.add(labelKey);
          const icon = L.divIcon({
            className: 'th-map-labeled-pin-wrap',
            html: `<div class="th-map-labeled-pin"><span class="th-map-labeled-pin-dot"></span>${showLabel ? `<span class="th-map-labeled-pin-label">${escapeHtml(label)}</span>` : ''}</div>`,
            iconSize: [1, 1],
            iconAnchor: [12, 20]
          });
          const marker = L.marker(ll, { icon, interactive: true });
          marker.bindTooltip(`${s.title} (Day ${s.dayNumber})`, {
            permanent: false,
            sticky: true,
            direction: 'top',
            offset: [0, -8],
            className: 'th-leaflet-tooltip'
          });
          marker.bindPopup(
            `<strong>${s.title}</strong><br/>Day ${s.dayNumber}<br/><a href="https://www.google.com/maps/@${s.latitude},${s.longitude},10z" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
          );
          marker.addTo(layerGroup);
        }

        const orderedDays = tripDays
          .filter((d) => (trip ? d.tripId === trip.id && !isPreTripDayRow(d) : !isPreTripDayRow(d)))
          .sort((a, b) => a.dayNumber - b.dayNumber);
        const lineGroup = L.layerGroup().addTo(map);
        polylineGroupRef.current = lineGroup;

        const primaryPoints: L.LatLngExpression[] = [];
        for (const day of orderedDays) {
          const primary = placeById(day.primaryPlaceId);
          if (!primary) continue;
          const plat = Number(primary.latitude);
          const plon = Number(primary.longitude);
          if (!isValidLatLng(plat, plon)) continue;
          const primaryPoint: L.LatLngExpression = [plat, plon];
          if (primaryPoints.length >= 1) {
            L.polyline([primaryPoints[primaryPoints.length - 1], primaryPoint], { color: '#1A6399', weight: 2 }).addTo(
              lineGroup
            );
          }
          primaryPoints.push(primaryPoint);

          const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
          let legStart = primaryPoint;
          for (const ref of additional) {
            const add = placeById(ref.placeId);
            if (!add) continue;
            const alat = Number(add.latitude);
            const alon = Number(add.longitude);
            if (!isValidLatLng(alat, alon)) continue;
            const addPoint: L.LatLngExpression = [alat, alon];
            L.polyline([legStart, addPoint], { color: '#1A6399', weight: 2, dashArray: '4 6' }).addTo(lineGroup);
            legStart = ref.returnToPrimary ? primaryPoint : addPoint;
            if (ref.returnToPrimary) {
              L.polyline([addPoint, primaryPoint], { color: '#1A6399', weight: 2, dashArray: '4 6' }).addTo(lineGroup);
            }
          }
        }
        fitMapToPoints(map, points);
        window.setTimeout(() => map.invalidateSize(), 0);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('TripMap: markers / route failed', err);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((map as any)._loaded) applyLayers();
    else map.whenReady(applyLayers);

    return () => {
      cancelled = true;
    };
  }, [renderedMarkers, trip, tripDays, placeById, mapBoot, fitMapToPoints]);

  React.useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
        polylineGroupRef.current = null;
      }
      initStartedRef.current = false;
    },
    [trip?.id]
  );

  return (
    <section className={styles.root} aria-label="Trip map">
      {!routeMarkers.length ? (
        <p className={styles.emptyHint}>
          Add a primary location to each itinerary day to see stops on the map. The map still loads so you can confirm the tab is working.
        </p>
      ) : null}
      <div className={`${styles.map} th-map-container`} ref={mapRef} />
      <div className={styles.stats} aria-label="Route summary">
        <div className={styles.statChip}>
          <span className={styles.statValue}>{mapStats.primaryStops}</span>
          <span className={styles.statLabel}>Map stops</span>
        </div>
        <div className={styles.statChip}>
          <span className={styles.statValue}>{mapStats.tripDays}</span>
          <span className={styles.statLabel}>Trip days</span>
        </div>
        {mapStats.countries > 0 ? (
          <div className={styles.statChip}>
            <span className={styles.statValue}>{mapStats.countries}</span>
            <span className={styles.statLabel}>Countries</span>
          </div>
        ) : null}
      </div>
    </section>
  );
};
