import * as React from 'react';
import type { TripDay } from '../../models/TripDay';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { sortEntriesForDay } from '../../utils/itineraryDayEntries';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { getCategorySlug } from '../../utils/categoryUtils';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { ItineraryCard } from './ItineraryCard';
import styles from './ItineraryDayPlannerView.module.css';

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

function dayLabel(day: TripDay): string {
  return day.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${day.dayNumber} — ${day.displayTitle}`;
}

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

export const ItineraryDayPlannerView: React.FC = () => {
  const { trip, tripDays, localEntries, editingCardId, setEditingCardId, setSelectedDayId } = useTripWorkspace();
  const { docsForEntry, linksForEntry } = useAttachments();
  const [filter, setFilter] = React.useState<PlannerFilter>('entire_trip');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');
  const [mobileDayIndex, setMobileDayIndex] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(false);
  const [unschedCollapsed, setUnschedCollapsed] = React.useState<Record<string, boolean>>({});
  const [rangeStartOverride, setRangeStartOverride] = React.useState('');
  const [rangeEndOverride, setRangeEndOverride] = React.useState('');

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

  const entriesForTrip = React.useMemo(
    () => (trip ? localEntries.filter((e) => e.tripId === trip.id && !e.parentEntryId) : []),
    [trip, localEntries]
  );

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
    setMobileDayIndex(0);
  }, [filter, customStart, customEnd, orderedDays.length]);

  React.useEffect(() => {
    if (mobileDayIndex >= visibleDays.length) {
      setMobileDayIndex(Math.max(0, visibleDays.length - 1));
    }
  }, [visibleDays.length, mobileDayIndex]);

  const displayDays = React.useMemo(() => {
    if (!visibleDays.length) return [];
    if (isMobile && visibleDays.length > 1) {
      const i = Math.min(Math.max(0, mobileDayIndex), visibleDays.length - 1);
      return [visibleDays[i]];
    }
    return visibleDays;
  }, [visibleDays, isMobile, mobileDayIndex]);

  const rangeForDay = React.useCallback((day: TripDay): { start: number; end: number } => {
    const cal = day.calendarDate || '';
    const list = sortEntriesForDay(entriesForTrip, day.id, cal, day.dayType);
    let minM = 24 * 60;
    let maxM = 0;
    let any = false;
    for (const e of list) {
      const sm = minutesFromTimeStart(e.timeStart);
      if (sm === undefined) continue;
      any = true;
      const dur = parseDurationMinutes(e.duration);
      minM = Math.min(minM, sm);
      maxM = Math.max(maxM, sm + dur);
    }
    if (!any) return { start: 8 * 60, end: 22 * 60 };
    minM = Math.max(0, minM - 30);
    // Allow a little space after midnight so late blocks remain visible.
    maxM = Math.min(25 * 60, maxM + 45);
    if (maxM <= minM) maxM = minM + 60;
    return { start: minM, end: maxM };
  }, [entriesForTrip]);

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
  const trackHeight = Math.max(280, (globalRange.end - globalRange.start) * pxPerMin);

  const hoursTicks = React.useMemo(() => {
    const out: number[] = [];
    const startH = Math.floor(globalRange.start / 60);
    const endH = Math.ceil(globalRange.end / 60);
    for (let h = startH; h <= endH; h++) {
      if (h >= 0 && h < 24) out.push(h);
    }
    return out.length ? out : [8, 12, 16, 20];
  }, [globalRange]);

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

  const focusDay = React.useCallback(
    (dayId: string): void => {
      setSelectedDayId(dayId);
      requestSidebarDayFocus(dayId);
    },
    [setSelectedDayId]
  );

  const subItemLine = React.useCallback((s: ItinerarySubItem): string => {
    const t0 = formatTimeHHMM(s.startTime || '');
    const t1 = formatTimeHHMM(s.endTime || '');
    const title = s.title || '';
    if (t0 && t1) return `${t0}–${t1} ${title}`.trim();
    if (t0) return `${t0} ${title}`.trim();
    return title;
  }, []);

  return (
    <div className={styles.root}>
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
          }}
        >
          Reset
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
        <div className={styles.plannerFrame}>
          {displayDays.map((day) => {
            const cal = day.calendarDate || '';
            const list = sortEntriesForDay(entriesForTrip, day.id, cal, day.dayType);
            const timed = list.filter((e) => minutesFromTimeStart(e.timeStart) !== undefined);
            const unsched = list.filter((e) => minutesFromTimeStart(e.timeStart) === undefined);
            const slugFor = (e: ItineraryEntry): string => getCategorySlug(e.category);
            const collapsed = Boolean(unschedCollapsed[day.id]);
            return (
              <div key={day.id} className={styles.mobileDayStack}>
                <div className={styles.dayHead}>{dayLabel(day)}</div>
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
                        {unsched.map((e) => (
                          <div key={e.id} className={styles.unschedCard}>
                            {editingCardId === e.id ? (
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} />
                            ) : (
                              <button
                                type="button"
                                className={styles.unschedOpen}
                                onClick={() => {
                                  focusDay(day.id);
                                  setEditingCardId(e.id);
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <PencilGlyph /> {e.title || 'Untitled'}
                                </span>
                              </button>
                            )}
                          </div>
                        ))}
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
                  <div className={styles.dayTrack} style={{ height: `${trackHeight}px` }}>
                    {timed.map((e) => {
                      const sm = minutesFromTimeStart(e.timeStart)!;
                      const dur = parseDurationMinutes(e.duration);
                      const top = ((sm - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                      const h = (dur / (globalRange.end - globalRange.start)) * trackHeight;
                      const docs = docsForEntry(e.id);
                      const links = linksForEntry(e.id);
                      const cat = slugFor(e);
                      const subs = [...(e.subItems ?? [])].sort((a, b) => {
                        const am = minutesFromTimeStart(a.startTime || '');
                        const bm = minutesFromTimeStart(b.startTime || '');
                        if (am === undefined && bm === undefined) return 0;
                        if (am === undefined) return 1;
                        if (bm === undefined) return -1;
                        return am - bm;
                      });
                      return (
                        <div key={e.id} style={{ position: 'absolute', left: 4, right: 4, top: `${top}px`, height: `${Math.max(h, 28)}px`, zIndex: editingCardId === e.id ? 50 : undefined }}>
                          {editingCardId === e.id ? (
                            <div className={styles.editOverlay}>
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} />
                            </div>
                          ) : (
                            <div
                              role="button"
                              tabIndex={0}
                              className={`${styles.block} th-cat-${cat} th-cat-border`}
                              style={{ position: 'static', height: '100%' }}
                              onClick={() => {
                                focusDay(day.id);
                                setEditingCardId(e.id);
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                  ev.preventDefault();
                                  focusDay(day.id);
                                  setEditingCardId(e.id);
                                }
                              }}
                            >
                              <div className={styles.blockTitleRow}>
                                <div className={styles.blockTitle}>{e.title || 'Untitled'}</div>
                                <span className={styles.editPill} aria-hidden>
                                  <PencilGlyph />
                                </span>
                              </div>
                              <div className={styles.blockMeta}>
                                {formatTimeHHMM(e.timeStart)} · {e.duration?.trim() || '1h'}
                              </div>
                              {subs.length ? (
                                <div className={styles.blockOptions}>
                                  {subs.map((s) => (
                                    <div key={s.id} className={styles.blockOptionLine}>
                                      {subItemLine(s)}
                                    </div>
                                  ))}
                                </div>
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
        <div className={styles.plannerFrame}>
          <div
            className={styles.plannerGrid}
            style={{
              gridTemplateColumns: `3.5rem repeat(${displayDays.length}, minmax(10rem, 1fr))`
            }}
          >
            <div className={styles.cornerCell} aria-hidden />
            {displayDays.map((day) => (
              <div key={`h-${day.id}`} className={styles.dayHead}>
                {dayLabel(day)}
              </div>
            ))}

            <div className={styles.cornerCell} aria-hidden />
            {displayDays.map((day) => {
              const cal = day.calendarDate || '';
              const list = sortEntriesForDay(entriesForTrip, day.id, cal, day.dayType);
              const unsched = list.filter((e) => minutesFromTimeStart(e.timeStart) === undefined);
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
                        {unsched.map((e) => (
                          <div key={e.id} className={styles.unschedCard}>
                            {editingCardId === e.id ? (
                              <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} />
                            ) : (
                              <button
                                type="button"
                                className={styles.unschedOpen}
                                onClick={() => {
                                  focusDay(day.id);
                                  setEditingCardId(e.id);
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <PencilGlyph /> {e.title || 'Untitled'}
                                </span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className={styles.trackScroll}>
              <div className={styles.trackInner} style={{ gridTemplateColumns: `3.5rem repeat(${displayDays.length}, minmax(10rem, 1fr))` }}>
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
                  const list = sortEntriesForDay(entriesForTrip, day.id, cal, day.dayType);
                  const timed = list.filter((e) => minutesFromTimeStart(e.timeStart) !== undefined);
                  const slugFor = (e: ItineraryEntry): string => getCategorySlug(e.category);
                  return (
                    <div key={`t-${day.id}`} className={styles.dayTrack} style={{ height: `${trackHeight}px` }}>
                      {timed.map((e) => {
                        const sm = minutesFromTimeStart(e.timeStart)!;
                        const dur = parseDurationMinutes(e.duration);
                        const top = ((sm - globalRange.start) / (globalRange.end - globalRange.start)) * trackHeight;
                        const h = (dur / (globalRange.end - globalRange.start)) * trackHeight;
                        const docs = docsForEntry(e.id);
                        const links = linksForEntry(e.id);
                        const cat = slugFor(e);
                        const subs = [...(e.subItems ?? [])].sort((a, b) => {
                          const am = minutesFromTimeStart(a.startTime || '');
                          const bm = minutesFromTimeStart(b.startTime || '');
                          if (am === undefined && bm === undefined) return 0;
                          if (am === undefined) return 1;
                          if (bm === undefined) return -1;
                          return am - bm;
                        });
                        return (
                          <div key={e.id} style={{ position: 'absolute', left: 4, right: 4, top: `${top}px`, height: `${Math.max(h, 28)}px`, zIndex: editingCardId === e.id ? 50 : undefined }}>
                            {editingCardId === e.id ? (
                              <div className={styles.editOverlay}>
                                <ItineraryCard entry={e} calendarDate={cal} suppressCarryoverUi={day.dayType === 'PreTrip'} draggable={false} />
                              </div>
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                className={`${styles.block} th-cat-${cat} th-cat-border`}
                                style={{ position: 'static', height: '100%' }}
                                onClick={() => {
                                  focusDay(day.id);
                                  setEditingCardId(e.id);
                                }}
                                onKeyDown={(ev) => {
                                  if (ev.key === 'Enter' || ev.key === ' ') {
                                    ev.preventDefault();
                                    focusDay(day.id);
                                    setEditingCardId(e.id);
                                  }
                                }}
                              >
                                <div className={styles.blockTitleRow}>
                                  <div className={styles.blockTitle}>{e.title || 'Untitled'}</div>
                                  <span className={styles.editPill} aria-hidden>
                                    <PencilGlyph />
                                  </span>
                                </div>
                                <div className={styles.blockMeta}>
                                  {formatTimeHHMM(e.timeStart)} · {e.duration?.trim() || '1h'}
                                </div>
                                {subs.length ? (
                                  <div className={styles.blockOptions}>
                                    {subs.map((s) => (
                                      <div key={s.id} className={styles.blockOptionLine}>
                                        {subItemLine(s)}
                                      </div>
                                    ))}
                                  </div>
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
    </div>
  );
};
