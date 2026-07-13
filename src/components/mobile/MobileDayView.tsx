import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripRole } from '../../context/TripRoleContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { sortEntriesForDay, isPreTripDayRow, resolvePreTripDayId } from '../../utils/itineraryDayEntries';
import {
  expandPlannerTimedItems,
  expandPlannerUnscheduledItems,
  shouldRenderPlannerItem
} from '../../utils/plannerCalendarItems';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { getCategorySlug } from '../../utils/categoryUtils';
import { CategoryIcon } from '../shared/CategoryIcon';
import { DayLocationInfoStrip } from '../itinerary/DayLocationInfoStrip';
import { locationInfoEntriesForDay } from '../../utils/locationInfoDayResolve';
import { parseLocationInfoNotes } from '../../utils/locationInfoEntry';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { resolveSharePointMediaSrc } from '../../utils/sharePointUrl';
import { useConfig } from '../../context/ConfigContext';
import { MobileDayMapSnippet } from './MobileDayMapSnippet';
import { MobileCardDetail } from './MobileCardDetail';
import { MobileLocationInfoSheet } from './MobileLocationInfoSheet';
import { MobileWeatherSheet } from './MobileWeatherSheet';
import { MobileStayCruiseTile } from './MobileStayCruiseTile';
import { MobileDayIdeas } from './MobileDayIdeas';
import { WeatherIcon } from '../shared/WeatherIcon';
import { findStayTileForDay } from '../../utils/mobileDayStay';
import {
  defaultTripDayId,
  peekPendingTripDayPayload
} from '../../utils/mobileTripDayPending';
import { itineraryEntryFromSubItem } from '../../utils/mobileSubItemEntry';
import { useMobileDetailHistory } from '../../hooks/useMobileDetailHistory';
import { useShellMode } from '../../hooks/useShellMode';
import { EXPAND_UNSCHEDULED_EVENT, notifyExpandUnscheduled } from '../../utils/mobileItineraryUiEvents';
import { consumePendingItineraryAdd, consumePendingItineraryPickDay, peekPendingItineraryAdd, peekPendingItineraryPickDay } from '../../utils/mobileHomePendingAction';
import { MobileItineraryDayPicker } from './MobileItineraryDayPicker';
import styles from './MobileItinerary.module.css';
import shellStyles from './MobileShell.module.css';

export interface MobileDetailTarget {
  entryId: string;
  subItemId?: string;
}

export interface MobileDayViewProps {
  onOpenMembers?: () => void;
  onAskAi?: (prompt?: string) => void;
  onDetailChange?: (open: boolean, close?: () => void) => void;
}

function ymdToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function ymdTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatPlannerMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return formatTimeHHMM(`${pad2(h)}:${pad2(m)}`);
}

function weekdayLabel(calendarDate: string | undefined): string {
  const raw = (calendarDate || '').slice(0, 10);
  if (!raw) return '';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { weekday: 'long' });
}

function shortDate(calendarDate: string | undefined): string {
  const raw = (calendarDate || '').slice(0, 10);
  if (!raw) return '';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

/** Mockup-style range under trip title: "12 – 26 Jul 2025" */
function shortDateRange(dateStart: string, dateEnd: string): string {
  const s = new Date(`${dateStart.slice(0, 10)}T00:00:00`);
  const e = new Date(`${dateEnd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const dayMonth = (d: Date, withYear: boolean): string =>
    d.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {})
    });
  if (sameMonth) {
    return `${s.getDate()} – ${dayMonth(e, true)}`;
  }
  if (sameYear) {
    return `${dayMonth(s, false)} – ${dayMonth(e, true)}`;
  }
  return `${dayMonth(s, true)} – ${dayMonth(e, true)}`;
}

function durationDays(dateStart: string, dateEnd: string): number {
  const s = new Date(`${dateStart.slice(0, 10)}T00:00:00`);
  const e = new Date(`${dateEnd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function firstSentence(text: string): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const match = clean.match(/[^.!?]*[.!?]/);
  return match ? match[0].trim() : clean.slice(0, 120);
}

function newDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `new-${crypto.randomUUID()}`;
  }
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function placeShort(title: string | undefined): string {
  return (title || '').split(',')[0].trim();
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const MAX_VISIBLE_AVATARS = 3;

export const MobileDayView: React.FC<MobileDayViewProps> = ({ onOpenMembers, onAskAi, onDetailChange }) => {
  const shellMode = useShellMode();
  const { trip, tripDays, localEntries, selectedDayId, setSelectedDayId, updateEntry, setEditingCardId, loading } =
    useTripWorkspace();
  const { role } = useTripRole();
  const { placeById } = usePlaces();
  const sp = useSpContext();
  const { config } = useConfig();
  const { members } = useTripMembers(trip?.id);

  const [detailTarget, setDetailTarget] = React.useState<MobileDetailTarget | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [locationPanelEntryId, setLocationPanelEntryId] = React.useState<string | null>(null);
  const [unschedOpen, setUnschedOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [dayPickOpen, setDayPickOpen] = React.useState(false);
  const [weatherLabel, setWeatherLabel] = React.useState('');
  const [weatherIconCode, setWeatherIconCode] = React.useState('');
  const [weatherOpen, setWeatherOpen] = React.useState(false);

  const carouselRef = React.useRef<HTMLDivElement>(null);

  const isEditor = role === 'Editor';

  const days = React.useMemo(
    () => {
      if (!trip) return [];
      const rows = tripDays.filter((d) => d.tripId === trip.id);
      const visible = isEditor ? rows : rows.filter((d) => !isPreTripDayRow(d));
      return visible.sort((a, b) => a.dayNumber - b.dayNumber);
    },
    [trip, tripDays, isEditor]
  );

  React.useEffect(() => {
    if (!days.length) return;
    if (selectedDayId && days.some((d) => d.id === selectedDayId)) return;
    if (trip?.id && peekPendingTripDayPayload(trip.id)) return;
    const fallback = defaultTripDayId(days);
    if (fallback) setSelectedDayId(fallback);
  }, [days, selectedDayId, setSelectedDayId, trip?.id]);

  const day = days.find((d) => d.id === selectedDayId) ?? days[0];
  const preTripDayId = resolvePreTripDayId(tripDays, trip?.id ?? '');

  const dayEntries = React.useMemo(() => {
    if (!day || !trip) return [];
    return sortEntriesForDay(
      localEntries,
      day.id,
      day.calendarDate,
      day.dayType,
      preTripDayId,
      isPreTripDayRow(day),
      tripDays
    ).filter((e) => !e.parentEntryId);
  }, [day, trip, localEntries, preTripDayId, tripDays]);

  const unscheduledRaw = React.useMemo(() => {
    if (!day) return [];
    return expandPlannerUnscheduledItems(dayEntries, day.calendarDate, tripDays, localEntries);
  }, [day, dayEntries, tripDays, localEntries]);

  const timed = React.useMemo(() => {
    if (!day) return [];
    return expandPlannerTimedItems(dayEntries, day.calendarDate, tripDays, localEntries).filter((item) =>
      shouldRenderPlannerItem(item, day.calendarDate)
    );
  }, [day, dayEntries, tripDays, localEntries]);

  const stayTile = React.useMemo(() => {
    if (!day?.calendarDate) return undefined;
    return findStayTileForDay(localEntries, day.calendarDate);
  }, [day?.calendarDate, localEntries]);

  const unscheduled = React.useMemo(() => {
    const stayId = stayTile?.entry?.id;
    if (!stayId) return unscheduledRaw;
    return unscheduledRaw.filter((item) => item.entry.id !== stayId);
  }, [unscheduledRaw, stayTile?.entry?.id]);

  React.useEffect(() => {
    const handler = (): void => setUnschedOpen(true);
    window.addEventListener(EXPAND_UNSCHEDULED_EVENT, handler);
    return () => window.removeEventListener(EXPAND_UNSCHEDULED_EVENT, handler);
  }, []);

  const detailSourceEntry = detailTarget ? localEntries.find((e) => e.id === detailTarget.entryId) : undefined;
  const detailDisplayEntry = React.useMemo(() => {
    if (!detailSourceEntry || !detailTarget) return undefined;
    if (!detailTarget.subItemId) return detailSourceEntry;
    const sub = (detailSourceEntry.subItems ?? []).find((s) => s.id === detailTarget.subItemId);
    if (!sub) return detailSourceEntry;
    return itineraryEntryFromSubItem(detailSourceEntry, sub);
  }, [detailSourceEntry, detailTarget]);

  const openDetail = React.useCallback((entryId: string, subItemId?: string) => {
    setDetailTarget({ entryId, subItemId });
  }, []);

  const { closeDetail } = useMobileDetailHistory(detailTarget, setDetailTarget);

  React.useEffect(() => {
    onDetailChange?.(Boolean(detailTarget), closeDetail);
  }, [detailTarget, onDetailChange, closeDetail]);
  const dayLocationEntries = React.useMemo(() => {
    if (!day || !trip) return [];
    return locationInfoEntriesForDay(day, localEntries, trip.id);
  }, [day, localEntries, trip]);

  React.useEffect(() => {
    if (!dayLocationEntries.length) {
      setLocationPanelEntryId(null);
      return;
    }
    setLocationPanelEntryId((current) => {
      if (current && dayLocationEntries.some((e) => e.id === current)) return current;
      return dayLocationEntries[0].id;
    });
  }, [day?.id, dayLocationEntries]);

  const locationPanelEntry = locationPanelEntryId
    ? localEntries.find((e) => e.id === locationPanelEntryId) ?? null
    : null;

  const jumpToDate = (ymd: string): void => {
    const match = days.find((d) => (d.calendarDate || '').slice(0, 10) === ymd);
    if (match) setSelectedDayId(match.id);
  };

  const dayIndex = days.findIndex((d) => d.id === (day?.id ?? ''));

  React.useEffect(() => {
    const ref = carouselRef.current;
    if (!ref || dayIndex < 0) return;
    const chips = ref.querySelectorAll<HTMLElement>('[data-dayidx]');
    const active = Array.from(chips).find((el) => el.dataset.dayidx === String(dayIndex));
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [dayIndex]);

  const heroSrc = React.useMemo(() => {
    const raw = (trip?.heroImageUrl || '').trim();
    if (!raw) return null;
    return resolveSharePointMediaSrc(raw, sp.pageContext.web.absoluteUrl, sp.pageContext.web.serverRelativeUrl || '');
  }, [trip?.heroImageUrl, sp]);

  const primaryPlace = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
  const primaryPlaceLabel = placeShort(primaryPlace?.title);

  React.useEffect(() => {
    const key = (config.weatherApiKey || '').trim();
    const lat = Number(primaryPlace?.latitude);
    const lng = Number(primaryPlace?.longitude);
    const ymd = (day?.calendarDate || '').slice(0, 10);
    if (!key || !primaryPlace || !Number.isFinite(lat) || !Number.isFinite(lng) || !ymd) {
      setWeatherLabel('');
      setWeatherIconCode('');
      return;
    }
    let cancelled = false;
    const units = config.temperatureUnit === 'Fahrenheit' ? 'us' : 'metric';
    const unitSuffix = config.temperatureUnit === 'Fahrenheit' ? '°F' : '°';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lng}/${ymd}?key=${encodeURIComponent(key)}&unitGroup=${units}&include=days&contentType=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Weather ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const row = (data.days ?? [])[0] ?? {};
        const temp = Number(row.temp ?? row.tempmax);
        const conditions = String(row.conditions ?? '').trim();
        if (!Number.isFinite(temp) && !conditions) {
          setWeatherLabel('');
          setWeatherIconCode('');
          return;
        }
        const tempPart = Number.isFinite(temp) ? `${Math.round(temp)}${unitSuffix}` : '';
        setWeatherLabel([tempPart, conditions].filter(Boolean).join(' '));
        setWeatherIconCode(String(row.icon ?? ''));
      })
      .catch(() => {
        if (!cancelled) {
          setWeatherLabel('');
          setWeatherIconCode('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    config.weatherApiKey,
    config.temperatureUnit,
    primaryPlace?.id,
    primaryPlace?.latitude,
    primaryPlace?.longitude,
    day?.calendarDate
  ]);

  const travelTip = React.useMemo(() => {
    for (const entry of dayLocationEntries) {
      const notes = parseLocationInfoNotes(entry.notes);
      if (notes?.practicalTips) {
        const s = firstSentence(notes.practicalTips);
        if (s) return s;
      }
    }
    return 'Tap a card for details. Use Ask AI for local ideas.';
  }, [dayLocationEntries]);

  const tripDuration =
    trip?.dateStart && trip?.dateEnd ? durationDays(trip.dateStart, trip.dateEnd) : 0;

  const travellerMembers = members.filter((m) => m.role !== 'Follower');
  const visibleMembers = travellerMembers.slice(0, MAX_VISIBLE_AVATARS);
  const extraMembers = Math.max(0, travellerMembers.length - MAX_VISIBLE_AVATARS);

  const handleAddItem = React.useCallback(
    (targetDayId?: string) => {
      if (!trip) return;
      const targetDay = days.find((d) => d.id === targetDayId) ?? day;
      if (!targetDay) return;
      setAdding(true);
      const targetEntries = sortEntriesForDay(
        localEntries,
        targetDay.id,
        targetDay.calendarDate,
        targetDay.dayType,
        preTripDayId,
        isPreTripDayRow(targetDay),
        tripDays
      ).filter((e) => !e.parentEntryId);
      const draft = {
        id: newDraftId(),
        tripId: trip.id,
        dayId: targetDay.id,
        title: 'New item',
        category: 'Other',
        location: '',
        timeStart: '',
        duration: '',
        supplier: '',
        notes: '',
        decisionStatus: 'Idea' as const,
        bookingRequired: false,
        bookingStatus: 'Not booked' as const,
        paymentStatus: 'Not paid' as const,
        amount: 0,
        currency: 'NZD',
        sortOrder: targetEntries.length + 1,
        subItems: []
      };
      if (targetDay.id !== selectedDayId) {
        setSelectedDayId(targetDay.id);
      }
      updateEntry(draft);
      window.setTimeout(() => {
        setAdding(false);
        setUnschedOpen(true);
        setEditingCardId(draft.id);
        notifyExpandUnscheduled();
      }, 300);
    },
    [trip, day, days, localEntries, preTripDayId, tripDays, selectedDayId, setSelectedDayId, updateEntry, setEditingCardId]
  );

  const beginItineraryAdd = React.useCallback(() => {
    if (peekPendingItineraryPickDay()) {
      consumePendingItineraryPickDay();
      setDayPickOpen(true);
      return;
    }
    if (consumePendingItineraryAdd()) {
      handleAddItem();
    }
  }, [handleAddItem]);

  React.useEffect(() => {
    if (!trip || !days.length) return;
    if (!peekPendingItineraryPickDay() && !peekPendingItineraryAdd()) return;
    beginItineraryAdd();
  }, [trip, days.length, beginItineraryAdd]);

  React.useEffect(() => {
    const handler = (): void => {
      beginItineraryAdd();
    };
    window.addEventListener('travelhub-mobile-start-itinerary-add', handler);
    return () => window.removeEventListener('travelhub-mobile-start-itinerary-add', handler);
  }, [beginItineraryAdd]);

  const handleAskAi = (): void => {
    const p = aiPrompt.trim();
    if (onAskAi) onAskAi(p || undefined);
    setAiPrompt('');
  };

  const tripStartYmd = (trip?.dateStart || '').slice(0, 10);
  const tripEndYmd = (trip?.dateEnd || '').slice(0, 10);
  const dayYmd = (day?.calendarDate || '').slice(0, 10);
  const rangeLabel =
    tripStartYmd && tripEndYmd ? shortDateRange(tripStartYmd, tripEndYmd) : '';

  const mapQuery = primaryPlace
    ? [primaryPlace.title, primaryPlace.country].filter(Boolean).join(', ')
    : trip?.title || 'trip';

  const dayRoutePoints = React.useMemo(() => {
    const pts: Array<{ lat: number; lng: number; label?: string }> = [];
    const seen = new Set<string>();
    for (const entry of dayLocationEntries) {
      const notes = parseLocationInfoNotes(entry.notes);
      const place = notes?.placeId ? placeById(notes.placeId) : undefined;
      const lat = Number(place?.latitude);
      const lng = Number(place?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pts.push({ lat, lng, label: placeShort(place?.title) || entry.title });
    }
    if (pts.length < 2 && primaryPlace) {
      const lat = Number(primaryPlace.latitude);
      const lng = Number(primaryPlace.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [{ lat, lng, label: primaryPlaceLabel }];
      }
    }
    return pts;
  }, [dayLocationEntries, placeById, primaryPlace, primaryPlaceLabel]);

  if (loading) return <p className={shellStyles.muted}>Loading your itinerary…</p>;
  if (!trip) return <p className={shellStyles.muted}>Open a trip to view the itinerary.</p>;
  if (!day) return <p className={shellStyles.muted}>This trip has no days yet — add dates in trip settings on desktop.</p>;

  if (detailSourceEntry && detailDisplayEntry) {
    return (
      <MobileCardDetail
        sourceEntry={detailSourceEntry}
        displayEntry={detailDisplayEntry}
        calendarDate={day.calendarDate || ''}
        optionSubItemId={detailTarget?.subItemId}
        onClose={closeDetail}
        onOpenPlannedActivity={(subItemId) => openDetail(detailSourceEntry.id, subItemId)}
      />
    );
  }

  return (
    <div
      className={styles.itinRoot}
      data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
    >
      <div className={styles.tripHeader}>
        <div className={styles.tripMeta}>
          <div className={styles.tripTitleRow}>
            <h2 className={styles.tripTitle}>{trip.title}</h2>
          </div>
          {rangeLabel ? <p className={styles.tripDateRange}>{rangeLabel}</p> : null}
        </div>
        <div className={styles.tripHeaderRight}>
          {heroSrc ? (
            <img src={heroSrc} alt="" className={styles.heroThumb} />
          ) : (
            <div className={styles.heroThumbPlaceholder} />
          )}
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="2" y="3.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 2v2.5M11 2v2.5M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className={styles.statLabel}>Dates</span>
          </div>
          <span className={styles.statValue}>{rangeLabel || '—'}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 5.5h8v7.5H4V5.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path d="M6 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span className={styles.statLabel}>Duration</span>
          </div>
          <span className={styles.statValue}>{tripDuration > 0 ? `${tripDuration} days` : '—'}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="6" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 13c0-2.2 1.8-4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="11" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span className={styles.statLabel}>Travellers</span>
          </div>
          {travellerMembers.length > 0 ? (
            <div className={styles.avatarStack}>
              {visibleMembers.map((m) => (
                <TravellerAvatar
                  key={m.id}
                  displayName={m.userDisplayName || m.userEmail}
                  avatarUrl={m.avatarUrl}
                  size={22}
                  title={m.userDisplayName || m.userEmail}
                />
              ))}
              {extraMembers > 0 ? <span className={styles.avatarMore}>+{extraMembers}</span> : null}
            </div>
          ) : (
            <span className={styles.statValue}>—</span>
          )}
        </div>
      </div>

      <div className={styles.dayCarouselWrap}>
        <div className={styles.dayCarousel} ref={carouselRef}>
          {days.map((d, idx) => {
            const placeForDay = d.primaryPlaceId ? placeById(d.primaryPlaceId) : undefined;
            const placeLabel = placeShort(placeForDay?.title);
            const active = d.id === day.id;
            return (
              <button
                key={d.id}
                type="button"
                data-dayidx={idx}
                className={`${styles.dayChip} ${active ? styles.dayChipActive : ''}`}
                onClick={() => setSelectedDayId(d.id)}
                aria-label={`Day ${d.dayNumber}`}
              >
                <span className={styles.dayChipNum}>Day {d.dayNumber}</span>
                <span className={styles.dayChipDate}>{shortDate(d.calendarDate)}</span>
                {placeLabel ? <span className={styles.dayChipPlace}>{placeLabel}</span> : null}
              </button>
            );
          })}
        </div>
        {days.length > 3 ? (
          <span className={styles.dayScrollHint} aria-hidden>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 1.5 7 5 3.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
        ) : null}
        <div className={styles.dayCarouselFade} aria-hidden />
      </div>

      <div className={styles.dayNavBar}>
        <button type="button" className={styles.dayNavChip} onClick={() => jumpToDate(ymdToday())}>
          Today
        </button>
        <button type="button" className={styles.dayNavChip} onClick={() => jumpToDate(ymdTomorrow())}>
          Tmrw
        </button>
        <button
          type="button"
          className={styles.dayNavChip}
          disabled={dayIndex <= 0}
          onClick={() => dayIndex > 0 && setSelectedDayId(days[dayIndex - 1].id)}
          aria-label="Previous day"
        >
          ←
        </button>
        <button
          type="button"
          className={styles.dayNavChip}
          disabled={dayIndex < 0 || dayIndex >= days.length - 1}
          onClick={() => dayIndex >= 0 && dayIndex < days.length - 1 && setSelectedDayId(days[dayIndex + 1].id)}
          aria-label="Next day"
        >
          →
        </button>
        <input
          type="date"
          className={styles.dateInputCompact}
          min={tripStartYmd || undefined}
          max={tripEndYmd || undefined}
          value={dayYmd}
          onChange={(e) => jumpToDate(e.target.value)}
          aria-label="Go to date within trip"
        />
      </div>

      <div className={styles.dayHeader}>
        <div className={styles.dayHeaderLeft}>
          <p className={styles.dayHeaderLine}>
            <span className={styles.dayHeaderWeekday}>{weekdayLabel(day?.calendarDate)}</span>
            {shortDate(day?.calendarDate) ? (
              <span className={styles.dayHeaderRest}>
                {weekdayLabel(day?.calendarDate) ? ' · ' : ''}
                {shortDate(day?.calendarDate)}
                {day ? ` · Day ${day.dayNumber}` : ''}
              </span>
            ) : day ? (
              <span className={styles.dayHeaderRest}>{`Day ${day.dayNumber}`}</span>
            ) : null}
          </p>
          {primaryPlaceLabel ? (
            <div className={styles.dayHeaderPlace}>
              <svg width="11" height="11" viewBox="0 0 12 14" fill="none" aria-hidden>
                <path
                  d="M6 1C3.79 1 2 2.79 2 5c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z"
                  fill="currentColor"
                  opacity="0.85"
                />
                <circle cx="6" cy="5" r="1.5" fill="white" />
              </svg>
              {primaryPlaceLabel}
            </div>
          ) : null}
        </div>
        {weatherLabel && primaryPlace ? (
          <button
            type="button"
            className={styles.weatherChip}
            aria-label={`Weather ${weatherLabel}. Tap for full forecast.`}
            onClick={() => setWeatherOpen(true)}
          >
            <span className={styles.weatherIcon} aria-hidden>
              <WeatherIcon iconCode={weatherIconCode || 'cloudy'} size={18} />
            </span>
            <span className={styles.weatherText}>{weatherLabel}</span>
          </button>
        ) : null}
      </div>

      {dayLocationEntries.length ? (
        <div className={styles.locationStripWrap}>
          <p className={styles.locationStripHint}>Tap a place for weather, tips, currency and saved suggestions.</p>
          <DayLocationInfoStrip
            entries={dayLocationEntries}
            activeEntryId={locationPanelEntryId}
            onSelect={setLocationPanelEntryId}
            variant="pills"
          />
        </div>
      ) : null}
      <MobileLocationInfoSheet
        entry={locationPanelEntry}
        calendarDate={day.calendarDate || ''}
        onClose={() => setLocationPanelEntryId(null)}
      />
      {weatherOpen && primaryPlace ? (
        <MobileWeatherSheet
          place={primaryPlace}
          calendarDate={day.calendarDate || ''}
          travelTip={travelTip}
          onClose={() => setWeatherOpen(false)}
        />
      ) : null}

      <div
        className={styles.dayPanel}
        onTouchStart={(e) => {
          const t = e.changedTouches[0] ?? e.touches[0];
          if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start || dayIndex < 0) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
          if (dx < 0 && dayIndex < days.length - 1) setSelectedDayId(days[dayIndex + 1].id);
          if (dx > 0 && dayIndex > 0) setSelectedDayId(days[dayIndex - 1].id);
        }}
      >
        {adding ? (
          <div className={styles.addingBanner}>
            <div className={styles.addingSpinner} />
            <span>Creating new item…</span>
          </div>
        ) : null}

        {stayTile ? (
          <MobileStayCruiseTile
            mode={stayTile.mode}
            entry={stayTile.entry}
            calendarDate={day.calendarDate || ''}
            onOpenDetail={() => openDetail(stayTile.entry.id)}
          />
        ) : null}

        {unscheduled.length > 0 ? (
          <div className={styles.unschedSection}>
            <button type="button" className={styles.unschedToggle} onClick={() => setUnschedOpen((v) => !v)}>
              <span>Unscheduled</span>
              <span className={styles.unschedMeta}>
                {unscheduled.length} · {unschedOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {unschedOpen ? (
              <div className={styles.unschedBody}>
                {unscheduled.map((item) => {
                  const cat = item.entry.category;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.unschedCard}
                      onClick={() => openDetail(item.entry.id, item.subItem?.id)}
                    >
                      <span className={`${styles.unschedCat} th-cat-${getCategorySlug(cat)}`}>
                        <CategoryIcon category={cat} size={12} color="white" />
                      </span>
                      <span className={styles.cardText}>
                        <div className={styles.cardTitle}>{item.title}</div>
                        <div className={styles.cardMeta}>
                          {item.subItem
                            ? (item.subItem.category || item.entry.category)
                            : item.entry.category}
                        </div>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {timed.length > 0 ? (
          <div className={styles.timelineWrap}>
            <div className={styles.timelineRail} aria-hidden />
            {timed.map((item) => {
              const cat = item.category || item.entry.category;
              const categorySlug = getCategorySlug(cat);
              const timeLabel = formatPlannerMinutes(item.startMinutes);
              const locationLabel = item.entry.location?.trim() || '';
              return (
                <div key={item.key} className={styles.timelineRow}>
                  <div className={styles.timeCell}>{timeLabel}</div>
                  <div className={styles.nodeWrap}>
                    <div className={`${styles.catBubble} th-cat-${categorySlug}`}>
                      <CategoryIcon category={cat} size={14} color="white" />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.timelineCard}
                    onClick={() => openDetail(item.entry.id, item.subItem?.id)}
                  >
                    <span className={styles.cardText}>
                      <div className={styles.cardTitle}>{item.title}</div>
                      <div className={styles.cardMeta}>
                        {locationLabel || item.entry.category}
                      </div>
                    </span>
                    <span className={`${styles.cardTrail} th-cat-${categorySlug}`}>
                      <CategoryIcon category={cat} size={12} color="currentColor" />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : timed.length === 0 && unscheduled.length === 0 ? (
          <p className={styles.emptyDay}>No itinerary items for this day yet.</p>
        ) : null}

        <MobileDayIdeas dayId={day.id} />
      </div>

      <div className={styles.aiBarWrap}>
        <div className={styles.aiBarInner}>
          <span className={styles.aiSparkle} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5l1.1 3.4L12.5 6 9.1 7.1 8 10.5 6.9 7.1 3.5 6l3.4-1.1L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M12.5 10.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" fill="currentColor" />
            </svg>
          </span>
          <input
            type="text"
            className={styles.aiBarInput}
            placeholder={`Ask AI about ${primaryPlaceLabel || 'this day'}…`}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAskAi();
            }}
            aria-label="Ask AI about this day"
          />
          <button type="button" className={styles.aiBarSend} onClick={handleAskAi} aria-label="Ask AI">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 8l12-6-6 12-2-4-4-2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.bottomWidgets}>
        <MobileDayMapSnippet
          latitude={Number(primaryPlace?.latitude)}
          longitude={Number(primaryPlace?.longitude)}
          label={primaryPlaceLabel || 'Day map'}
          routePoints={dayRoutePoints}
          mapsHref={mapsSearchUrl(mapQuery)}
        />
        <div className={styles.travelTipCard}>
          <p className={styles.travelTipTitle}>Travel tip</p>
          <p className={styles.travelTipText}>{travelTip}</p>
          {dayLocationEntries[0] ? (
            <button
              type="button"
              className={styles.travelTipMore}
              onClick={() => setLocationPanelEntryId(dayLocationEntries[0].id)}
            >
              See more tips
            </button>
          ) : null}
        </div>
      </div>

      {isEditor ? (
        <button
          type="button"
          className={styles.addFab}
          onClick={() => handleAddItem()}
          aria-label="Add itinerary item"
          title="Add item to this day"
        >
          +
        </button>
      ) : null}
      {dayPickOpen ? (
        <MobileItineraryDayPicker
          days={days}
          showPreTrip={isEditor}
          onSelect={(dayId) => {
            setDayPickOpen(false);
            handleAddItem(dayId);
          }}
          onCancel={() => setDayPickOpen(false)}
        />
      ) : null}
    </div>
  );
};
