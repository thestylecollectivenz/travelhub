import * as React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { ItineraryCard } from './ItineraryCard';
import styles from './ItineraryTimeline.module.css';

export interface ItineraryTimelineProps {
  dayId: string;
}

function isEntryOnCalendarDate(entry: ItineraryEntry, calendarDate: string, dayType?: string): boolean {
  if (dayType === 'PreTrip') return false;
  if (entry.category !== 'Accommodation' || !entry.dateStart || !entry.dateEnd || !calendarDate) return false;
  const day = new Date(`${calendarDate}T00:00:00.000Z`);
  const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
  const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
}

function sortEntriesForDay(entries: ItineraryEntry[], dayId: string, calendarDate: string, dayType?: string): ItineraryEntry[] {
  const map = new Map<string, ItineraryEntry>();
  for (const e of entries) {
    if (e.parentEntryId) continue;
    if (e.dayId === dayId || isEntryOnCalendarDate(e, calendarDate, dayType)) {
      map.set(e.id, e);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aMin = minutesFromTimeStart(a.timeStart);
    const bMin = minutesFromTimeStart(b.timeStart);
    if (aMin !== undefined && bMin !== undefined) return aMin - bMin;
    if (aMin !== undefined) return -1;
    if (bMin !== undefined) return 1;
    return a.sortOrder - b.sortOrder;
  });
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
}

const NewComposer: React.FC<NewComposerProps> = ({ tripId, dayId, calendarDate, nextSortOrder }) => {
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
        draggable={false}
      />
    </div>
  );
};

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({ dayId }) => {
  const { trip, localEntries, editingCardId, tripDays } = useTripWorkspace();

  const calendarDate = React.useMemo(() => {
    if (!trip) return '';
    const d = tripDays.find((x) => x.id === dayId && x.tripId === trip.id);
    return d?.calendarDate ?? '';
  }, [dayId, trip, tripDays]);
  const dayType = React.useMemo(() => tripDays.find((x) => x.id === dayId)?.dayType, [tripDays, dayId]);

  const sorted = React.useMemo(() => sortEntriesForDay(localEntries, dayId, calendarDate, dayType), [localEntries, dayId, calendarDate, dayType]);

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
            <NewComposer tripId={trip.id} dayId={dayId} calendarDate={calendarDate} nextSortOrder={nextSortOrder} />
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
                <ItineraryCard entry={entry} calendarDate={calendarDate} draggable={entry.dayId === dayId} />
              </div>
            </div>
          );
        })}
      </SortableContext>
    </div>
  );
};
