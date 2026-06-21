import * as React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import {
  effectiveTransportLegTime,
  expandTimelineDisplayRows,
  isPreTripDayRow,
  resolvePreTripDayId,
  sortEntriesForDay
} from '../../utils/itineraryDayEntries';
import { applyDayViewEntryOrder, applyDayViewTimelineRowOrder } from '../../utils/dayViewEntryOrder';
import { ItineraryCard } from './ItineraryCard';
import { ReminderService } from '../../services/ReminderService';
import type { LinkedEntryTask } from '../../utils/linkedEntryTask';
import styles from './ItineraryTimeline.module.css';

export interface ItineraryTimelineProps {
  dayId: string;
}

function createBlankEntry(tripId: string, dayId: string, sortOrder: number, id: string): ItineraryEntry {
  return {
    id,
    dayId,
    tripId,
    title: '',
    category: 'Other',
    timeStart: '',
    duration: '',
    supplier: '',
    location: undefined,
    notes: '',
    decisionStatus: 'Planned',
    bookingRequired: false,
    bookingStatus: 'Not booked',
    paymentStatus: 'Not paid',
    amount: 0,
    currency: 'NZD',
    sortOrder
  };
}

interface NewComposerProps {
  tripId: string;
  dayId: string;
  calendarDate: string;
  nextSortOrder: number;
  suppressCarryoverUi?: boolean;
}

const NewComposer: React.FC<NewComposerProps> = ({ tripId, dayId, calendarDate, nextSortOrder, suppressCarryoverUi }) => {
  const composerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const [draftEntry] = React.useState<ItineraryEntry>(() => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `new-${crypto.randomUUID()}`
        : `new-${Date.now()}`;
    return createBlankEntry(tripId, dayId, nextSortOrder, id);
  });

  return (
    <div ref={composerRef}>
      <ItineraryCard
        entry={draftEntry}
        calendarDate={calendarDate}
        suppressCarryoverUi={suppressCarryoverUi}
        draggable={false}
      />
    </div>
  );
};

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({ dayId }) => {
  const spContext = useSpContext();
  const { trip, localEntries, editingCardId, focusedEntryId, setFocusedEntryId, tripDays } = useTripWorkspace();

  React.useEffect(() => {
    if (!focusedEntryId) return undefined;
    const el = document.getElementById(`itinerary-entry-${focusedEntryId}`);
    if (el) {
      window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
    const t = window.setTimeout(() => setFocusedEntryId(null), 4000);
    return () => window.clearTimeout(t);
  }, [focusedEntryId, setFocusedEntryId]);
  const [taskEntryIds, setTaskEntryIds] = React.useState<Set<string>>(new Set());
  const [entryLinkedTask, setEntryLinkedTask] = React.useState<Map<string, LinkedEntryTask>>(new Map());
  const [entryLinkedTasks, setEntryLinkedTasks] = React.useState<Map<string, LinkedEntryTask[]>>(new Map());
  const [cancellationDeadlineEntryIds, setCancellationDeadlineEntryIds] = React.useState<Set<string>>(new Set());
  const preTripDayId = React.useMemo(() => (trip ? resolvePreTripDayId(tripDays, trip.id) : undefined), [trip, tripDays]);

  const calendarDate = React.useMemo(() => {
    if (!trip) return '';
    const d = tripDays.find((x) => x.id === dayId && x.tripId === trip.id);
    return d?.calendarDate ?? '';
  }, [dayId, trip, tripDays]);
  const dayMeta = React.useMemo(
    () => (trip ? tripDays.find((x) => x.id === dayId && x.tripId === trip.id) : undefined),
    [trip, tripDays, dayId]
  );
  const dayType = dayMeta?.dayType;
  const suppressCarryoverUi = Boolean(dayMeta && isPreTripDayRow(dayMeta));

  const sorted = React.useMemo(() => {
    const raw = sortEntriesForDay(
      localEntries,
      dayId,
      calendarDate,
      dayType,
      preTripDayId,
      dayMeta ? isPreTripDayRow(dayMeta) : false,
      tripDays
    );
    const ordered = trip ? applyDayViewEntryOrder(trip.id, dayId, raw, calendarDate, tripDays) : raw;
    const rows = expandTimelineDisplayRows(ordered, calendarDate, tripDays);
    return trip ? applyDayViewTimelineRowOrder(trip.id, dayId, rows) : rows;
  }, [localEntries, dayId, calendarDate, dayType, preTripDayId, dayMeta, trip, tripDays]);

  const loadEntryTasks = React.useCallback((): void => {
    if (!trip?.id) {
      setTaskEntryIds(new Set());
      setEntryLinkedTask(new Map());
      setEntryLinkedTasks(new Map());
      setCancellationDeadlineEntryIds(new Set());
      return;
    }
    const svc = new ReminderService(spContext);
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        const ids = new Set<string>();
        const reminderByEntry = new Map<string, LinkedEntryTask>();
        const remindersByEntry = new Map<string, LinkedEntryTask[]>();
        const cancelIds = new Set<string>();
        for (const r of rows) {
          const eid = (r.entryId || '').trim();
          if (!eid) continue;
          const rt = (r.reminderType || '').trim();
          if (rt === 'Manual' || rt === 'ManualEntryTask') {
            ids.add(eid);
            const linked: LinkedEntryTask = {
              reminderId: r.id,
              text: r.reminderText || r.title || '',
              taskNote: r.taskNote,
              dueDate: r.dueDate,
              assignedTo: r.assignedTo,
              taskCategory: r.taskCategory
            };
            const list = remindersByEntry.get(eid) ?? [];
            list.push(linked);
            remindersByEntry.set(eid, list);
            reminderByEntry.set(eid, linked);
          }
          if (rt === 'CancellationDeadline') {
            cancelIds.add(eid);
          }
        }
        setTaskEntryIds(ids);
        setEntryLinkedTask(reminderByEntry);
        setEntryLinkedTasks(remindersByEntry);
        setCancellationDeadlineEntryIds(cancelIds);
      })
      .catch(() => {
        setTaskEntryIds(new Set());
        setEntryLinkedTask(new Map());
        setEntryLinkedTasks(new Map());
        setCancellationDeadlineEntryIds(new Set());
      });
  }, [spContext, trip?.id]);

  React.useEffect(() => {
    loadEntryTasks();
  }, [loadEntryTasks]);

  React.useEffect(() => {
    const onReminderUpdated = (): void => loadEntryTasks();
    window.addEventListener('trip-reminders-updated', onReminderUpdated);
    return () => window.removeEventListener('trip-reminders-updated', onReminderUpdated);
  }, [loadEntryTasks]);

  const nextSortOrder = React.useMemo(() => {
    const dayE = localEntries.filter((e) => e.dayId === dayId);
    if (dayE.length === 0) {
      return 0;
    }
    return Math.max(...dayE.map((e) => e.sortOrder)) + 1;
  }, [localEntries, dayId]);

  if (!trip) {
    return null;
  }

  const showComposer = editingCardId === 'new';
  const showEmpty = sorted.length === 0 && !showComposer;

  if (showEmpty) {
    return (
      <div className={styles.empty} role="status">
        No items yet — use + Add to get started
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.rail} aria-hidden />
      {showComposer ? (
        <div className={styles.row}>
          <div className={styles.timeCell} />
          <div className={styles.nodeWrap}>
            <div
              className={`${styles.node} ${styles.nodeEditing}`}
              data-category="other"
            />
          </div>
          <div className={styles.cardCell}>
            <NewComposer tripId={trip.id} dayId={dayId} calendarDate={calendarDate} nextSortOrder={nextSortOrder} suppressCarryoverUi={suppressCarryoverUi} />
          </div>
        </div>
      ) : null}
      <SortableContext items={sorted.map((row) => row.key)} strategy={verticalListSortingStrategy}>
        {sorted.map((row) => {
          const entry = row.entry;
          const categorySlug = getCategorySlug(entry.category);
          const editing = editingCardId === entry.id;
          const timeLabel = formatTimeHHMM(
            effectiveTransportLegTime(entry, calendarDate, tripDays, row.transportLeg)
          );
          return (
            <div key={row.key} className={styles.row}>
              <div className={styles.timeCell}>{timeLabel}</div>
              <div className={styles.nodeWrap}>
                <div
                  className={`${styles.node} ${editing ? styles.nodeEditing : ''}`}
                  data-category={categorySlug}
                />
              </div>
              <div className={styles.cardCell}>
                <ItineraryCard
                  entry={entry}
                  calendarDate={calendarDate}
                  suppressCarryoverUi={suppressCarryoverUi}
                  draggable
                  sortableId={row.key}
                  transportLeg={row.transportLeg}
                  hasTask={taskEntryIds.has(entry.id)}
                  linkedEntryTask={entryLinkedTask.get(entry.id)}
                  linkedEntryTasks={entryLinkedTasks.get(entry.id)}
                  hasCancellationDeadlineReminder={cancellationDeadlineEntryIds.has(entry.id)}
                />
              </div>
            </div>
          );
        })}
      </SortableContext>
    </div>
  );
};
