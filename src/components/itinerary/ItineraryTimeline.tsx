import * as React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { sortEntriesForDay } from '../../utils/itineraryDayEntries';
import { ItineraryCard } from './ItineraryCard';
import { ReminderService } from '../../services/ReminderService';
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
  const { trip, localEntries, editingCardId, tripDays } = useTripWorkspace();
  const [taskEntryIds, setTaskEntryIds] = React.useState<Set<string>>(new Set());

  const calendarDate = React.useMemo(() => {
    if (!trip) return '';
    const d = tripDays.find((x) => x.id === dayId && x.tripId === trip.id);
    return d?.calendarDate ?? '';
  }, [dayId, trip, tripDays]);
  const dayType = React.useMemo(
    () => (trip ? tripDays.find((x) => x.id === dayId && x.tripId === trip.id)?.dayType : undefined),
    [trip, tripDays, dayId]
  );
  const suppressCarryoverUi = dayType === 'PreTrip' || String(dayType) === 'Pre-trip';

  const sorted = React.useMemo(() => sortEntriesForDay(localEntries, dayId, calendarDate, dayType), [localEntries, dayId, calendarDate, dayType]);

  const loadEntryTasks = React.useCallback((): void => {
    if (!trip?.id) {
      setTaskEntryIds(new Set());
      return;
    }
    const svc = new ReminderService(spContext);
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        const ids = new Set(rows.map((r) => (r.entryId || '').trim()).filter(Boolean));
        setTaskEntryIds(ids);
      })
      .catch(() => setTaskEntryIds(new Set()));
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
      <SortableContext items={sorted.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
        {sorted.map((entry) => {
          const categorySlug = getCategorySlug(entry.category);
          const editing = editingCardId === entry.id;
          const timeLabel = formatTimeHHMM(entry.timeStart);
          return (
            <div key={entry.id} className={styles.row}>
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
                  draggable={entry.dayId === dayId}
                  hasTask={taskEntryIds.has(entry.id)}
                />
              </div>
            </div>
          );
        })}
      </SortableContext>
    </div>
  );
};
