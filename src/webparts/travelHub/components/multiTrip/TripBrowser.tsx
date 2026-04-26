import * as React from 'react';
import { useSpContext } from '../../../../context/SpContext';
import { TripService } from '../../../../services/TripService';
import { DayService } from '../../../../services/DayService';
import { PlaceService } from '../../../../services/PlaceService';
import { Trip } from '../../../../models';
import L from 'leaflet';
import '../../../../components/maps/LeafletCompat.css';

function formatDateRange(dateStart: string, dateEnd: string): string {
  if (!dateStart || !dateEnd) return '';
  const fmt = (d: string): string => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${fmt(dateStart)} – ${fmt(dateEnd)}`;
}

function getStatusBadgeStyles(status: string): React.CSSProperties {
  switch (status) {
    case 'Planning':
      return { background: 'var(--color-status-planned-bg)', color: 'var(--color-status-planned)' };
    case 'Upcoming':
      return { background: 'var(--color-status-booked-bg)', color: 'var(--color-status-booked)' };
    case 'In Progress':
      return { background: 'var(--color-status-confirmed-bg)', color: 'var(--color-status-confirmed)' };
    case 'Completed':
      return { background: 'var(--color-status-confirmed-bg)', color: 'var(--color-status-confirmed)' };
    case 'Archived':
      return { background: 'var(--color-status-idea-bg)', color: 'var(--color-status-idea)' };
    default:
      return { background: 'var(--color-status-planned-bg)', color: 'var(--color-status-planned)' };
  }
}

export interface ITripBrowserProps {
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: () => void;
}

export const TripBrowser: React.FC<ITripBrowserProps> = ({ onSelectTrip, onCreateTrip }) => {
  const spContext = useSpContext();
  const [trips, setTrips] = React.useState<Trip[]>([]);
  const [placePins, setPlacePins] = React.useState<Array<{ id: string; title: string; lat: number; lon: number }>>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const mapRef = React.useRef<HTMLDivElement | null>(null);

  const loadTrips = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const svc = new TripService(spContext);
      const result = await svc.getAll();
      setTrips(result);
      const daySvc = new DayService(spContext);
      const placeSvc = new PlaceService(spContext);
      const [places, dayRows] = await Promise.all([
        placeSvc.getAll(),
        Promise.all(result.map((t) => daySvc.getAll(t.id)))
      ]);
      const allDayRows = dayRows.reduce((acc, rows) => acc.concat(rows), [] as typeof dayRows[number]);
      const placeIdSet = new Set(
        allDayRows
          .map((d: { primaryPlaceId?: string }) => d.primaryPlaceId)
          .filter(Boolean) as string[]
      );
      setPlacePins(
        places
          .filter((p) => placeIdSet.has(p.id))
          .map((p) => ({ id: p.id, title: p.title, lat: p.latitude, lon: p.longitude }))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripBrowser: failed to load trips', err);
      setError('Could not load trips. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [spContext]);

  React.useEffect(() => {
    loadTrips().catch(console.error);
  }, [loadTrips]);

  React.useEffect(() => {
    if (!mapRef.current || placePins.length === 0) return;
    const map = L.map(mapRef.current, { zoomControl: true });
    const markerIcon = L.divIcon({
      className: '',
      html: `<svg width="20" height="24" viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M10 1.5C5.3 1.5 1.5 5.3 1.5 10c0 6.3 8.5 12.5 8.5 12.5S18.5 16.3 18.5 10C18.5 5.3 14.7 1.5 10 1.5Z" fill="var(--color-primary)" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="10" cy="10" r="3" fill="#ffffff"/>
      </svg>`,
      iconSize: [20, 24],
      iconAnchor: [10, 24]
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const points: L.LatLngExpression[] = [];
    for (const p of placePins) {
      const ll: L.LatLngExpression = [p.lat, p.lon];
      points.push(ll);
      L.marker(ll, { icon: markerIcon }).bindPopup(`<strong>${p.title}</strong>`).addTo(map);
    }
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [20, 20] });
    return () => {
      map.remove();
    };
  }, [placePins]);

  // -- Styles -------------------------------------------------------------
  const pageStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: 'var(--space-4)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-blue-900)',
    boxSizing: 'border-box'
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-6)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr))',
    gap: 'var(--space-4)'
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface-raised)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    border: 'var(--border-default)',
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    textAlign: 'left'
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-blue-800)',
    margin: 0
  };

  const destinationStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-blue-600)',
    margin: 0
  };

  const dateStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-sand-600)'
  };

  const badgeStyleBase: React.CSSProperties = {
    alignSelf: 'flex-start',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)'
  };

  const primaryButtonStyle: React.CSSProperties = {
    marginTop: 'auto',
    width: '100%',
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-primary)',
    color: 'var(--color-surface-raised)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer'
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-4)',
    background: 'transparent',
    color: 'var(--color-primary)',
    border: 'var(--border-emphasis)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer'
  };

  const feedbackStyle: React.CSSProperties = {
    padding: 'var(--space-6)',
    textAlign: 'center',
    color: 'var(--color-sand-600)',
    fontSize: 'var(--font-size-sm)'
  };
  const mapWrapStyle: React.CSSProperties = {
    marginTop: 'var(--space-6)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--color-surface-raised)'
  };
  const mapStyle: React.CSSProperties = {
    height: '24rem',
    width: '100%'
  };

  const errorStyle: React.CSSProperties = {
    ...feedbackStyle,
    color: 'var(--color-warning)'
  };

  // -- Render --------------------------------------------------------------
  return (
    <div style={pageStyle}>
      <div style={headerRowStyle}>
        <h1 style={titleStyle}>My Trips</h1>
        <button type="button" style={secondaryButtonStyle} onClick={onCreateTrip}>
          Add Trip
        </button>
      </div>

      {loading && <div style={feedbackStyle}>Loading trips…</div>}

      {!loading && error && (
        <div style={errorStyle}>
          <p>{error}</p>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              loadTrips().catch(console.error);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && trips.length === 0 && (
        <div style={feedbackStyle}>
          <p>No trips yet.</p>
          <button type="button" style={secondaryButtonStyle} onClick={onCreateTrip}>
            Create your first trip
          </button>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <>
          <div style={gridStyle}>
            {trips.map((trip) => (
              <article key={trip.id} style={cardStyle}>
                <h2 style={cardTitleStyle}>{trip.title}</h2>
                {trip.destination && <p style={destinationStyle}>{trip.destination}</p>}
                <p style={dateStyle}>{formatDateRange(trip.dateStart, trip.dateEnd)}</p>
                <span style={{ ...badgeStyleBase, ...getStatusBadgeStyles(trip.status) }}>{trip.status}</span>
                <button type="button" style={primaryButtonStyle} onClick={() => onSelectTrip(trip.id)}>
                  Open Trip
                </button>
              </article>
            ))}
          </div>
          {placePins.length ? (
            <section style={mapWrapStyle} aria-label="All trips places map">
              <div ref={mapRef} style={mapStyle} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};
