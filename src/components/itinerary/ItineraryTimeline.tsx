import * as React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { ItineraryCard } from './ItineraryCard';
import styles from './ItineraryTimeline.module.css';

export interface ItineraryTimelineProps {
  dayId: string;
}

function sortEntriesForDay(entries: ItineraryEntry[], dayId: string): ItineraryEntry[] {
  const forDay = entries.filter((e) => e.dayId === dayId);
  return [...forDay].sort((a, b) => a.sortOrder - b.sortOrder);
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
  const [draftEntry] = React.useState<ItineraryEntry>(() => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `new-${crypto.randomUUID()}`
        : `new-${Date.now()}`;
    return createBlankEntry(tripId, dayId, nextSortOrder, id);
  });

  return (
    <ItineraryCard
      entry={draftEntry}
      calendarDate={calendarDate}
      draggable={false}
    />
  );
};

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({ dayId }) => {
  const { trip, localEntries, editingCardId, tripDays } = useTripWorkspace();

  const calendarDate = React.useMemo(() => {
    if (!trip) return '';
    const d = tripDays.find((x) => x.id === dayId && x.tripId === trip.id);
    return d?.calendarDate ?? '';
  }, [dayId, trip, tripDays]);

  const sorted = React.useMemo(() => sortEntriesForDay(localEntries, dayId), [localEntries, dayId]);

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
                <ItineraryCard entry={entry} calendarDate={calendarDate} />
              </div>
            </div>
          );
        })}
      </SortableContext>
    </div>
  );
};
