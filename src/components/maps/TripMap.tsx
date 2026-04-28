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

export const TripMap: React.FC = () => {
  const { trip, tripDays } = useTripWorkspace();
  const { placeById } = usePlaces();
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);
  const layerGroupRef = React.useRef<L.LayerGroup | null>(null);
  const polylineRef = React.useRef<L.Polyline | null>(null);
  const [lastStops, setLastStops] = React.useState<Stop[]>([]);

  const stops = React.useMemo((): Stop[] => {
    if (!trip) return [];
    const orderedDays = tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
    const out: Stop[] = [];
    for (const day of orderedDays) {
      const place = placeById(day.primaryPlaceId);
      if (!place) continue;
      const prev = out[out.length - 1];
      if (prev && prev.placeId === place.id) {
        prev.endDay = day.dayNumber;
      } else {
        out.push({
          placeId: place.id,
          title: place.title,
          latitude: place.latitude,
          longitude: place.longitude,
          startDay: day.dayNumber,
          endDay: day.dayNumber,
          isPrimary: true
        });
      }
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        const add = placeById(ref.placeId);
        if (!add) continue;
        out.push({
          placeId: `${add.id}-${day.id}`,
          title: `${add.title} (Day ${day.dayNumber})`,
          latitude: add.latitude,
          longitude: add.longitude,
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
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);
    layerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
  }, []);

  React.useEffect(() => {
    if (!mapInstanceRef.current || renderedStops.length === 0) return;
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current ?? L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    layerGroup.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const s of renderedStops) {
      const ll: L.LatLngExpression = [s.latitude, s.longitude];
      points.push(ll);
      const range = s.startDay === s.endDay ? `Day ${s.startDay}` : `Days ${s.startDay}-${s.endDay}`;
      L.circleMarker(ll, {
        radius: s.isPrimary ? 8 : 6,
        fillColor: '#1A6399',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: s.isPrimary ? 1 : 0.8
      })
        .bindPopup(
          `<strong>${s.title}</strong><br/>${range}<br/><a href="https://www.google.com/maps/@${s.latitude},${s.longitude},10z" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
        )
        .addTo(layerGroup);
    }
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    const orderedDays = tripDays
      .filter((d) => (trip ? d.tripId === trip.id : true))
      .sort((a, b) => a.dayNumber - b.dayNumber);
    const polylinePoints: L.LatLngExpression[] = [];
    for (const day of orderedDays) {
      const primary = placeById(day.primaryPlaceId);
      if (!primary) continue;
      const primaryPoint: L.LatLngExpression = [primary.latitude, primary.longitude];
      polylinePoints.push(primaryPoint);
      const additional = parseAdditionalPlaceRefs(day.additionalPlaceIds);
      for (const ref of additional) {
        const add = placeById(ref.placeId);
        if (!add) continue;
        polylinePoints.push([add.latitude, add.longitude]);
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
  }, [renderedStops, trip, tripDays, placeById]);

  React.useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }
  }, []);

  if (!renderedStops.length) {
    return null;
  }

  return (
    <section className={styles.root} aria-label="Trip map">
      <div className={styles.map} ref={mapRef} />
    </section>
  );
};
