import * as React from 'react';
import L from 'leaflet';
import './LeafletCompat.css';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
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

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'th-map-pin',
    html: `<svg width="20" height="24" viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 1.5C5.3 1.5 1.5 5.3 1.5 10c0 6.3 8.5 12.5 8.5 12.5S18.5 16.3 18.5 10C18.5 5.3 14.7 1.5 10 1.5Z" fill="var(--color-primary)" stroke="#ffffff" stroke-width="1.2"/>
      <circle cx="10" cy="10" r="3" fill="#ffffff"/>
    </svg>`,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -28]
  });
}

function createSmallPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'th-map-pin-small',
    html: `<svg width="14" height="18" viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 1.5C5.3 1.5 1.5 5.3 1.5 10c0 6.3 8.5 12.5 8.5 12.5S18.5 16.3 18.5 10C18.5 5.3 14.7 1.5 10 1.5Z" fill="var(--color-blue-200)" stroke="#ffffff" stroke-width="1.2"/>
      <circle cx="10" cy="10" r="2.4" fill="#ffffff"/>
    </svg>`,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -28]
  });
}

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
      for (const id of day.additionalPlaceIds ?? []) {
        const add = placeById(id);
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
    const markerIcon = createPinIcon();
    const markerIconSmall = createSmallPinIcon();

    const points: L.LatLngExpression[] = [];
    for (const s of renderedStops) {
      const ll: L.LatLngExpression = [s.latitude, s.longitude];
      points.push(ll);
      const range = s.startDay === s.endDay ? `Day ${s.startDay}` : `Days ${s.startDay}-${s.endDay}`;
      L.marker(ll, { icon: s.isPrimary ? markerIcon : markerIconSmall })
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
      for (const addId of day.additionalPlaceIds ?? []) {
        const add = placeById(addId);
        if (!add) continue;
        polylinePoints.push([add.latitude, add.longitude]);
      }
      if ((day.additionalPlaceIds ?? []).length > 0) {
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
