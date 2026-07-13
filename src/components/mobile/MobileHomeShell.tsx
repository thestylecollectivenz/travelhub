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
  todayYmdLocal,
  tripEndYmd,
  type CompletedSort,
  type TripListFilter,
  type UpcomingSort
} from '../../utils/tripListSort';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import { getCurrentUserDisplayName } from '../../utils/currentUserEmail';
import { homeNearYouTools, type NearYouToolId } from '../../utils/nearYouTools';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { createItineraryEntryFromNearYouPlace } from '../../utils/addPlaceToItinerary';
import { resolveHomeContextTrip } from '../../utils/homeContextTrip';
import { homeAiVisibleChips } from '../../utils/tripJotterIdeas';
import {
  migrateLocalSavedSpotsToTrip,
  saveTripSavedSpot
} from '../../utils/tripSavedSpots';
import { setPendingMobileItineraryEdit } from '../../utils/mobileItineraryEditPending';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { useCurrentUserRole } from '../../hooks/useCurrentUserRole';
import { useTripMembers } from '../../hooks/useTripMembers';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { MobileNearYouPage } from './MobileNearYouPage';
import { MobileIdeasJotter } from './MobileIdeasJotter';
import { MobileHomeUpcoming } from './MobileHomeUpcoming';
import { MobileAddToTripMenu } from './MobileAddToTripMenu';
import { setPendingMobileListsIdeas } from '../../utils/mobileHomePendingAction';
import { MobileBookPage } from './MobileBookPage';
import { MobileBookAllPartners } from './MobileBookAllPartners';
import { MobileHomeAskAiSheet } from './MobileHomeAskAiSheet';
import { TripMembersPanel } from '../workspace/TripMembersPanel';
import { TripRoleProvider } from '../../context/TripRoleContext';
import '../../components/maps/LeafletCompat.css';
import type { ShellMode } from '../../hooks/useShellMode';
import { MobileBrandHeader } from './MobileBrandHeader';
import styles from './MobileHome.module.css';

export type MobileHomeTab = 'home' | 'trips' | 'spots' | 'find' | 'book';

export interface MobileHomeShellProps {
  onSelectTrip: (tripId: string, initialTab?: MobileTab) => void;
  onCreateTrip: () => void;
  onOpenSettings: () => void;
  /** When `ipad-portrait`, enables tablet-width polish via `data-shell`. */
  shellMode?: Extract<ShellMode, 'phone' | 'ipad-portrait'>;
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

function IconFind(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBook(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7h10l1 4H6L7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 11h12v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconGear(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.97 7.97 0 0 0 .1-2l2-1.2-2-3.5-2.3 1a8.1 8.1 0 0 0-1.7-1L15 3h-6l-.5 2.3a8.1 8.1 0 0 0-1.7 1l-2.3-1-2 3.5L4.5 11a7.97 7.97 0 0 0 .1 2L4.4 14l2 3.5 2.3-1a8.1 8.1 0 0 0 1.7 1L9 21h6l.5-2.3a8.1 8.1 0 0 0 1.7-1l2.3 1 2-3.5-1.9-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
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

function IconSend(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 12 16-7-7 16-2-7-7-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={styles.pillarChevron}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const MobileHomeShell: React.FC<MobileHomeShellProps> = ({
  onSelectTrip,
  onCreateTrip,
  onOpenSettings,
  shellMode = 'phone'
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
  const [homeAskPrompt, setHomeAskPrompt] = React.useState<string | null>(null);
  const [aiChipOffset, setAiChipOffset] = React.useState(0);
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);
  const [bookView, setBookView] = React.useState<'main' | 'all'>('main');
  const [bookDestination, setBookDestination] = React.useState('');

  React.useEffect(() => {
    if (tab !== 'book') setBookView('main');
  }, [tab]);
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
  const contextTrip = React.useMemo(() => resolveHomeContextTrip(trips, todayYmd), [trips, todayYmd]);
  const { members: contextMembers, myMember } = useTripMembers(contextTrip?.id);
  const { role: contextRole } = useCurrentUserRole(contextTrip?.id);
  const appendVoice = React.useCallback((chunk: string) => {
    setAiPrompt((prev) => `${prev}${prev ? ' ' : ''}${chunk}`);
  }, []);
  const { listening, toggleListening } = useContinuousSpeechInput(appendVoice);
  const aiChips = React.useMemo(() => homeAiVisibleChips(contextTrip, aiChipOffset, 2), [contextTrip, aiChipOffset]);
  const { ordered: listTrips, nextUpId } = React.useMemo(
    () => orderTripsForList(trips, listFilter, upcomingSort, completedSort, todayYmd),
    [trips, listFilter, upcomingSort, completedSort, todayYmd]
  );
  const featuredTrip = contextTrip;

  React.useEffect(() => {
    if (!contextTrip?.id) return;
    void migrateLocalSavedSpotsToTrip(spContext, contextTrip.id, contextMembers).catch(console.error);
  }, [contextTrip?.id, spContext, contextMembers]);

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
    setTab('find');
  };

  const saveNearPlace = React.useCallback(
    (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }): void => {
      if (!contextTrip?.id) {
        setNearActionMsg('Open or create a trip first to save places.');
        window.setTimeout(() => setNearActionMsg(''), 2800);
        return;
      }
      void saveTripSavedSpot(spContext, contextTrip.id, place, contextMembers)
        .then(() => {
          setNearActionMsg(`Saved ${place.name}`);
          window.setTimeout(() => setNearActionMsg(''), 2500);
        })
        .catch(() => {
          setNearActionMsg('Could not save place.');
          window.setTimeout(() => setNearActionMsg(''), 2800);
        });
    },
    [contextTrip?.id, spContext, contextMembers]
  );

  const addNearToItinerary = React.useCallback(
    async (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
      if (!featuredTrip) {
        setNearActionMsg('Open or create a trip first to add itinerary items.');
        window.setTimeout(() => setNearActionMsg(''), 2800);
        throw new Error('No trip');
      }
      const daySvc = new DayService(spContext);
      const days = await daySvc.getAll(featuredTrip.id);
      const sorted = days.filter((d) => d.dayNumber > 0).sort((a, b) => a.dayNumber - b.dayNumber);
      const day = sorted.find((d) => d.calendarDate.slice(0, 10) >= todayYmdLocal()) ?? sorted[0];
      if (!day) {
        setNearActionMsg('This trip has no days yet.');
        throw new Error('No days');
      }
      const created = await createItineraryEntryFromNearYouPlace(spContext, featuredTrip, day.id, place);
      setPendingMobileItineraryEdit(created.id, day.id);
      onSelectTrip(featuredTrip.id, 'today');
      setNearActionMsg(`Opening editor for “${place.name}”…`);
      window.setTimeout(() => setNearActionMsg(''), 2800);
    },
    [featuredTrip, spContext, onSelectTrip]
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
  if (tab === 'find') {
    body = (
      <MobileNearYouPage
        onBack={() => {
          setNearToolId(null);
          setTab('home');
        }}
        hideBack
        initialToolId={nearToolId}
        tripId={contextTrip?.id}
        tripTitle={featuredTrip?.title}
        tripDateRange={
          featuredTrip ? formatDateRange(featuredTrip.dateStart, featuredTrip.dateEnd) : undefined
        }
        onSavePlace={saveNearPlace}
        onAddToItinerary={(place) => {
          void addNearToItinerary(place);
        }}
        askAiEnabled={Boolean(featuredTrip)}
        onAskAi={(prompt) => {
          if (!featuredTrip) return;
          setHomeAskPrompt(prompt);
        }}
      />
    );
  } else if (tab === 'book') {
    body =
      bookView === 'all' ? (
        <MobileBookAllPartners destinationHint={bookDestination || featuredTrip?.title || ''} onBack={() => setBookView('main')} />
      ) : (
        <MobileBookPage
          destinationHint={featuredTrip?.title ?? ''}
          showTitle={false}
          onViewAllPartners={(dest) => {
            setBookDestination(dest || featuredTrip?.title || '');
            setBookView('all');
          }}
          onViewTripOverview={
            featuredTrip?.id
              ? () => {
                  onSelectTrip(featuredTrip.id);
                }
              : undefined
          }
        />
      );
  } else if (tab === 'spots') {
    body = (
      <div>
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
          <h2 className={styles.sectionTitle}>Your trips</h2>
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
          <div className={styles.topBarActions}>
            <button
              type="button"
              className={styles.avatarBtn}
              aria-label="Trip access"
              disabled={!contextTrip?.id}
              onClick={() => setMembersOpen(true)}
            >
              <TravellerAvatar
                displayName={myMember?.userDisplayName || greetingName || displayName}
                avatarUrl={myMember?.avatarUrl}
                size={36}
              />
            </button>
            <button type="button" className={styles.iconBtn} aria-label="Traveller profile" onClick={onOpenSettings}>
              <IconGear />
            </button>
          </div>
        </div>

        <p className={styles.greeting}>
          {greetingForNow()}, {greetingName || firstName(displayName)}
        </p>
        <p className={styles.prompt}>Where to next?</p>

        <form
          className={styles.aiRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (!featuredTrip) return;
            const p = aiPrompt.trim();
            if (p) setHomeAskPrompt(p);
            setAiPrompt('');
          }}
        >
          <span className={styles.aiSpark} aria-hidden>
            <IconSpark />
          </span>
          <input
            className={styles.aiInput}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI anything about your trip…"
            aria-label="Ask AI about your trip"
          />
          <button
            type="button"
            className={`${styles.aiMic} ${listening ? styles.aiMicActive : ''}`}
            aria-label={listening ? 'Stop listening' : 'Speak your question'}
            onClick={() => toggleListening()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button type="submit" className={styles.aiGo} aria-label="Ask AI" disabled={!featuredTrip}>
            <IconSend />
          </button>
        </form>

        <div className={styles.aiChips} role="list" aria-label="AI suggestions">
          {aiChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={styles.aiChip}
              role="listitem"
              disabled={!featuredTrip}
              onClick={() => {
                if (!featuredTrip) return;
                setHomeAskPrompt(chip);
              }}
            >
              {chip}
            </button>
          ))}
          <button
            type="button"
            className={styles.aiChip}
            aria-label="More suggestions"
            disabled={!featuredTrip}
            onClick={() => setAiChipOffset((o) => o + 2)}
          >
            …
          </button>
        </div>

        <div className={styles.pillarGrid}>
          <button type="button" className={`${styles.pillar} ${styles.pillarPlan}`} disabled={!featuredTrip} onClick={() => openFeatured('today')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div className={styles.pillarCopy}>
              <p className={styles.pillarTitle}>Plan</p>
              <p className={styles.pillarSub}>Itineraries, AI trip ideas</p>
            </div>
            <IconChevron />
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarBook}`} onClick={() => setTab('book')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 7h10l1 4H6L7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M6 11h12v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div className={styles.pillarCopy}>
              <p className={styles.pillarTitle}>Book</p>
              <p className={styles.pillarSub}>Flights, stays, tours & more</p>
            </div>
            <IconChevron />
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarRoam}`} disabled={!featuredTrip} onClick={() => openFeatured('map')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10.8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <div className={styles.pillarCopy}>
              <p className={styles.pillarTitle}>Roam</p>
              <p className={styles.pillarSub}>Near me, maps, essentials</p>
            </div>
            <IconChevron />
          </button>
          <button type="button" className={`${styles.pillar} ${styles.pillarShare}`} disabled={!featuredTrip} onClick={() => openFeatured('journal')}>
            <svg className={styles.pillarIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="8" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="16" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 18c1.2-2.4 3-3.6 4.5-3.6S10.3 15.6 11.5 18M12.5 18c1.2-2.4 3-3.6 4.5-3.6s3.3 1.2 4.5 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div className={styles.pillarCopy}>
              <p className={styles.pillarTitle}>Share</p>
              <p className={styles.pillarSub}>Journal, photos, updates</p>
            </div>
            <IconChevron />
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
          {homeNearYouTools().map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={styles.nearItem}
              role="listitem"
              onClick={() => openNearYou(tool.id)}
            >
              <span className={styles.nearCircle} aria-hidden>
                <NearYouToolIcon toolId={tool.id} size="md" />
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
          <button type="button" className={styles.sectionLink} onClick={() => setTab('trips')}>
            View all
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
            className={`${styles.tripCard} ${styles.tripCardFeatured}`}
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

        <div className={styles.homeSplitRow}>
          <MobileHomeUpcoming trip={featuredTrip} onOpenTrip={onSelectTrip} />
          <MobileIdeasJotter
            trip={featuredTrip}
            homeActive={tab === 'home'}
            onViewAllIdeas={
              featuredTrip
                ? () => {
                    setPendingMobileListsIdeas(false);
                    onSelectTrip(featuredTrip.id, 'lists');
                  }
                : undefined
            }
          />
        </div>

        <MobileAddToTripMenu tripId={featuredTrip?.id} role={contextRole} onSelectTrip={onSelectTrip} />
      </div>
    );
  }

  const homeBrandActions = (
    <>
      <button
        type="button"
        className={styles.avatarBtn}
        aria-label="Trip access"
        disabled={!contextTrip?.id}
        onClick={() => setMembersOpen(true)}
      >
        <TravellerAvatar
          displayName={myMember?.userDisplayName || greetingName || displayName}
          avatarUrl={myMember?.avatarUrl}
          size={36}
        />
      </button>
      <button type="button" className={styles.iconBtn} aria-label="Traveller profile" onClick={onOpenSettings}>
        <IconGear />
      </button>
    </>
  );

  const homeTabTitle =
    tab === 'trips' ? 'Trips' : tab === 'spots' ? 'Spots' : tab === 'book' ? 'Book' : tab === 'find' ? 'Find' : '';
  const homeTabSub =
    tab === 'trips'
      ? 'Your travel plans'
      : tab === 'spots'
        ? 'Mapped places across your trips'
        : tab === 'book'
          ? 'Search partner sites for stays, flights, tours and more.'
          : tab === 'find'
            ? 'Tools and suggestions near you'
            : '';

  return (
    <div className={styles.homeRoot} data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      <main className={styles.scroll}>
        {tab !== 'home' ? (
          <MobileBrandHeader
            safeAreaTop={false}
            actions={homeBrandActions}
            navRow={
              <button type="button" className={styles.tripsBackBtn} onClick={() => setTab('home')}>
                {'< Home'}
              </button>
            }
            title={homeTabTitle}
            subtitle={homeTabSub}
          />
        ) : null}
        {body}
      </main>
      {contextTrip?.id ? (
        <TripRoleProvider tripId={contextTrip.id}>
          <TripMembersPanel tripId={contextTrip.id} isOpen={membersOpen} onClose={() => setMembersOpen(false)} />
        </TripRoleProvider>
      ) : null}
      {homeAskPrompt && contextTrip?.id ? (
        <MobileHomeAskAiSheet
          tripId={contextTrip.id}
          prompt={homeAskPrompt}
          onClose={() => setHomeAskPrompt(null)}
          onAddToItinerary={
            contextRole === 'Editor'
              ? (place) => {
                  void addNearToItinerary(place);
                  setHomeAskPrompt(null);
                }
              : undefined
          }
        />
      ) : null}
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
          className={`${styles.navBtn} ${tab === 'find' ? styles.navBtnActive : ''}`}
          onClick={() => openNearYou(null)}
        >
          <IconFind />
          Find
          {tab === 'find' ? <span className={styles.navDot} /> : null}
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${tab === 'book' ? styles.navBtnActive : ''}`}
          onClick={() => setTab('book')}
        >
          <IconBook />
          Book
          {tab === 'book' ? <span className={styles.navDot} /> : null}
        </button>
      </nav>
    </div>
  );
};
