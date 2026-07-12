import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { EntryDocument, EntryLink } from '../../models';
import type { TripDay } from '../../models/TripDay';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useAttachments } from '../../context/AttachmentsContext';
import {
  effectivePlannerTimeStart,
  formatEntryScheduleHero,
  isTransportReturnOnCalendarDate,
  isPreTripDayRow,
  resolvePreTripDayId,
  sortEntriesForDay
} from '../../utils/itineraryDayEntries';
import type { TransportTimelineLeg } from '../../utils/itineraryDayEntries';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { getCategorySlug } from '../../utils/categoryUtils';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { formatCurrency } from '../../utils/financialUtils';
import { ItineraryCard } from './ItineraryCard';
import { DayLocationInfoStrip } from './DayLocationInfoStrip';
import { LocationInfoSlidePanel } from './LocationInfoSlidePanel';
import { SubItemDetailLines } from './SubItemDetailLines';
import { applyDayViewEntryOrder } from '../../utils/dayViewEntryOrder';
import { locationInfoEntriesForDay } from '../../utils/locationInfoDayResolve';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import {
  expandPlannerTimedItems,
  expandPlannerUnscheduledItems,
  shouldRenderPlannerItem,
  isCruisePortEntry
} from '../../utils/plannerCalendarItems';
import type { PlannerTimedItem } from '../../utils/plannerCalendarItems';
import type { DayPlannerPrintDay } from '../../utils/dayPlannerPrint';
import { DayPlannerPrintSheet, buildPlannerPrintHtml } from './DayPlannerPrintSheet';
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../../utils/googleMapsLink';
import { formatActivityScheduleLabel } from '../../utils/activityScheduleLabel';
import { formatDayDateOrdinal } from '../../utils/dateUtils';
import { formatLocationText } from '../../utils/placeDisplayLabel';
import { durationFromDateTimes } from '../../utils/durationFromTimes';
import styles from './ItineraryDayPlannerView.module.css';

/** Fixed day column width keeps unscheduled headers aligned with timed tracks. */
const PLANNER_DAY_COL = '13.5rem';

export type PlannerFilter =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'days_remaining'
  | 'entire_trip'
  | 'custom_range';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = c.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  c.setDate(c.getDate() + diff);
  return c;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function parseDurationMinutes(duration: string): number {
  const t = (duration || '').trim().toLowerCase();
  if (!t) return 60;
  let m = 0;
  const h = t.match(/(\d+(?:\.\d+)?)\s*h/);
  if (h) m += Math.round(parseFloat(h[1]) * 60);
  const mm = t.match(/(\d+)\s*m(?:in)?/);
  if (mm) m += parseInt(mm[1], 10);
  if (m <= 0 && /^\d+$/.test(t)) m = parseInt(t, 10) * 60;
  return m > 0 ? m : 60;
}

function formatYmdPreview(d?: string): string {
  if (!d) return '';
  const x = new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dayLabel(day: TripDay): string {
  return day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber} — ${day.displayTitle}`;
}

function PlannerDayHead({ day, className }: { day: TripDay; className: string }): React.ReactElement {
  return (
    <div className={className} data-planner-day-id={day.id}>
      <span className={styles.dayHeadTitle}>{dayLabel(day)}</span>
      {day.dayType !== 'PreTrip' && day.calendarDate ? (
        <span className={styles.dayHeadDate}>{formatDayDateOrdinal(day.calendarDate)}</span>
      ) : null}
    </div>
  );
}

function plannerBlockZIndex(
  item: PlannerTimedItem,
  timed: PlannerTimedItem[],
  frontBlockKey: string | null,
  isEditing: boolean
): number {
  if (isEditing) return 60;
  if (frontBlockKey === item.key) return 55;
  return 10 + item.startMinutes;
}

function plannerBlockScheduleHero(
  item: PlannerTimedItem,
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries: ItineraryEntry[]
): string | null {
  const leg = plannerItemTransportLeg(item, item.entry, calendarDate);
  return formatEntryScheduleHero(item.entry, calendarDate, tripDays, {
    transportLeg: leg,
    subItem: item.subItem,
    allEntries: tripEntries
  });
}

function plannerBlockMeta(item: PlannerTimedItem, calendarDate: string, tripDays: TripDay[]): string {
  if (item.subItem) {
    const schedule = formatActivityScheduleLabel({
      calendarDate,
      timeStart: item.subItem.startTime,
      duration: item.subItem.duration,
      arrivalTime: item.subItem.endTime
    });
    return schedule || '—';
  }
  if (item.key.includes('-port-')) {
    const arrive = formatTimeHHMM(item.entry.timeStart || '');
    const depart = formatTimeHHMM(item.entry.arrivalTime || '');
    if (item.key.includes('-disembark') && arrive) return arrive;
    if (item.key.includes('-embark') && depart) return depart;
    if (item.key.endsWith('-arrive') && arrive) return arrive;
    if (item.key.endsWith('-overnight')) {
      return arrive ? `Arrives ${arrive} · Overnight` : 'Overnight';
    }
    if (item.key.endsWith('-depart') && depart) return depart;
    return arrive || depart || '—';
  }
  if (item.key.includes('-flt-')) {
    const dep = formatTimeHHMM(item.entry.timeStart || '');
    const arr = formatTimeHHMM(item.entry.arrivalTime || '');
    const dur = item.entry.duration?.trim() || '';
    if (item.key.endsWith('-inflight')) return 'In flight';
    if (item.key.endsWith('-depart') && dep) return `${dep} · ${dur || 'overnight'}`.trim();
    if (item.key.endsWith('-arrive') && arr) return `Arrives ${arr}`;
    if (dep && dur) return `${dep} · ${dur}`;
    if (dep && arr) return `${dep}–${arr}`;
    return dep || arr || '—';
  }
  if (item.key.includes('-trn-')) {
    if (item.key.endsWith('-return')) {
      const ret = formatTimeHHMM(item.entry.returnTime || '');
      const retArr = formatTimeHHMM(item.entry.returnArrivalTime || '');
      const retDur =
        durationFromDateTimes({
          startDate: item.entry.returnDate,
          startTime: item.entry.returnTime,
          endDate: item.entry.returnDate,
          endTime: item.entry.returnArrivalTime
        }) || '';
      if (ret && retArr) return `Return ${ret}–${retArr}`;
      if (ret && retDur) return `Return ${ret} · ${retDur}`;
      if (ret) return `Return ${ret}`;
      return '—';
    }
    const out = formatTimeHHMM(item.entry.timeStart || '');
    const arr = formatTimeHHMM(item.entry.arrivalTime || '');
    const dur = item.entry.duration?.trim() || '';
    if (out && arr) return `${out}–${arr}`;
    if (out && dur) return `${out} · ${dur}`;
    if (out) return out;
    return '—';
  }
  if (item.key.includes('-acc-')) {
    if (item.key.endsWith('-checkin')) return formatTimeHHMM(item.entry.checkInTime || '') || '—';
    if (item.key.endsWith('-checkout')) return formatTimeHHMM(item.entry.checkOutTime || '') || '—';
  }
  if (isCruisePortEntry(item.entry)) {
    const arrive = formatTimeHHMM(item.entry.timeStart || '');
    const depart = formatTimeHHMM(item.entry.arrivalTime || '');
    if (arrive && depart) return `${arrive}–${depart}`;
    if (arrive) return `Arrives ${arrive}`;
    if (depart) return `Departs ${depart}`;
    return '—';
  }
  return `${formatTimeHHMM(effectivePlannerTimeStart(item.entry, calendarDate, tripDays))} · ${item.entry.duration?.trim() || '1h'}`;
}

function cancellationSnippet(entry: ItineraryEntry, sub?: ItinerarySubItem): string | undefined {
  const policy = (sub?.cancellationPolicy || entry.cancellationPolicy || '').trim();
  return policy || undefined;
}

function plannerBlockLocation(
  entry: ItineraryEntry,
  sub: ItinerarySubItem | undefined,
  day: TripDay
): string {
  const fromEntry = formatLocationText((sub?.location || entry.location || '').trim());
  if (fromEntry) return fromEntry;
  return formatLocationText((day.displayTitle || '').trim());
}

function plannerBlockSupplier(sub: ItinerarySubItem | undefined, entry: ItineraryEntry): string | undefined {
  const supplier = sub?.supplier?.trim() || entry.supplier?.trim();
  return supplier || undefined;
}

function isCruiseMainCard(entry: ItineraryEntry): boolean {
  if (isCruisePortEntry(entry)) return false;
  if ((entry.category || '').trim() === 'Cruise') return true;
  const t = (entry.title || '').toLowerCase();
  return t.includes('cruise');
}

function findAccommodationAnchor(entries: ItineraryEntry[]): ItineraryEntry | undefined {
  const accommodation = entries.find((e) => (e.category || '').trim() === 'Accommodation');
  if (accommodation) return accommodation;
  return entries.find((e) => isCruiseMainCard(e));
}

function stopPlannerBlockPointer(e: React.SyntheticEvent): void {
  e.stopPropagation();
}

function toggleFrontBlock(key: string, setFrontBlockKey: React.Dispatch<React.SetStateAction<string | null>>): void {
  setFrontBlockKey((prev) => (prev === key ? null : key));
}

function plannerBlockTitleClick(
  e: React.MouseEvent,
  key: string,
  setFrontBlockKey: React.Dispatch<React.SetStateAction<string | null>>
): void {
  if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
  toggleFrontBlock(key, setFrontBlockKey);
}

function plannerItemTransportLeg(
  item: { key: string },
  entry: ItineraryEntry,
  calendarDate: string
): TransportTimelineLeg | undefined {
  if (entry.category !== 'Transport') return undefined;
  if (item.key.endsWith('-return') || item.key.includes('-trn-return')) return 'return';
  if (item.key.endsWith('-outbound') || item.key.includes('-trn-outbound')) return 'outbound';
  if (isTransportReturnOnCalendarDate(entry, calendarDate)) return 'return';
  return 'outbound';
}

type PlannerPreviewContext = {
  dayId: string;
  calendarDate: string;
  transportLeg?: TransportTimelineLeg;
};

function DocGlyph(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function LinkGlyph(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 10l4-4M5 5h2M9 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PencilGlyph(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 11.8 11.6 3.2l1.2 1.2L4.2 13H3v-1.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 4.9 11.1 6.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeGlyph(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 8s2.5-4.25 6.5-4.25S14.5 8 14.5 8 12 12.25 8 12.25 1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PrintGlyph(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 5.5V3h7v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="5.5" width="10" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 13V10h5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function plannerStorageKeys(tripId: string): { rangeStart: string; rangeEnd: string } {
  return {
    rangeStart: `travelHub.planner.${tripId}.rangeStart`,
    rangeEnd: `travelHub.planner.${tripId}.rangeEnd`
  };
}

export const ItineraryDayPlannerView: React.FC = () => {
  const {
    trip,
    tripDays,
    localEntries,
    editingCardId,
    setEditingCardId,
    editingSubItem,
    setEditingSubItem,
    selectedDayId,
    setSelectedDayId
  } = useTripWorkspace();
  const { docsForEntry, linksForEntry } = useAttachments();
  const [filter, setFilter] = React.useState<PlannerFilter>('entire_trip');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');
  const [mobileDayIndex, setMobileDayIndex] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(false);
  const [unschedCollapsed, setUnschedCollapsed] = React.useState<Record<string, boolean>>({});
  const [rangeStartOverride, setRangeStartOverride] = React.useState('');
  const [rangeEndOverride, setRangeEndOverride] = React.useState('');
  const [previewEntryId, setPreviewEntryId] = React.useState<string | null>(null);
  const [plannerFullscreen, setPlannerFullscreen] = React.useState(false);
  const [plannerPrintHtml, setPlannerPrintHtml] = React.useState<string | null>(null);
  const [unschedSectionHidden, setUnschedSectionHidden] = React.useState(false);
  const [frontBlockKey, setFrontBlockKey] = React.useState<string | null>(null);
  const [previewContext, setPreviewContext] = React.useState<PlannerPreviewContext | null>(null);
  const [locationPanelEntryId, setLocationPanelEntryId] = React.useState<string | null>(null);
  const plannerDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const plannerFrameRef = React.useRef<HTMLDivElement | null>(null);
  const plannerVScrollRef = React.useRef<HTMLDivElement | null>(null);
  const plannerHScrollRef = React.useRef<HTMLDivElement | null>(null);
  const plannerHeadHScrollRef = React.useRef<HTMLDivElement | null>(null);
  const plannerScrollTopRef = React.useRef<HTMLDivElement | null>(null);
  const syncingFromSidebarRef = React.useRef(false);
  const selectedDayFromPlannerScrollRef = React.useRef(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = (): void => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const orderedDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const preTripDayId = React.useMemo(() => (trip ? resolvePreTripDayId(tripDays, trip.id) : undefined), [trip, tripDays]);

  const entriesForTrip = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id && !e.parentEntryId) : []),
    [trip, localEntries]
  );

  const entriesForPlannerColumn = React.useCallback(
    (day: TripDay): ItineraryEntry[] => {
      if (!trip) return [];
      const cal = day.calendarDate || '';
      const raw = sortEntriesForDay(
        entriesForTrip,
        day.id,
        cal,
        day.dayType,
        preTripDayId,
        isPreTripDayRow(day),
        tripDays
      );
      return applyDayViewEntryOrder(trip.id, day.id, raw, cal, tripDays).filter((e) => !isLocationInfoEntry(e));
    },
    [trip, entriesForTrip, preTripDayId, tripDays]
  );

  const locationPanelEntry = React.useMemo(
    () => (locationPanelEntryId ? localEntries.find((e) => e.id === locationPanelEntryId) ?? null : null),
    [localEntries, locationPanelEntryId]
  );

  const locationPanelCalendarDate = React.useMemo(() => {
    if (!locationPanelEntry || !trip) return '';
    const day = tripDays.find((d) => d.id === locationPanelEntry.dayId && d.tripId === trip.id);
    return day?.calendarDate ?? '';
  }, [locationPanelEntry, trip, tripDays]);

  const resolveSingleDate = React.useCallback((ymd: string): { days: TripDay[]; notice: string } => {
    if (!orderedDays.length) return { days: [], notice: '' };
    const preTrip = orderedDays.find((d) => d.dayType === 'PreTrip');
    const firstNonPreTrip = orderedDays.find((d) => d.dayType !== 'PreTrip') ?? orderedDays[0];
    const tripStart = (firstNonPreTrip.calendarDate || orderedDays[0].calendarDate || '').slice(0, 10);
    const tripEnd = (orderedDays[orderedDays.length - 1].calendarDate || '').slice(0, 10);
    if (ymd < tripStart) {
      const target = preTrip ?? firstNonPreTrip;
      const label = target.dayType === 'PreTrip' ? 'Pre-trip' : 'Day 1';
      return { days: [target], notice: `Before trip start — showing ${label}. Use Entire Trip or Custom Date Range options.` };
    }
    if (ymd > tripEnd) return { days: [orderedDays[orderedDays.length - 1]], notice: 'After trip end — showing last day' };
    const exact = orderedDays.filter((d) => (d.calendarDate || '').slice(0, 10) === ymd);
    if (exact.length) return { days: exact, notice: `Trip not started — showing ${dayLabel(exact[0])}` };
    const fallback = orderedDays.find((d) => (d.calendarDate || '').slice(0, 10) > ymd) ?? orderedDays[orderedDays.length - 1];
    return { days: [fallback], notice: `Trip not started — showing ${dayLabel(fallback)}` };
  }, [orderedDays]);

  const resolveFilterDays = React.useCallback((): { days: TripDay[]; notice: string } => {
    if (!trip) return { days: [], notice: '' };
    const today = new Date();
    const todayYmd = ymdLocal(today);
    const statusNeedsNotice = trip.status !== 'In Progress';
    const matchYmd = (ymd: string): TripDay[] => orderedDays.filter((d) => (d.calendarDate || '').slice(0, 10) === ymd);

    // If trip hasn't started yet, these quick filters should show Pre-trip (or Day 1) with a clear hint.
    const firstNonPreTrip = orderedDays.find((d) => d.dayType !== 'PreTrip') ?? orderedDays[0];
    const tripStart = (firstNonPreTrip.calendarDate || orderedDays[0]?.calendarDate || '').slice(0, 10);
    const quickFilters: PlannerFilter[] = ['today', 'yesterday', 'tomorrow', 'this_week', 'next_week', 'days_remaining'];
    if (statusNeedsNotice && tripStart && todayYmd < tripStart && quickFilters.indexOf(filter) >= 0) {
      return resolveSingleDate(todayYmd);
    }

    switch (filter) {
      case 'today':
        return statusNeedsNotice ? resolveSingleDate(todayYmd) : { days: matchYmd(todayYmd), notice: '' };
      case 'yesterday': {
        const y = addDays(today, -1);
        const ymd = ymdLocal(y);
        return statusNeedsNotice ? resolveSingleDate(ymd) : { days: matchYmd(ymd), notice: '' };
      }
      case 'tomorrow': {
        const y = addDays(today, 1);
        const ymd = ymdLocal(y);
        return statusNeedsNotice ? resolveSingleDate(ymd) : { days: matchYmd(ymd), notice: '' };
      }
      case 'this_week': {
        const s = startOfWeekMonday(today);
        const e = addDays(s, 6);
        const days = orderedDays.filter((d) => {
          const ymd = (d.calendarDate || '').slice(0, 10);
          return ymd >= ymdLocal(s) && ymd <= ymdLocal(e);
        });
        return statusNeedsNotice ? resolveSingleDate(todayYmd) : { days, notice: '' };
      }
      case 'next_week': {
        const nextStart = addDays(startOfWeekMonday(today), 7);
        const nextEnd = addDays(nextStart, 6);
        const days = orderedDays.filter((d) => {
          const ymd = (d.calendarDate || '').slice(0, 10);
          return ymd >= ymdLocal(nextStart) && ymd <= ymdLocal(nextEnd);
        });
        return statusNeedsNotice ? resolveSingleDate(todayYmd) : { days, notice: '' };
      }
      case 'days_remaining': {
        return statusNeedsNotice ? resolveSingleDate(todayYmd) : { days: orderedDays.filter((d) => (d.calendarDate || '').slice(0, 10) >= todayYmd), notice: '' };
      }
      case 'entire_trip':
        return { days: orderedDays.filter((d) => d.dayType !== 'PreTrip'), notice: '' };
      case 'custom_range': {
        if (!customStart || !customEnd) return { days: [], notice: '' };
        return { days: orderedDays.filter((d) => {
          const ymd = (d.calendarDate || '').slice(0, 10);
          return ymd >= customStart && ymd <= customEnd;
        }), notice: '' };
      }
      default:
        return { days: [], notice: '' };
    }
  }, [trip, orderedDays, filter, customStart, customEnd, resolveSingleDate]);

  const resolved = React.useMemo(() => resolveFilterDays(), [resolveFilterDays]);
  const visibleDays = resolved.days;
  const infoNotice = resolved.notice;

  React.useEffect(() => {
    if (!trip?.id) return;
    try {
      const { rangeStart, rangeEnd } = plannerStorageKeys(trip.id);
      const rs = window.localStorage.getItem(rangeStart) || '';
      const re = window.localStorage.getItem(rangeEnd) || '';
      setRangeStartOverride(rs);
      setRangeEndOverride(re);
    } catch {
      /* ignore */
    }
  }, [trip?.id]);

  React.useEffect(() => {
    if (!trip?.id) return;
    try {
      const { rangeStart, rangeEnd } = plannerStorageKeys(trip.id);
      if (rangeStartOverride) window.localStorage.setItem(rangeStart, rangeStartOverride);
      else window.localStorage.removeItem(rangeStart);
      if (rangeEndOverride) window.localStorage.setItem(rangeEnd, rangeEndOverride);
      else window.localStorage.removeItem(rangeEnd);
    } catch {
      /* ignore */
    }
  }, [trip?.id, rangeStartOverride, rangeEndOverride]);

  React.useEffect(() => {
    setMobileDayIndex(0);
  }, [filter, customStart, customEnd, orderedDays.length]);

  React.useEffect(() => {
    if (!plannerFullscreen) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPlannerFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plannerFullscreen]);

  const openPlannerFullScreen = React.useCallback((): void => {
    setPreviewEntryId(null);
    setPreviewContext(null);
    setPlannerFullscreen(true);
  }, []);

  React.useEffect(() => {
    if (mobileDayIndex >= visibleDays.length) {
      setMobileDayIndex(Math.max(0, visibleDays.length - 1));
    }
  }, [visibleDays.length, mobileDayIndex]);

  const displayDays = React.useMemo(() => {
    if (!visibleDays.length) return [];
    if (plannerFullscreen && !isMobile) return visibleDays;
    if (isMobile && visibleDays.length > 1) {
      const i = Math.min(Math.max(0, mobileDayIndex), visibleDays.length - 1);
      return [visibleDays[i]];
    }
    return visibleDays;
  }, [visibleDays, isMobile, mobileDayIndex, plannerFullscreen]);

  React.useEffect(() => {
    if (!selectedDayId || !plannerHScrollRef.current || isMobile) return;
    if (selectedDayFromPlannerScrollRef.current) {
      selectedDayFromPlannerScrollRef.current = false;
      return;
    }
    const col = plannerHScrollRef.current.querySelector(`[data-planner-day-id="${selectedDayId}"]`);
    if (!(col instanceof HTMLElement)) return;
    syncingFromSidebarRef.current = true;
    col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    const t = window.setTimeout(() => {
      syncingFromSidebarRef.current = false;
    }, 450);
    return () => window.clearTimeout(t);
  }, [selectedDayId, displayDays, isMobile]);

  React.useEffect(() => {
    const main = plannerHScrollRef.current;
    const head = plannerHeadHScrollRef.current;
    const top = plannerScrollTopRef.current;
    if (!main || !head || !top || isMobile) return undefined;

    const syncScrollLeft = (source: HTMLElement, targets: HTMLElement[]): void => {
      const left = source.scrollLeft;
      for (const el of targets) {
        if (el.scrollLeft !== left) el.scrollLeft = left;
      }
    };

    const onMainScroll = (): void => {
      syncScrollLeft(main, [head, top]);
    };
    const onHeadScroll = (): void => {
      syncScrollLeft(head, [main, top]);
    };
    const onTopScroll = (): void => {
      syncScrollLeft(top, [main, head]);
    };

    main.addEventListener('scroll', onMainScroll, { passive: true });
    head.addEventListener('scroll', onHeadScroll, { passive: true });
    top.addEventListener('scroll', onTopScroll, { passive: true });
    return () => {
      main.removeEventListener('scroll', onMainScroll);
      head.removeEventListener('scroll', onHeadScroll);
      top.removeEventListener('scroll', onTopScroll);
    };
  }, [displayDays, isMobile]);

  React.useEffect(() => {
    const main = plannerHScrollRef.current;
    const head = plannerHeadHScrollRef.current;
    const top = plannerScrollTopRef.current;
    if (!main || !head || !top || isMobile) return undefined;
    const measure = (): void => {
      const grid = head.querySelector(`.${styles.plannerGrid}`);
      const unschedGrid = main.querySelector(`.${styles.unschedRowGrid}`);
      const track = main.querySelector(`.${styles.trackInner}`);
      const ghost = top.firstElementChild;
      const scrollW = Math.max(
        grid instanceof HTMLElement ? grid.scrollWidth : 0,
        unschedGrid instanceof HTMLElement ? unschedGrid.scrollWidth : 0,
        track instanceof HTMLElement ? track.scrollWidth : 0
      );
      if (ghost instanceof HTMLElement && scrollW > 0) {
        ghost.style.width = `${scrollW}px`;
      }
    };
    measure();
    const t = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(t);
  }, [displayDays, isMobile, unschedSectionHidden]);

  React.useEffect(() => {
    if (isMobile) return;
    const vScroll = plannerVScrollRef.current;
    if (vScroll) vScroll.scrollTop = 0;
  }, [unschedSectionHidden, isMobile]);

  React.useEffect(() => {
    const head = plannerHeadHScrollRef.current;
    const main = plannerHScrollRef.current;
    if (!head || !main || isMobile) return undefined;
    const onWheel = (ev: WheelEvent): void => {
      if (main.scrollWidth <= main.clientWidth) return;
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
      ev.preventDefault();
      main.scrollLeft += ev.deltaY;
    };
    head.addEventListener('wheel', onWheel, { passive: false });
    return () => head.removeEventListener('wheel', onWheel);
  }, [displayDays, isMobile]);

  React.useEffect(() => {
    const vScroll = plannerVScrollRef.current;
    const main = plannerHScrollRef.current;
    const head = plannerHeadHScrollRef.current;
    if (!main || !head || isMobile) return undefined;

    const bindDrag = (el: HTMLElement, allowVertical: boolean): (() => void) => {
      const onPointerDown = (ev: PointerEvent): void => {
        if (ev.button !== 0) return;
        const target = ev.target as HTMLElement;
        if (target.closest('button, a, input, textarea, select, [contenteditable]')) return;
        plannerDragRef.current = {
          pointerId: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          scrollLeft: main.scrollLeft,
          scrollTop: vScroll?.scrollTop ?? 0
        };
        el.setPointerCapture(ev.pointerId);
        el.style.cursor = 'grabbing';
      };
      const onPointerMove = (ev: PointerEvent): void => {
        const drag = plannerDragRef.current;
        if (!drag || drag.pointerId !== ev.pointerId) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        main.scrollLeft = drag.scrollLeft - dx;
        if (allowVertical && vScroll) vScroll.scrollTop = drag.scrollTop - dy;
      };
      const onPointerUp = (ev: PointerEvent): void => {
        const drag = plannerDragRef.current;
        if (!drag || drag.pointerId !== ev.pointerId) return;
        plannerDragRef.current = null;
        el.style.cursor = '';
        if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      };
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      return () => {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
      };
    };

    const unbindMain = bindDrag(main, true);
    const unbindHead = bindDrag(head, false);
    return () => {
      unbindMain();
      unbindHead();
    };
  }, [displayDays, isMobile]);

  React.useEffect(() => {
    if (!selectedDayId || !visibleDays.length) return;
    const idx = visibleDays.findIndex((d) => d.id === selectedDayId);
    if (idx >= 0) setMobileDayIndex(idx);
  }, [selectedDayId, visibleDays]);

  React.useEffect(() => {
    const root = plannerHScrollRef.current;
    if (!root || isMobile || displayDays.length <= 1) return undefined;

    const onScroll = (): void => {
      if (syncingFromSidebarRef.current) return;
      const rect = root.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      let bestId = '';
      let bestDist = Infinity;
      for (const day of displayDays) {
        const el = root.querySelector(`[data-planner-day-id="${day.id}"]`);
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        const dist = Math.abs(mid - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = day.id;
        }
      }
      if (bestId && bestId !== selectedDayId) {
        selectedDayFromPlannerScrollRef.current = true;
        setSelectedDayId(bestId);
        requestSidebarDayFocus(bestId);
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [displayDays, isMobile, selectedDayId, setSelectedDayId]);

  const buildPlannerPrintDays = React.useCallback((): DayPlannerPrintDay[] => {
    const daysSource = plannerFullscreen ? visibleDays : displayDays;
    return daysSource.map((day) => {
      const cal = day.calendarDate || '';
      const list = entriesForPlannerColumn(day);
      const timedRows: Array<{ sortMin: number; entry: DayPlannerPrintDay['timed'][0] }> = [];
      const unscheduled: DayPlannerPrintDay['unscheduled'] = [];
      for (const e of list) {
        if (isLocationInfoEntry(e)) continue;
        const start = effectivePlannerTimeStart(e, cal, tripDays);
        const sm = minutesFromTimeStart(start);
        const subs = [...(e.subItems ?? [])]
          .sort((a, b) => {
            const am = minutesFromTimeStart(a.startTime || '');
            const bm = minutesFromTimeStart(b.startTime || '');
            if (am === undefined && bm === undefined) return 0;
            if (am === undefined) return 1;
            if (bm === undefined) return -1;
            return am - bm;
          })
          .map((s) => {
            const t0 = formatTimeHHMM(s.startTime || '');
            const t1 = formatTimeHHMM(s.endTime || '');
            const title = s.title || '';
            if (t0 && t1) return `${t0}–${t1} ${title}`.trim();
            if (t0) return `${t0} ${title}`.trim();
            return title;
          })
          .filter(Boolean);
        const details: string[] = [];
        if (e.bookingReference?.trim()) details.push(`Ref: ${e.bookingReference.trim()}`);
        if (e.location?.trim()) details.push(e.location.trim());
        if (e.streetAddress?.trim()) details.push(e.streetAddress.trim());
        const item = {
          title: e.title || 'Untitled',
          timeLabel: sm !== undefined ? formatTimeHHMM(start) : '—',
          duration: e.duration?.trim() || '1h',
          category: e.category,
          subItems: subs.length ? subs : undefined,
          details: details.length ? details : undefined
        };
        if (sm === undefined) unscheduled.push(item);
        else timedRows.push({ sortMin: sm, entry: item });
      }
      timedRows.sort((a, b) => a.sortMin - b.sortMin);
      return {
        dayLabel: dayLabel(day),
        timed: timedRows.map((r) => r.entry),
        unscheduled
      };
    });
  }, [plannerFullscreen, visibleDays, displayDays, entriesForPlannerColumn, tripDays]);

  const openPlannerPrintSheet = React.useCallback((): void => {
    const days = buildPlannerPrintDays();
    if (!days.length) {
      // eslint-disable-next-line no-alert
      window.alert('No days to print for the current filter.');
      return;
    }
    const title = trip?.title ? `${trip.title} — Day planner` : 'Day planner';
    setPlannerPrintHtml(buildPlannerPrintHtml(title, days));
  }, [buildPlannerPrintDays, trip?.title]);

  React.useEffect(() => {
    if (!plannerFullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [plannerFullscreen]);

  const rangeForDay = React.useCallback((day: TripDay): { start: number; end: number } => {
    const cal = day.calendarDate || '';
    const list = entriesForPlannerColumn(day);
    const expanded = expandPlannerTimedItems(list, cal, tripDays, entriesForTrip);
    let minM = 24 * 60;
    let maxM = 0;
    let any = false;
    for (const item of expanded) {
      any = true;
      minM = Math.min(minM, item.startMinutes);
      maxM = Math.max(maxM, item.startMinutes + item.durationMinutes);
    }
    if (!any) return { start: 8 * 60, end: 22 * 60 };
    minM = Math.max(0, minM - 30);
    // Allow a little space after midnight so late blocks remain visible.
    maxM = Math.min(25 * 60, maxM + 45);
    if (maxM <= minM) maxM = minM + 60;
    return { start: minM, end: maxM };
  }, [entriesForPlannerColumn, tripDays, entriesForTrip]);

  const globalRange = React.useMemo(() => {
    if (!displayDays.length) return { start: 8 * 60, end: 22 * 60 };
    let s = 24 * 60;
    let e = 0;
    for (const d of displayDays) {
      const r = rangeForDay(d);
      s = Math.min(s, r.start);
      e = Math.max(e, r.end);
    }
    const oStart = minutesFromTimeStart(rangeStartOverride);
    const oEnd = minutesFromTimeStart(rangeEndOverride);
    if (oStart !== undefined) s = oStart;
    if (oEnd !== undefined) e = oEnd;
    if (e <= s) e = s + 60;
    return { start: s, end: e };
  }, [displayDays, rangeForDay, rangeStartOverride, rangeEndOverride]);

  const pxPerMin = isMobile ? 1 : 1.15;
  const rangeSpanMin = Math.max(1, globalRange.end - globalRange.start);
  const trackHeightRaw = rangeSpanMin * pxPerMin;
  const trackHeight = Number.isFinite(trackHeightRaw) ? Math.max(280, trackHeightRaw) : 480;
  const hourBandPx = 60 * pxPerMin;

  const hoursTicks = React.useMemo(() => {
    const out: number[] = [];
    const startH = Math.floor(globalRange.start / 60);
    const endH = Math.ceil(globalRange.end / 60);
    for (let h = startH; h <= endH; h++) {
      if (h >= 0 && h < 24) out.push(h);
    }
    return out.length ? out : [8, 12, 16, 20];
  }, [globalRange]);

  const anyUnscheduledAcrossFilter = React.useMemo(() => {
    for (const d of visibleDays) {
      const cal = d.calendarDate || '';
      const list = entriesForPlannerColumn(d);
      if (expandPlannerUnscheduledItems(list, cal, tripDays, entriesForTrip).length) return true;
    }
    return false;
  }, [visibleDays, entriesForPlannerColumn, tripDays]);

  const previewEntry = previewEntryId ? localEntries.find((e) => e.id === previewEntryId) : undefined;
  const previewCalendarDate = React.useMemo(() => {
    if (!previewEntry) return '';
    const day = tripDays.find((d) => d.id === previewEntry.dayId);
    return day?.calendarDate?.slice(0, 10) ?? '';
  }, [previewEntry, tripDays]);

  const previewSubItemsSorted = React.useMemo(() => {
    if (!previewEntry) return [];
    return [...(previewEntry.subItems ?? [])].sort((a, b) => {
      const am = minutesFromTimeStart(a.startTime || '');
      const bm = minutesFromTimeStart(b.startTime || '');
      if (am === undefined && bm === undefined) return 0;
      if (am === undefined) return 1;
      if (bm === undefined) return -1;
      return am - bm;
    });
  }, [previewEntry]);

  const previewViewCalendarDate = previewContext?.calendarDate || previewCalendarDate;
  const previewTransportLeg = previewContext?.transportLeg;
  const previewScheduleHero =
    previewEntry
      ? formatEntryScheduleHero(previewEntry, previewViewCalendarDate, tripDays, {
          transportLeg: previewTransportLeg,
          allEntries: entriesForTrip
        })
      : null;
  const previewDocs = previewEntry ? docsForEntry(previewEntry.id) : [];
  const previewLinks = previewEntry ? linksForEntry(previewEntry.id) : [];

  const closePreview = React.useCallback((): void => {
    setPreviewEntryId(null);
    setPreviewContext(null);
  }, []);

  const collapseAllUnscheduled = React.useCallback((): void => {
    setUnschedCollapsed((prev) => {
      const next = { ...prev };
      for (const d of visibleDays) {
        const cal = d.calendarDate || '';
        const list = entriesForPlannerColumn(d);
        const has = expandPlannerUnscheduledItems(list, cal, tripDays, entriesForTrip).length > 0;
        if (has) next[d.id] = true;
      }
      return next;
    });
  }, [visibleDays, entriesForPlannerColumn, tripDays]);

  const expandAllUnscheduled = React.useCallback((): void => {
    setUnschedCollapsed((prev) => {
      const next = { ...prev };
      for (const d of visibleDays) {
        delete next[d.id];
      }
      return next;
    });
  }, [visibleDays]);

  const focusDay = React.useCallback(
    (dayId: string): void => {
      setSelectedDayId(dayId);
      requestSidebarDayFocus(dayId);
    },
    [setSelectedDayId]
  );

  const openPreview = React.useCallback(
    (
      dayId: string,
      entryId: string,
      options?: { calendarDate?: string; transportLeg?: TransportTimelineLeg }
    ): void => {
      focusDay(dayId);
      const day = tripDays.find((d) => d.id === dayId);
      setPreviewContext({
        dayId,
        calendarDate: options?.calendarDate || day?.calendarDate || '',
        transportLeg: options?.transportLeg
      });
      setPreviewEntryId(entryId);
    },
    [focusDay, tripDays]
  );

  const openEdit = React.useCallback(
    (dayId: string, entryId: string, subItemId?: string): void => {
      setPreviewEntryId(null);
      setPreviewContext(null);
      focusDay(dayId);
      if (subItemId) {
        setEditingCardId(null);
        setEditingSubItem({ parentEntryId: entryId, subItemId });
      } else {
        setEditingSubItem(null);
        setEditingCardId(entryId);
      }
    },
    [focusDay, setEditingCardId, setEditingSubItem]
  );

  // Avoid min() inside repeat() — some embedded / older engines reject the track list and drop
  // grid-template-columns entirely, which collapses the planner to a single column (broken layout).
  const gridColTemplate = `3.5rem repeat(${displayDays.length}, ${PLANNER_DAY_COL})`;
  const plannerGridMinWidth = `calc(3.5rem + ${displayDays.length} * ${PLANNER_DAY_COL})`;

  if (!trip) return null;

  const filters: { id: PlannerFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'this_week', label: 'This Week' },
    { id: 'next_week', label: 'Next Week' },
    { id: 'days_remaining', label: 'Days Remaining' },
    { id: 'entire_trip', label: 'Entire Trip' },
    { id: 'custom_range', label: 'Custom Date Range' }
  ];

  const handleFilterClick = (id: PlannerFilter): void => {
    setFilter(id);
  };

  return (
    <>
    <LocationInfoSlidePanel
      entry={locationPanelEntry}
      calendarDate={locationPanelCalendarDate}
      onClose={() => setLocationPanelEntryId(null)}
    />
    <div className={`${styles.root} ${plannerFullscreen ? styles.rootFullscreen : ''}`} id="th-print-root">
      <div className={styles.filterBar}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterClick(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className={styles.rangeToolbar}>
        <div className={styles.rangeBar} aria-label="Planner time range">
          <label className={styles.rangeLabel}>
            Start{' '}
            <input className={styles.rangeInput} type="time" value={rangeStartOverride} onChange={(e) => setRangeStartOverride(e.target.value)} />
          </label>
          <label className={styles.rangeLabel}>
            End{' '}
            <input className={styles.rangeInput} type="time" value={rangeEndOverride} onChange={(e) => setRangeEndOverride(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.rangeReset}
            onClick={() => {
              setRangeStartOverride('');
              setRangeEndOverride('');
              if (trip?.id) {
                try {
                  const { rangeStart, rangeEnd } = plannerStorageKeys(trip.id);
                  window.localStorage.removeItem(rangeStart);
                  window.localStorage.removeItem(rangeEnd);
                } catch {
                  /* ignore */
                }
              }
            }}
          >
            Reset
          </button>
          {anyUnscheduledAcrossFilter ? (
            <>
              <button
                type="button"
                className={styles.rangeReset}
                onClick={() => setUnschedSectionHidden((v) => !v)}
              >
                {unschedSectionHidden ? 'Show unscheduled section' : 'Hide unscheduled section'}
              </button>
              <button type="button" className={styles.rangeReset} onClick={expandAllUnscheduled}>
                Show all unscheduled
              </button>
              <button type="button" className={styles.rangeReset} onClick={collapseAllUnscheduled}>
                Hide all unscheduled
              </button>
            </>
          ) : null}
          {plannerFullscreen ? (
            <button
              type="button"
              className={styles.rangeReset}
              onClick={() => setPlannerFullscreen(false)}
              aria-label="Exit day planner full screen"
            >
              Exit full screen
            </button>
          ) : (
            <button
              type="button"
              className={styles.rangeReset}
              onClick={openPlannerFullScreen}
              aria-label="Open day planner full screen"
            >
              Full screen
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.printPlannerBtn}
          onClick={openPlannerPrintSheet}
          aria-label="Print day planner"
          title="Opens print preview"
        >
          <PrintGlyph />
          Print / Save
        </button>
      </div>
      {filter === 'custom_range' ? (
        <div className={styles.customRange}>
          <label>
            From{' '}
            <input className={styles.dateInput} type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </label>
          <label>
            To{' '}
            <input className={styles.dateInput} type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </label>
        </div>
      ) : null}
      {infoNotice ? <div className={styles.inactivePrompt} role="status">{infoNotice}</div> : null}
      {isMobile && visibleDays.length > 1 ? (
        <div className={styles.mobileNav}>
          <button
            type="button"
            disabled={mobileDayIndex <= 0}
            onClick={() => setMobileDayIndex((i) => Math.max(0, i - 1))}
          >
            ← Previous day
          </button>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
            {mobileDayIndex + 1} / {visibleDays.length}
          </span>
          <button
            type="button"
            disabled={mobileDayIndex >= visibleDays.length - 1}
            onClick={() => setMobileDayIndex((i) => Math.min(visibleDays.length - 1, i + 1))}
          >
            Next day →
          </button>
        </div>
      ) : null}
      {!displayDays.length ? (
        <div className={styles.inactivePrompt} role="status">
          No days in this range. Adjust filters.
        </div>
      ) : isMobile ? (
        <div className={`${styles.plannerFrame} ${styles.plannerFrameMobile}`} ref={plannerFrameRef}>
          {displayDays.map((day) => {
            const cal = day.calendarDate || '';
            const list = entriesForPlannerColumn(day);
            const timed = expandPlannerTimedItems(list, cal, tripDays, entriesForTrip).filter((item) =>
              shouldRenderPlannerItem(item, cal)
            );
            const unsched = expandPlannerUnscheduledItems(list, cal, tripDays, entriesForTrip);
            const accommodationEntry = findAccommodationAnchor(list);
            const collapsed = Boolean(unschedCollapsed[day.id]);
            return (
              <div key={day.id} className={styles.mobileDayStack}>
                <PlannerDayHead day={day} className={styles.dayHead} />
                {trip ? (
                  <DayLocationInfoStrip
                    entries={locationInfoEntriesForDay(day, localEntries, trip.id)}
                    activeEntryId={locationPanelEntryId}
                    onSelect={setLocationPanelEntryId}
                  />
                ) : null}
                {accommodationEntry ? (
                  <div className={styles.accommodationRow}>
                    <button
                      type="button"
                      className={styles.accommodationBtn}
                      onClick={() => openPreview(day.id, accommodationEntry.id, { calendarDate: cal })}
                    >
                      Accommodation: {accommodationEntry.title || 'Stay'}
                    </button>
                  </div>
                ) : null}
                {unsched.length ? (
                  <div className={styles.unscheduled}>
                    <button
                      type="button"
                      className={styles.unschedToggle}
                      aria-expanded={!collapsed}
                      onClick={() => setUnschedCollapsed((m) => ({ ...m, [day.id]: !collapsed }))}
                    >
                      <span>Unscheduled</span>
                      <span className={styles.unschedMeta}>
                        {unsched.length} · {collapsed ? 'Show' : 'Hide'}
                      </span>
                    </button>
                    {!collapsed ? (
                      <div className={styles.unschedBody}>
                        {unsched.map((item) => {
                          const e = item.entry;
                          const sub = item.subItem;
                          const cancel = cancellationSnippet(e, sub);
                          const label = sub ? `${item.title} (${e.title || 'Untitled'})` : item.title;
                          return (
                          <div key={item.key} className={styles.unschedCard}>
                            {!sub && editingCardId === e.id ? (
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} useEditPortal />
                            ) : (
                              <div className={styles.unschedRow}>
                                <div className={styles.unschedTitleBlock}>
                                  <button
                                    type="button"
                                    className={styles.unschedTitleBtn}
                                    onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                  >
                                    {label}
                                  </button>
                                  {cancel ? <div className={styles.blockCancel}>{cancel}</div> : null}
                                </div>
                                <div className={styles.blockActions} onMouseDown={stopPlannerBlockPointer} onClick={stopPlannerBlockPointer}>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label="Preview entry"
                                    title="Preview"
                                    onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                  >
                                    <EyeGlyph />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label={sub ? 'Edit option' : 'Edit entry'}
                                    title="Edit"
                                    onClick={() => openEdit(day.id, e.id, sub?.id)}
                                  >
                                    <PencilGlyph />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.mobileTrackRow}>
                  <div className={`${styles.timeAxis} ${styles.timeAxisCompact}`} style={{ height: `${trackHeight}px` }}>
                    {hoursTicks.map((h) => {
                      const m = h * 60;
                      const top = ((m - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                      const label = new Date(2000, 0, 1, h % 24, 0, 0).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                      return (
                        <div key={h} className={styles.tick} style={{ top: `${top}px` }}>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className={styles.dayTrack}
                    style={{ height: `${trackHeight}px`, ['--hour-band' as string]: `${hourBandPx}px` }}
                  >
                    {timed.map((item) => {
                      const e = item.entry;
                      const sub = item.subItem;
                      const sm = item.startMinutes;
                      const dur = item.durationMinutes;
                      const top = ((sm - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                      const h = (dur / (globalRange.end - globalRange.start)) * trackHeight;
                      const attachId = sub?.id ?? e.id;
                      const docs = docsForEntry(attachId);
                      const links = linksForEntry(attachId);
                      const cat = getCategorySlug(item.category);
                      const isEditingParent = !sub && editingCardId === e.id;
                      const isEditingSub =
                        Boolean(sub) &&
                        editingSubItem?.parentEntryId === e.id &&
                        editingSubItem?.subItemId === sub!.id;
                      const blockZ = plannerBlockZIndex(item, timed, frontBlockKey, isEditingParent || isEditingSub);
                      const blockScheduleHero = plannerBlockScheduleHero(item, cal, tripDays, entriesForTrip);
                      return (
                        <div
                          key={item.key}
                          style={{ position: 'absolute', left: 4, right: 4, top: `${top}px`, height: `${Math.max(h, 28)}px`, zIndex: blockZ, overflow: 'hidden' }}
                        >
                          {isEditingParent ? (
                            <div className={styles.editOverlay}>
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} useEditPortal />
                            </div>
                          ) : (
                            <div className={`${styles.block} th-cat-${cat} th-cat-border`} style={{ position: 'static', height: '100%' }} title={item.title}>
                              <div className={styles.blockTitleRow}>
                                <div
                                  className={`${styles.blockTitle} ${styles.blockTitleClickable}`}
                                  onClick={(ev) => plannerBlockTitleClick(ev, item.key, setFrontBlockKey)}
                                >
                                  {!sub && isTransportReturnOnCalendarDate(e, cal) ? (
                                    <span className={styles.returnBadge}>Return</span>
                                  ) : null}{' '}
                                  {sub && item.parentTitle ? `${item.title} (${item.parentTitle})` : item.title}
                                </div>
                                <div className={styles.blockActions} onMouseDown={stopPlannerBlockPointer} onClick={stopPlannerBlockPointer}>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label="Preview entry"
                                    title="Preview"
                                    onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                  >
                                    <EyeGlyph />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label={sub ? 'Edit option' : 'Edit entry'}
                                    title="Edit"
                                    onClick={() => openEdit(day.id, e.id, sub?.id)}
                                  >
                                    <PencilGlyph />
                                  </button>
                                </div>
                              </div>
                              {plannerBlockLocation(e, sub, day) ? (
                                <div className={styles.blockLocation}>{plannerBlockLocation(e, sub, day)}</div>
                              ) : null}
                              {plannerBlockSupplier(sub, e) ? (
                                <div className={styles.blockSupplier}>{plannerBlockSupplier(sub, e)}</div>
                              ) : null}
                              {blockScheduleHero ? (
                                <div className={styles.blockScheduleHero}>{blockScheduleHero}</div>
                              ) : (
                                <div className={styles.blockMeta}>{plannerBlockMeta(item, cal, tripDays)}</div>
                              )}
                              {cancellationSnippet(e, sub) ? (
                                <div className={styles.blockCancel}>{cancellationSnippet(e, sub)}</div>
                              ) : null}
                              <div className={styles.blockIcons}>
                                {docs.map((d) => (
                                  <a
                                    key={d.id}
                                    href={d.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={d.title}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      openDocumentUrl(d.fileUrl);
                                    }}
                                  >
                                    <DocGlyph />
                                  </a>
                                ))}
                                {links.map((l) => (
                                  <a
                                    key={l.id}
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={l.linkTitle}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      openDocumentUrl(l.url);
                                    }}
                                  >
                                    <LinkGlyph />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.plannerFrame} ref={plannerFrameRef}>
          <div className={styles.plannerStickyBand}>
            <div className={styles.plannerScrollTop} ref={plannerScrollTopRef} aria-hidden>
              <div className={styles.plannerScrollGhost} />
            </div>
            <div className={styles.plannerHeadHScroll} ref={plannerHeadHScrollRef}>
              <div
                className={styles.plannerGrid}
                style={{
                  gridTemplateColumns: gridColTemplate,
                  minWidth: plannerGridMinWidth
                }}
              >
                <div className={styles.cornerCell} aria-hidden />
                {displayDays.map((day) => (
                  <PlannerDayHead key={`h-${day.id}`} day={day} className={styles.dayHead} />
                ))}
              </div>
            </div>
          </div>
          <div className={styles.plannerTrackVScroll} ref={plannerVScrollRef}>
          <div className={styles.plannerTrackHScroll} ref={plannerHScrollRef}>
            {trip ? (
              <div
                className={styles.unschedRowGrid}
                style={{ gridTemplateColumns: gridColTemplate, minWidth: plannerGridMinWidth }}
              >
                <div className={styles.cornerCell} aria-hidden />
                {displayDays.map((day) => (
                  (() => {
                    const cal = day.calendarDate || '';
                    const list = entriesForPlannerColumn(day);
                    const accommodationEntry = findAccommodationAnchor(list);
                    return (
                  <div key={`loc-${day.id}`} className={styles.unschedCell}>
                    <DayLocationInfoStrip
                      entries={locationInfoEntriesForDay(day, localEntries, trip.id)}
                      activeEntryId={locationPanelEntryId}
                      onSelect={setLocationPanelEntryId}
                    />
                    {accommodationEntry ? (
                      <div className={styles.accommodationRow}>
                        <button
                          type="button"
                          className={styles.accommodationBtn}
                          onClick={() => openPreview(day.id, accommodationEntry.id, { calendarDate: cal })}
                        >
                          Accommodation: {accommodationEntry.title || 'Stay'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                    );
                  })()
                ))}
              </div>
            ) : null}
            {!unschedSectionHidden ? (
              <div
                className={styles.unschedRowGrid}
                style={{ gridTemplateColumns: gridColTemplate, minWidth: plannerGridMinWidth }}
              >
                <div className={styles.cornerCell} aria-hidden />
                {displayDays.map((day) => {
              const cal = day.calendarDate || '';
              const list = entriesForPlannerColumn(day);
              const unsched = expandPlannerUnscheduledItems(list, cal, tripDays, entriesForTrip);
              const collapsed = Boolean(unschedCollapsed[day.id]);
              if (!unsched.length) {
                return <div key={`u-${day.id}`} className={styles.unschedCell} />;
              }
              return (
                <div key={`u-${day.id}`} className={styles.unschedCell}>
                  <div className={styles.unscheduled}>
                    <button
                      type="button"
                      className={styles.unschedToggle}
                      aria-expanded={!collapsed}
                      onClick={() => setUnschedCollapsed((m) => ({ ...m, [day.id]: !collapsed }))}
                    >
                      <span>Unscheduled</span>
                      <span className={styles.unschedMeta}>
                        {unsched.length} · {collapsed ? 'Show' : 'Hide'}
                      </span>
                    </button>
                    {!collapsed ? (
                      <div className={styles.unschedBody}>
                        {unsched.map((item) => {
                          const e = item.entry;
                          const sub = item.subItem;
                          const cancel = cancellationSnippet(e, sub);
                          const label = sub ? `${item.title} (${e.title || 'Untitled'})` : item.title;
                          return (
                          <div key={item.key} className={styles.unschedCard}>
                            {!sub && editingCardId === e.id ? (
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} useEditPortal />
                            ) : (
                              <div className={styles.unschedRow}>
                                <div className={styles.unschedTitleBlock}>
                                  <button
                                    type="button"
                                    className={styles.unschedTitleBtn}
                                    onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                  >
                                    {label}
                                  </button>
                                  {cancel ? <div className={styles.blockCancel}>{cancel}</div> : null}
                                </div>
                                <div className={styles.blockActions} onMouseDown={stopPlannerBlockPointer} onClick={stopPlannerBlockPointer}>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label="Preview entry"
                                    title="Preview"
                                    onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                  >
                                    <EyeGlyph />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    aria-label={sub ? 'Edit option' : 'Edit entry'}
                                    title="Edit"
                                    onClick={() => openEdit(day.id, e.id, sub?.id)}
                                  >
                                    <PencilGlyph />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
              </div>
            ) : null}
            <div className={styles.trackInner} style={{ gridTemplateColumns: gridColTemplate, minWidth: plannerGridMinWidth }}>
              <div className={styles.timeAxis} style={{ height: `${trackHeight}px` }}>
                {hoursTicks.map((h) => {
                  const m = h * 60;
                  const top = ((m - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                  const label = `${pad2(h)}:00`;
                  return (
                    <div key={h} className={styles.tick} style={{ top: `${top}px` }}>
                      {label}
                    </div>
                  );
                })}
              </div>
              {displayDays.map((day) => {
                  const cal = day.calendarDate || '';
                  const list = entriesForPlannerColumn(day);
                  const timed = expandPlannerTimedItems(list, cal, tripDays, entriesForTrip).filter((item) =>
              shouldRenderPlannerItem(item, cal)
            );
                  return (
                    <div
                      key={`t-${day.id}`}
                      className={styles.dayTrack}
                      data-planner-day-id={day.id}
                      style={{ height: `${trackHeight}px`, ['--hour-band' as string]: `${hourBandPx}px` }}
                    >
                      {timed.map((item) => {
                        const e = item.entry;
                        const sub = item.subItem;
                        const sm = item.startMinutes;
                        const dur = item.durationMinutes;
                        const top = ((sm - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                        const h = (dur / (globalRange.end - globalRange.start)) * trackHeight;
                        const attachId = sub?.id ?? e.id;
                        const docs = docsForEntry(attachId);
                        const links = linksForEntry(attachId);
                        const cat = getCategorySlug(item.category);
                        const isEditingParent = !sub && editingCardId === e.id;
                        const isEditingSub =
                          Boolean(sub) &&
                          editingSubItem?.parentEntryId === e.id &&
                          editingSubItem?.subItemId === sub!.id;
                        const blockZ = plannerBlockZIndex(item, timed, frontBlockKey, isEditingParent || isEditingSub);
                        const blockScheduleHero = plannerBlockScheduleHero(item, cal, tripDays, entriesForTrip);
                        return (
                          <div
                            key={item.key}
                            style={{ position: 'absolute', left: 4, right: 4, top: `${top}px`, height: `${Math.max(h, 28)}px`, zIndex: blockZ, overflow: 'hidden' }}
                          >
                            {isEditingParent ? (
                              <div className={styles.editOverlay}>
                                <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} useEditPortal />
                              </div>
                            ) : (
                              <div className={`${styles.block} th-cat-${cat} th-cat-border`} style={{ position: 'static', height: '100%' }} title={item.title}>
                                <div className={styles.blockTitleRow}>
                                  <div
                                    className={`${styles.blockTitle} ${styles.blockTitleClickable}`}
                                    onClick={(ev) => plannerBlockTitleClick(ev, item.key, setFrontBlockKey)}
                                  >
                                    {!sub && isTransportReturnOnCalendarDate(e, cal) ? (
                                      <span className={styles.returnBadge}>Return</span>
                                    ) : null}{' '}
                                    {sub && item.parentTitle ? `${item.title} (${item.parentTitle})` : item.title}
                                  </div>
                                  <div className={styles.blockActions} onMouseDown={stopPlannerBlockPointer} onClick={stopPlannerBlockPointer}>
                                    <button
                                      type="button"
                                      className={styles.iconBtn}
                                      aria-label="Preview entry"
                                      title="Preview"
                                      onClick={() =>
                                      openPreview(day.id, e.id, {
                                        calendarDate: cal,
                                        transportLeg: plannerItemTransportLeg(item, e, cal)
                                      })
                                    }
                                    >
                                      <EyeGlyph />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.iconBtn}
                                      aria-label={sub ? 'Edit option' : 'Edit entry'}
                                      title="Edit"
                                      onClick={() => openEdit(day.id, e.id, sub?.id)}
                                    >
                                      <PencilGlyph />
                                    </button>
                                  </div>
                                </div>
                                {plannerBlockLocation(e, sub, day) ? (
                                  <div className={styles.blockLocation}>{plannerBlockLocation(e, sub, day)}</div>
                                ) : null}
                                {plannerBlockSupplier(sub, e) ? (
                                  <div className={styles.blockSupplier}>{plannerBlockSupplier(sub, e)}</div>
                                ) : null}
                                {blockScheduleHero ? (
                                  <div className={styles.blockScheduleHero}>{blockScheduleHero}</div>
                                ) : (
                                  <div className={styles.blockMeta}>{plannerBlockMeta(item, cal, tripDays)}</div>
                                )}
                                {cancellationSnippet(e, sub) ? (
                                  <div className={styles.blockCancel}>{cancellationSnippet(e, sub)}</div>
                                ) : null}
                                <div className={styles.blockIcons}>
                                  {docs.map((d) => (
                                    <a
                                      key={d.id}
                                      href={d.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={d.title}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        openDocumentUrl(d.fileUrl);
                                      }}
                                    >
                                      <DocGlyph />
                                    </a>
                                  ))}
                                  {links.map((l) => (
                                    <a
                                      key={l.id}
                                      href={l.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={l.linkTitle}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        openDocumentUrl(l.url);
                                      }}
                                    >
                                      <LinkGlyph />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </div>
          </div>
        </div>
      )}
      {previewEntry ? (
        <div
          className={styles.previewBackdrop}
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closePreview();
          }}
        >
          <div className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="th-planner-preview-title">
            <h2 id="th-planner-preview-title" className={styles.previewTitle}>
              {previewEntry.title || 'Untitled'}
            </h2>
            {previewScheduleHero ? (
              <div className={`${styles.previewScheduleHero} th-cat-${getCategorySlug(previewEntry.category)} th-cat-border`}>
                {previewScheduleHero}
              </div>
            ) : null}
            <div className={styles.previewMeta}>
              {previewEntry.category ? <span>{previewEntry.category}</span> : null}
              {previewEntry.category && !previewScheduleHero ? <span> · </span> : null}
              {!previewScheduleHero ? (
                <span>
                  {formatTimeHHMM(previewEntry.timeStart) || 'Unscheduled'}
                  {previewEntry.duration ? ` · ${previewEntry.duration}` : null}
                </span>
              ) : null}
              {previewEntry.location ? (
                <>
                  <span> · </span>
                  <span>{previewEntry.location}</span>
                </>
              ) : null}
            </div>
            {previewDocs.length || previewLinks.length ? (
              <div className={styles.previewSection}>
                <h3>Documents &amp; links</h3>
                <div className={styles.previewAttachList}>
                  {previewDocs.map((d) => (
                    <a
                      key={d.id}
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(ev) => {
                        ev.preventDefault();
                        openDocumentUrl(d.fileUrl);
                      }}
                    >
                      {d.title || 'Document'}
                    </a>
                  ))}
                  {previewLinks.map((l) => (
                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.linkTitle || l.url}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {previewEntry.supplier ? (
              <div className={styles.previewSection}>
                <h3>Supplier</h3>
                <p className={styles.previewBody}>{previewEntry.supplier}</p>
              </div>
            ) : null}
            {previewEntry.notes ? (
              <div className={styles.previewSection}>
                <h3>Notes</h3>
                <p className={styles.previewBody}>{previewEntry.notes}</p>
              </div>
            ) : null}
            {(previewEntry.amount !== undefined && previewEntry.amount !== 0) || previewEntry.paymentStatus ? (
              <div className={styles.previewSection}>
                <h3>Cost</h3>
                <p className={styles.previewBody}>
                  {formatCurrency(previewEntry.amount || 0, previewEntry.currency || 'NZD')}
                  {previewEntry.paymentStatus ? ` · ${previewEntry.paymentStatus}` : null}
                </p>
              </div>
            ) : null}
            {previewEntry.bookingReference?.trim() ? (
              <div className={styles.previewSection}>
                <h3>Booking reference</h3>
                <p className={styles.previewBody}>{previewEntry.bookingReference.trim()}</p>
              </div>
            ) : null}
            {previewEntry.category === 'Accommodation' &&
            (previewEntry.roomType?.trim() ||
              previewEntry.checkInTime ||
              previewEntry.checkOutTime ||
              previewEntry.streetAddress?.trim()) ? (
              <div className={styles.previewSection}>
                <h3>Accommodation details</h3>
                <p className={styles.previewBody}>
                  {[previewEntry.roomType?.trim(), previewEntry.checkInTime ? `Check-in ${formatTimeHHMM(previewEntry.checkInTime)}` : '', previewEntry.checkOutTime ? `Check-out ${formatTimeHHMM(previewEntry.checkOutTime)}` : '', previewEntry.streetAddress?.trim()]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {googleMapsPlaceUrl(previewEntry.streetAddress || '') ? (
                  <p className={styles.previewBody}>
                    <a href={googleMapsPlaceUrl(previewEntry.streetAddress || '')} target="_blank" rel="noopener noreferrer">
                      View on map
                    </a>
                    {googleMapsDirectionsUrl(previewEntry.streetAddress || '') ? (
                      <>
                        {' · '}
                        <a href={googleMapsDirectionsUrl(previewEntry.streetAddress || '')} target="_blank" rel="noopener noreferrer">
                          Get directions
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            {previewEntry.category === 'Flights' && (previewEntry.flightNumbers?.trim() || previewEntry.checkInClosesTime || previewEntry.cabinClass) ? (
              <div className={styles.previewSection}>
                <h3>Flight details</h3>
                <p className={styles.previewBody}>
                  {[previewEntry.flightNumbers?.trim(), previewEntry.checkInClosesTime ? `Check-in closes ${formatTimeHHMM(previewEntry.checkInClosesTime)}` : '', previewEntry.cabinClass].filter(Boolean).join(' · ')}
                </p>
              </div>
            ) : null}
            {previewEntry.category === 'Activities' && previewEntry.streetAddress?.trim() ? (
              <div className={styles.previewSection}>
                <h3>Address</h3>
                <p className={styles.previewBody}>{previewEntry.streetAddress.trim()}</p>
                {googleMapsPlaceUrl(previewEntry.streetAddress || '') ? (
                  <p className={styles.previewBody}>
                    <a href={googleMapsPlaceUrl(previewEntry.streetAddress || '')} target="_blank" rel="noopener noreferrer">
                      View on map
                    </a>
                    {googleMapsDirectionsUrl(previewEntry.streetAddress || '') ? (
                      <>
                        {' · '}
                        <a href={googleMapsDirectionsUrl(previewEntry.streetAddress || '')} target="_blank" rel="noopener noreferrer">
                          Get directions
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            {previewSubItemsSorted.length ? (
              <div className={styles.previewSection}>
                <h3>Sub-items</h3>
                <div className={styles.previewSubList}>
                  {previewSubItemsSorted.map((s) => (
                    <div key={s.id} className={styles.previewSubBlock}>
                      <SubItemDetailLines
                        item={s}
                        calendarDate={previewCalendarDate}
                        docCount={docsForEntry(s.id).length}
                        linkCount={linksForEntry(s.id).length}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.previewActions}>
              <button type="button" className={styles.previewClose} onClick={closePreview}>
                Close
              </button>
              <button
                type="button"
                className={styles.previewEdit}
                onClick={() => {
                  const dayId = previewEntry.dayId;
                  openEdit(dayId, previewEntry.id);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
      {typeof document !== 'undefined' && plannerFullscreen
        ? ReactDOM.createPortal(
            <div className={styles.fullscreenChrome} role="toolbar" aria-label="Full screen controls">
              <button type="button" className={styles.printPlannerBtn} onClick={openPlannerPrintSheet}>
                Print / Save
              </button>
              <button type="button" className={styles.printPlannerBtn} onClick={() => setPlannerFullscreen(false)}>
                Close
              </button>
            </div>,
            document.body
          )
        : null}
      {plannerPrintHtml ? (
        <DayPlannerPrintSheet
          title={trip?.title ? `${trip.title} — Day planner` : 'Day planner'}
          html={plannerPrintHtml}
          onClose={() => setPlannerPrintHtml(null)}
        />
      ) : null}
    </>
  );
};
