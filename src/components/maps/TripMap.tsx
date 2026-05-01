import * as React from 'react';
import L from 'leaflet';
import './LeafletCompat.css';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { parseAdditionalPlaceRefs } from '../../utils/tripDayPlaces';
import styles from './TripMap.module.css';

type Stop = {
  placeId: string;
  title: string;
  latitude: number;
  longitude: number;
  startDay: number;
  endDay: number;
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
  const polylineRef = React.useRef<L.Polyline | null>(null);
  const initStartedRef = React.useRef(false);
  const [mapBoot, setMapBoot] = React.useState(0);
  const [lastStops, setLastStops] = React.useState<Stop[]>([]);

  const stops = React.useMemo((): Stop[] => {
    if (!trip) return [];
    const orderedDays = tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
    const out: Stop[] = [];
    for (const day of orderedDays) {
      const place = placeById(day.primaryPlaceId);
      if (!place) continue;
      const lat = Number(place.latitude);
      const lon = Number(place.longitude);
      if (!isValidLatLng(lat, lon)) continue;
      const prev = out[out.length - 1];
      if (prev && prev.placeId === place.id) {
        prev.endDay = day.dayNumber;
      } else {
        out.push({
          placeId: place.id,
          title: place.title,
          latitude: lat,
          longitude: lon,
          startDay: day.dayNumber,
          endDay: day.dayNumber,
          isPrimary: true
        });
      }
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        const add = placeById(ref.placeId);
        if (!add) continue;
        const alat = Number(add.latitude);
        const alon = Number(add.longitude);
        if (!isValidLatLng(alat, alon)) continue;
        out.push({
          placeId: `${add.id}-${day.id}`,
          title: `${add.title} (Day ${day.dayNumber})`,
          latitude: alat,
          longitude: alon,
          startDay: day.dayNumber,
          endDay: day.dayNumber,
          isPrimary: false
        });
      }
    }
    return out;
  }, [trip, tripDays, placeById]);

  React.useEffect(() => {
    if (stops.length) setLastStops(stops);
  }, [stops]);

  const renderedStops = stops.length ? stops : lastStops;

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
    if (!map) return;
    try {
      const layerGroup = layerGroupRef.current ?? L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      layerGroup.clearLayers();
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      if (!renderedStops.length) {
        map.setView([20, 0], 2);
        window.setTimeout(() => map.invalidateSize(), 0);
        return;
      }

      const points: L.LatLngExpression[] = [];
      map.whenReady(() => {
        try {
          for (const s of renderedStops) {
            if (!isValidLatLng(s.latitude, s.longitude)) continue;
            const ll: L.LatLngExpression = [s.latitude, s.longitude];
            points.push(ll);
            const range = s.startDay === s.endDay ? `Day ${s.startDay}` : `Days ${s.startDay}-${s.endDay}`;
            const marker = L.circleMarker(ll, {
              radius: s.isPrimary ? 8 : 6,
              fillColor: '#1A6399',
              color: '#ffffff',
              weight: 2,
              opacity: 1,
              fillOpacity: s.isPrimary ? 1 : 0.8,
              interactive: true,
              bubblingMouseEvents: true
            });
            marker.bindTooltip(s.title, {
              permanent: false,
              sticky: true,
              interactive: true,
              direction: 'top',
              offset: [0, -10],
              opacity: 0.98,
              className: 'th-leaflet-tooltip'
            });
            // Native title fallback (some hosts/CSS stacks still suppress Leaflet tooltips).
            marker.on('add', () => {
              const el = marker.getElement?.() as SVGElement | null | undefined;
              if (el) el.setAttribute('title', s.title);
            });
            marker.bindPopup(
              `<strong>${s.title}</strong><br/>${range}<br/><a href="https://www.google.com/maps/@${s.latitude},${s.longitude},10z" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
            );
            marker.addTo(layerGroup);
          }
          const orderedDays = tripDays
            .filter((d) => (trip ? d.tripId === trip.id : true))
            .sort((a, b) => a.dayNumber - b.dayNumber);
          const polylinePoints: L.LatLngExpression[] = [];
          for (const day of orderedDays) {
            const primary = placeById(day.primaryPlaceId);
            if (!primary) continue;
            const plat = Number(primary.latitude);
            const plon = Number(primary.longitude);
            if (!isValidLatLng(plat, plon)) continue;
            const primaryPoint: L.LatLngExpression = [plat, plon];
            polylinePoints.push(primaryPoint);
            const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
            for (const ref of additional) {
              const add = placeById(ref.placeId);
              if (!add) continue;
              const alat = Number(add.latitude);
              const alon = Number(add.longitude);
              if (!isValidLatLng(alat, alon)) continue;
              polylinePoints.push([alat, alon]);
              if (!ref.returnToPrimary) break;
            }
            if (additional.some((x) => x.returnToPrimary)) {
              polylinePoints.push(primaryPoint);
            }
          }
          if (polylinePoints.length >= 2) {
            polylineRef.current = L.polyline(polylinePoints, { color: '#1A6399', weight: 2 });
            polylineRef.current.addTo(map);
          }
          if (points.length) {
            map.fitBounds(L.latLngBounds(points), { padding: [20, 20] });
          } else {
            map.setView([0, 0], 4);
          }
          window.setTimeout(() => map.invalidateSize(), 0);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('TripMap: markers / route failed', err);
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripMap: layer update failed', err);
    }
  }, [renderedStops, trip, tripDays, placeById, mapBoot]);

  React.useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
        polylineRef.current = null;
      }
      initStartedRef.current = false;
    },
    [trip?.id]
  );

  return (
    <section className={styles.root} aria-label="Trip map">
      {!stops.length ? (
        <p className={styles.emptyHint}>
          Add a primary location to each itinerary day to see stops on the map. The map still loads so you can confirm the tab is working.
        </p>
      ) : null}
      <div className={`${styles.map} th-map-container`} ref={mapRef} />
    </section>
  );
};
