import * as React from 'react';
import L from 'leaflet';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { TripService } from '../../services/TripService';
import { DayService } from '../../services/DayService';
import { PlaceService } from '../../services/PlaceService';
import type { Trip } from '../../models';
import type { MobileTab } from './mobileTypes';
import {
  orderTripsForList,
  pickNextUpTrip,
  todayYmdLocal,
  tripEndYmd,
  type CompletedSort,
  type TripListFilter,
  type UpcomingSort
} from '../../utils/tripListSort';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import { getCurrentUserDisplayName } from '../../utils/currentUserEmail';
import { homeNearYouTools, type NearYouToolId } from '../../utils/nearYouTools';
import { ItineraryService } from '../../services/ItineraryService';
import { MobileNearYouPage } from './MobileNearYouPage';
import '../../components/maps/LeafletCompat.css';
import styles from './MobileHome.module.css';

export type MobileHomeTab = 'home' | 'trips' | 'spots' | 'profile' | 'nearyou';

export interface MobileHomeShellProps {
  onSelectTrip: (tripId: string, initialTab?: MobileTab) => void;
  onCreateTrip: () => void;
  onOpenSettings: () => void;
}

type MapTripFilter = 'completed' | 'upcoming';

function formatDateRange(dateStart: string, dateEnd: string): string {
  if (!dateStart || !dateEnd) return '';
  const fmt = (d: string): string => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${fmt(dateStart)} – ${fmt(dateEnd)}`;
}

function tripDayCount(dateStart: string, dateEnd: string): number | undefined {
  const s = Date.parse(dateStart);
  const e = Date.parse(dateEnd);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return undefined;
  return Math.round((e - s) / 86400000) + 1;
}

function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || 'traveller';
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

function IconHome(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrips(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSpots(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10.8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconProfile(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.5c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5 13.8 9l5.7 1.2-4.4 3.9 1.3 5.7L12 16.8 7.6 19.8l1.3-5.7-4.4-3.9L10.2 9 12 3.5Z" fill="currentColor" />
    </svg>
  );
}

function IconBell(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.5 1.5 5.5H5s1.5-1.3 1.5-5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const HOME_NEAR_ICONS: Record<string, React.ReactNode> = {
  dining: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3v8M7 11v10M5 3c0 2.5 2 4 2 8M9 3c0 2.5-2 4-2 8M14 3v18M17 3v7a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  restroom: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 20v-7.5A2.5 2.5 0 0 1 8 10h0a2.5 2.5 0 0 1 2.5 2.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 20v-6h5v6M13.5 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  atm: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5v9M9.5 9.5c.6-1 1.5-1.5 2.5-1.5 1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2c-1.4 0-2.5.8-2.5 2s1.1 2 2.5 2c1 0 1.9-.5 2.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  medical: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4h8v4h4v8h-4v4H8v-4H4V8h4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  transport: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 12h14M8 19h.01M16 19h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
};

export const MobileHomeShell: React.FC<MobileHomeShellProps> = ({
  onSelectTrip,
  onCreateTrip,
  onOpenSettings
}) => {
  const spContext = useSpContext();
  const { config, greetingName } = useConfig();
  const [tab, setTab] = React.useState<MobileHomeTab>('home');
  const [trips, setTrips] = React.useState<Trip[]>([]);
  const [allPlaces, setAllPlaces] = React.useState<
    Array<{ id: string; title: string; lat: number; lon: number; countryCode: string; country: string }>
  >([]);
  const [allTripDays, setAllTripDays] = React.useState<Array<{ tripId: string; primaryPlaceId?: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [listFilter, setListFilter] = React.useState<TripListFilter>('all');
  const [upcomingSort, setUpcomingSort] = React.useState<UpcomingSort>('nearest');
  const [completedSort, setCompletedSort] = React.useState<CompletedSort>('newest');
  const [mapTripFilter, setMapTripFilter] = React.useState<MapTripFilter>('upcoming');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);
  const [nearActionMsg, setNearActionMsg] = React.useState('');
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);
  const markerLayerRef = React.useRef<L.LayerGroup | null>(null);
  const mapInitRef = React.useRef(false);
  const [mapBoot, setMapBoot] = React.useState(0);

  const displayName = getCurrentUserDisplayName(spContext);
  const webAbsoluteUrl = spContext.pageContext.web.absoluteUrl;
  const webServerRelativeUrl = spContext.pageContext.web.serverRelativeUrl || '';

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
      const allDayRows = dayRows.reduce((acc, rows) => acc.concat(rows), [] as (typeof dayRows)[number]);
      setAllTripDays(allDayRows.map((d) => ({ tripId: d.tripId, primaryPlaceId: d.primaryPlaceId })));
      setAllPlaces(
        places.map((p) => ({
          id: p.id,
          title: p.title,
          lat: p.latitude,
          lon: p.longitude,
          countryCode: p.countryCode,
          country: p.country
        }))
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MobileHomeShell: failed to load trips', err);
      setError('Could not load trips. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [spContext]);

  React.useEffect(() => {
    loadTrips().catch(console.error);
  }, [loadTrips]);

  const todayYmd = React.useMemo(() => todayYmdLocal(), []);
  const { ordered: listTrips, nextUpId } = React.useMemo(
    () => orderTripsForList(trips, listFilter, upcomingSort, completedSort, todayYmd),
    [trips, listFilter, upcomingSort, completedSort, todayYmd]
  );
  const featuredTrip = React.useMemo(() => {
    const upcoming = trips.filter((t) => {
      const end = tripEndYmd(t);
      return !end || end >= todayYmd;
    });
    return pickNextUpTrip(upcoming, todayYmd) ?? trips[0];
  }, [trips, todayYmd]);

  const filteredTrips = React.useMemo(() => {
    return trips.filter((t) => {
      const end = tripEndYmd(t);
      if (!end) return mapTripFilter === 'upcoming';
      return mapTripFilter === 'completed' ? end < todayYmd : end >= todayYmd;
    });
  }, [trips, mapTripFilter, todayYmd]);
  const eligibleTripIds = React.useMemo(() => new Set(filteredTrips.map((t) => t.id)), [filteredTrips]);
  const eligibleDays = React.useMemo(
    () => allTripDays.filter((d) => eligibleTripIds.has(d.tripId)),
    [allTripDays, eligibleTripIds]
  );
  const placeIdSetEligible = React.useMemo(
    () => new Set(eligibleDays.map((d) => d.primaryPlaceId).filter(Boolean) as string[]),
    [eligibleDays]
  );
  const mapPins = React.useMemo(
    () =>
      allPlaces
        .filter((p) => placeIdSetEligible.has(p.id))
        .map((p) => ({ id: p.id, title: p.title, lat: p.lat, lon: p.lon })),
    [allPlaces, placeIdSetEligible]
  );

  const countriesVisited = React.useMemo(() => {
    const rows = allPlaces.filter((p) => placeIdSetEligible.has(p.id) && p.countryCode);
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.countryCode.toUpperCase(), r.country || r.countryCode.toUpperCase()));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [allPlaces, placeIdSetEligible]);
  const totalCitiesVisited = placeIdSetEligible.size;
  const totalTripDays = eligibleDays.length;
  const totalNightsAway = Math.max(0, totalTripDays - eligibleTripIds.size);
  const flagEmoji = (cc: string): string =>
    cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

  React.useEffect(() => {
    if (tab !== 'spots') return;
    let cancelled = false;
    let raf = 0;
    const tryInit = (): void => {
      if (cancelled || loading || mapInitRef.current) return;
      const el = mapRef.current;
      if (!el || el.clientHeight < 4) {
        raf = window.requestAnimationFrame(tryInit);
        return;
      }
      if (mapInstanceRef.current) return;
      mapInitRef.current = true;
      try {
        const map = L.map(el, { zoomControl: true });
        mapInstanceRef.current = map;
        markerLayerRef.current = L.layerGroup().addTo(map);
        addResilientTileLayer(map);
        map.setView([20, 0], 2);
        window.setTimeout(() => map.invalidateSize(), 0);
        setMapBoot((n) => n + 1);
      } catch (err) {
        mapInitRef.current = false;
        // eslint-disable-next-line no-console
        console.error('MobileHomeShell: map init failed', err);
      }
    };
    raf = window.requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [tab, loading]);

  React.useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
        mapInitRef.current = false;
      }
    };
  }, []);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer || tab !== 'spots') return;
    map.whenReady(() => {
      try {
        layer.clearLayers();
        const points: L.LatLngExpression[] = [];
        for (const p of mapPins) {
          const lat = Number(p.lat);
          const lon = Number(p.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            continue;
          }
          const ll: L.LatLngExpression = [lat, lon];
          points.push(ll);
          L.circleMarker(ll, {
            radius: 8,
            fillColor: '#1e2a44',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          })
            .bindPopup(p.title || 'Place')
            .addTo(layer);
        }
        if (points.length === 1) map.setView(points[0], 8);
        else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28] });
        window.setTimeout(() => map.invalidateSize(), 50);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('MobileHomeShell: markers failed', err);
      }
    });
  }, [mapPins, mapBoot, tab]);

  const openFeatured = (initialTab?: MobileTab): void => {
    if (!featuredTrip) return;
    onSelectTrip(featuredTrip.id, initialTab);
  };

  const openNearYou = (toolId: NearYouToolId | null): void => {
    setNearToolId(toolId);
    setTab('nearyou');
  };

  const saveNearPlace = React.useCallback((place: { name: string; note?: string; mapsUrl?: string }): void => {
    try {
      const key = 'travelhub-near-you-saved';
      const raw = window.localStorage.getItem(key);
      const prev = raw ? (JSON.parse(raw) as unknown[]) : [];
      const list = Array.isArray(prev) ? prev : [];
      list.unshift({ ...place, savedAt: new Date().toISOString() });
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 40)));
      setNearActionMsg(`Saved ${place.name}`);
      window.setTimeout(() => setNearActionMsg(''), 2500);
    } catch {
      setNearActionMsg('Could not save place on this device.');
    }
  }, []);

  const addNearToItinerary = React.useCallback(
    async (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
      if (!featuredTrip) {
        setNearActionMsg('Open or create a trip first to add itinerary items.');
        window.setTimeout(() => setNearActionMsg(''), 2800);
        return;
      }
      try {
        const daySvc = new DayService(spContext);
        const days = await daySvc.getAll(featuredTrip.id);
        const sorted = days.slice().sort((a, b) => a.dayNumber - b.dayNumber);
        const day = sorted[0];
        if (!day) {
          setNearActionMsg('This trip has no days yet.');
          return;
        }
        const itin = new ItineraryService(spContext);
        await itin.create({
          tripId: featuredTrip.id,
          dayId: day.id,
          title: place.name,
          category: 'Activities',
          location: place.note || '',
          timeStart: '',
          duration: '',
          supplier: '',
          notes: place.mapsUrl ? `Maps: ${place.mapsUrl}` : '',
          decisionStatus: 'Idea',
          bookingRequired: false,
          bookingStatus: 'Not booked',
          paymentStatus: 'Not paid',
          amount: 0,
          currency: 'NZD',
          sortOrder: 999
        });
        setNearActionMsg(`Added “${place.name}” to ${featuredTrip.title}`);
        window.setTimeout(() => setNearActionMsg(''), 2800);
      } catch (err) {
        setNearActionMsg(err instanceof Error ? err.message : 'Could not add to itinerary.');
        window.setTimeout(() => setNearActionMsg(''), 3200);
      }
    },
    [featuredTrip, spContext]
  );

  const featuredHeroSrc = featuredTrip?.heroImageUrl
    ? resolveSharePointMediaSrc(featuredTrip.heroImageUrl, webAbsoluteUrl, webServerRelativeUrl)
    : null;

  const renderTripCard = (trip: Trip, featured = false): React.ReactNode => {
    const heroSrc = trip.heroImageUrl
      ? resolveSharePointMediaSrc(trip.heroImageUrl, webAbsoluteUrl, webServerRelativeUrl)
      : null;
    const days = tripDayCount(trip.dateStart, trip.dateEnd);
    return (
      <button
        key={trip.id}
        type="button"
        className={styles.tripCard}
        onClick={() => onSelectTrip(trip.id)}
        aria-label={`Open trip ${trip.title}`}
      >
        <div
          className={styles.tripCardMedia}
          style={heroSrc ? { backgroundImage: `url("${heroSrc}")` } : undefined}
          aria-hidden
        />
        <div className={styles.tripCardBody}>
          <p className={styles.tripCardMeta}>{formatDateRange(trip.dateStart, trip.dateEnd)}</p>
          <h3 className={styles.tripCardTitle}>{trip.title}</h3>
          {days ? <p className={styles.tripCardDays}>{days} days</p> : null}
          {trip.destination ? <p className={styles.tripCardDays}>{trip.destination}</p> : null}
          {featured ? <span className={styles.statusChip}>Next up</span> : <span className={styles.statusChip}>{trip.status}</span>}
        </div>
      </button>
    );
  };

  let body: React.ReactNode;
  if (tab === 'nearyou') {
    body = (
      <MobileNearYouPage
        onBack={() => {
          setNearToolId(null);
          setTab('home');
        }}
        initialToolId={nearToolId}
        tripTitle={featuredTrip?.title}
        tripDateRange={
          featuredTrip ? formatDateRange(featuredTrip.dateStart, featuredTrip.dateEnd) : undefined
        }
        onSavePlace={saveNearPlace}
        onAddToItinerary={(place) => {
          void addNearToItinerary(place);
        }}
      />
    );
  } else if (tab === 'profile') {
    body = (
      <div>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <p className={styles.feedback} style={{ marginTop: 'var(--space-3)' }}>
          Signed in as <strong>{displayName}</strong>
        </p>
        <button type="button" className={styles.primaryBtn} onClick={onOpenSettings}>
          User settings
        </button>
      </div>
    );
  } else if (tab === 'spots') {
    body = (
      <div>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Spots</h2>
        </div>
        <section className={styles.mapWrap} aria-label="All trips places map">
          <div className={styles.mapHeader}>
            <h3 className={styles.mapTitle}>Map</h3>
            <div className={styles.toolbar} role="tablist" aria-label="Trip map filter">
              <button
                type="button"
                role="tab"
                aria-selected={mapTripFilter === 'upcoming'}
                className={`${styles.chip} ${mapTripFilter === 'upcoming' ? styles.chipActive : ''}`}
                onClick={() => setMapTripFilter('upcoming')}
              >
                Upcoming
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mapTripFilter === 'completed'}
                className={`${styles.chip} ${mapTripFilter === 'completed' ? styles.chipActive : ''}`}
                onClick={() => setMapTripFilter('completed')}
              >
                Completed
              </button>
            </div>
          </div>
          {!mapPins.length ? (
            <p className={styles.feedback} style={{ margin: 'var(--space-3)', border: 'none', background: 'transparent' }}>
              {mapTripFilter === 'completed'
                ? 'No completed trips with mapped primary places yet.'
                : 'No upcoming trips with mapped primary places yet.'}
            </p>
          ) : null}
          <div ref={mapRef} className={`th-map-container ${styles.mapBox}`} />
          <div className={styles.statsBox} aria-label="Travel stats">
            <strong>Stats ({mapTripFilter === 'completed' ? 'Completed' : 'Upcoming'})</strong>
            <div>Countries: {countriesVisited.length}</div>
            <div>Cities / places: {totalCitiesVisited}</div>
            <div>Trip days: {totalTripDays}</div>
            <div>Nights away: {totalNightsAway}</div>
            {countriesVisited.length ? (
              <div className={styles.flagRow}>
                {countriesVisited.map((c) => (
                  <span key={c.code} className={styles.flagChip}>
                    {flagEmoji(c.code)} {c.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  } else if (tab === 'trips') {
    body = (
      <div>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Trips</h2>
          <button type="button" className={styles.sectionLink} onClick={onCreateTrip}>
            Add trip
          </button>
        </div>
        {loading ? <div className={styles.feedback}>Loading trips…</div> : null}
        {!loading && error ? (
          <div className={`${styles.feedback} ${styles.errorText}`}>
            <p>{error}</p>
            <button type="button" className={styles.secondaryBtn} onClick={() => loadTrips().catch(console.error)}>
              Retry
            </button>
          </div>
        ) : null}
        {!loading && !error && trips.length === 0 ? (
          <div className={styles.feedback}>
            <p>No trips yet.</p>
            <button type="button" className={styles.primaryBtn} onClick={onCreateTrip}>
              Create your first trip
            </button>
          </div>
        ) : null}
        {!loading && !error && trips.length > 0 ? (
          <>
            <div className={styles.toolbar} role="toolbar" aria-label="Trip list filters">
              {(['all', 'upcoming', 'completed'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.chip} ${listFilter === id ? styles.chipActive : ''}`}
                  onClick={() => setListFilter(id)}
                >
                  {id === 'all' ? 'All' : id === 'upcoming' ? 'Upcoming' : 'Completed'}
                </button>
              ))}
              {listFilter === 'upcoming' || listFilter === 'all' ? (
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setUpcomingSort((s) => (s === 'nearest' ? 'furthest' : 'nearest'))}
                >
                  Upcoming: {upcomingSort === 'nearest' ? 'Nearest' : 'Furthest'}
                </button>
              ) : null}
              {listFilter === 'completed' || listFilter === 'all' ? (
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setCompletedSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                >
                  Completed: {completedSort === 'newest' ? 'Newest' : 'Oldest'}
                </button>
              ) : null}
            </div>
            <div className={styles.listStack}>
              {listTrips.map((trip) => renderTripCard(trip, trip.id === nextUpId))}
            </div>
          </>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div>
        <div className={styles.topBar}>
          <div className={styles.brandRow}>
            <div className={styles.pebbleMark} aria-hidden>
              <span className={styles.pebble} />
              <span className={styles.pebble} />
              <span className={styles.pebble} />
              <span className={styles.pebble} />
            </div>
            <h1 className={styles.brandName}>Trip Leopard</h1>
          </div>
          <button type="button" className={styles.iconBtn} aria-label="Notifications" onClick={() => setTab('trips')}>
            <IconBell />
          </button>
        </div>

        <p className={styles.greeting}>
          {greetingForNow()}, {greetingName || firstName(displayName)}
        </p>
        <p className={styles.prompt}>Where to next?</p>

        <form
          className={styles.aiRow}
          onSubmit={(e) => {
            e.preventDefault();
            openFeatured('today');
          }}
        >
          <input
            className={styles.aiInput}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI anything about your trip…"
            aria-label="Ask AI about your trip"
          />
          <button type="submit" className={styles.aiGo} aria-label="Ask AI" disabled={!featuredTrip}>
            <IconSpark />
          </button>
        </form>

        <div className={styles.pillarGrid}>
          <button type="button" className={`${styles.pillar} ${styles.pillarPlan}`} disabled={!featuredTrip} onClick={() => openFeatured('today')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className={styles.pillarTitle}>Plan</p>
            <p className={styles.pillarSub}>Itineraries, AI trip ideas</p>
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarBook}`} disabled={!featuredTrip} onClick={() => openFeatured('tasks')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 7h10l1 4H6L7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M6 11h12v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className={styles.pillarTitle}>Book</p>
            <p className={styles.pillarSub}>Flights, stays, tours & more</p>
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarRoam}`} disabled={!featuredTrip} onClick={() => openFeatured('map')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10.8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <p className={styles.pillarTitle}>Roam</p>
            <p className={styles.pillarSub}>Near me, maps, essentials</p>
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarShare}`} disabled={!featuredTrip} onClick={() => openFeatured('journal')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="8" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="16" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 18c1.2-2.4 3-3.6 4.5-3.6S10.3 15.6 11.5 18M12.5 18c1.2-2.4 3-3.6 4.5-3.6s3.3 1.2 4.5 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className={styles.pillarTitle}>Share</p>
            <p className={styles.pillarSub}>Journal, photos, share updates</p>
          </button>
        </div>

        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Near you</h2>
          <button
            type="button"
            className={styles.sectionLink}
            onClick={() => openNearYou(null)}
          >
            See all
          </button>
        </div>
        <div className={styles.nearRow} role="list">
          {homeNearYouTools(5).map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={styles.nearItem}
              role="listitem"
              onClick={() => openNearYou(tool.id)}
            >
              <span className={styles.nearCircle} aria-hidden>
                {HOME_NEAR_ICONS[tool.id] || tool.shortLabel[0]}
              </span>
              <span className={styles.nearLabel}>{tool.shortLabel}</span>
            </button>
          ))}
        </div>
        {nearActionMsg ? <p className={styles.feedback}>{nearActionMsg}</p> : null}

        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            {featuredTrip ? `Your trip to ${featuredTrip.destination || featuredTrip.title}` : 'Your trips'}
          </h2>
          <button type="button" className={styles.sectionLink} onClick={() => (featuredTrip ? onSelectTrip(featuredTrip.id) : setTab('trips'))}>
            View trip
          </button>
        </div>
        {loading ? <div className={styles.feedback}>Loading trips…</div> : null}
        {!loading && error ? (
          <div className={`${styles.feedback} ${styles.errorText}`}>
            <p>{error}</p>
            <button type="button" className={styles.secondaryBtn} onClick={() => loadTrips().catch(console.error)}>
              Retry
            </button>
          </div>
        ) : null}
        {!loading && !error && !featuredTrip ? (
          <div className={styles.feedback}>
            <p>No trips yet.</p>
            <button type="button" className={styles.primaryBtn} onClick={onCreateTrip}>
              Create your first trip
            </button>
          </div>
        ) : null}
        {featuredTrip ? (
          <button
            type="button"
            className={styles.tripCard}
            onClick={() => onSelectTrip(featuredTrip.id)}
            aria-label={`Open trip ${featuredTrip.title}`}
          >
            <div
              className={styles.tripCardMedia}
              style={featuredHeroSrc ? { backgroundImage: `url("${featuredHeroSrc}")` } : undefined}
              aria-hidden
            />
            <div className={styles.tripCardBody}>
              <p className={styles.tripCardMeta}>{formatDateRange(featuredTrip.dateStart, featuredTrip.dateEnd)}</p>
              <h3 className={styles.tripCardTitle}>{featuredTrip.title}</h3>
              {tripDayCount(featuredTrip.dateStart, featuredTrip.dateEnd) ? (
                <p className={styles.tripCardDays}>{tripDayCount(featuredTrip.dateStart, featuredTrip.dateEnd)} days</p>
              ) : null}
              <span className={styles.statusChip}>{featuredTrip.status}</span>
            </div>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.homeRoot}>
      <main className={styles.scroll}>{body}</main>
      <nav className={styles.bottomNav} aria-label="Trip Leopard home navigation">
        <button
          type="button"
          className={`${styles.navBtn} ${tab === 'home' ? styles.navBtnActive : ''}`}
          onClick={() => setTab('home')}
        >
          <IconHome />
          Home
          {tab === 'home' ? <span className={styles.navDot} /> : null}
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${tab === 'trips' ? styles.navBtnActive : ''}`}
          onClick={() => setTab('trips')}
        >
          <IconTrips />
          Trips
          {tab === 'trips' ? <span className={styles.navDot} /> : null}
        </button>
        <div className={styles.fabSlot}>
          <button type="button" className={styles.fab} aria-label="Add trip" onClick={onCreateTrip}>
            <IconPlus />
          </button>
        </div>
        <button
          type="button"
          className={`${styles.navBtn} ${tab === 'spots' ? styles.navBtnActive : ''}`}
          onClick={() => setTab('spots')}
        >
          <IconSpots />
          Spots
          {tab === 'spots' ? <span className={styles.navDot} /> : null}
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${tab === 'profile' ? styles.navBtnActive : ''}`}
          onClick={() => setTab('profile')}
        >
          <IconProfile />
          Profile
          {tab === 'profile' ? <span className={styles.navDot} /> : null}
        </button>
      </nav>
    </div>
  );
};
