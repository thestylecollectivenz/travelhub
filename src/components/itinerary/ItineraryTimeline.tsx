import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { MOCK_TRIP_DAYS } from '../../mocks/tripMock';
import { formatTimeHHMM, minutesFromTimeStart } from '../../utils/itineraryTimeUtils';
import { categoryNodeColor } from '../../utils/itineraryCategoryColors';
import { ItineraryCard } from './ItineraryCard';
import styles from './ItineraryTimeline.module.css';

export interface ItineraryTimelineProps {
  dayId: string;
}

function sortEntriesForDay(entries: ItineraryEntry[], dayId: string): ItineraryEntry[] {
  const forDay = entries.filter((e) => e.dayId === dayId);
  return [...forDay].sort((a, b) => {
    const ma = minutesFromTimeStart(a.timeStart);
    const mb = minutesFromTimeStart(b.timeStart);
    if (ma !== undefined && mb !== undefined && ma !== mb) {
      return ma - mb;
    }
    if (ma !== undefined && mb === undefined) {
      return -1;
    }
    if (ma === undefined && mb !== undefined) {
      return 1;
    }
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
      categoryColor={categoryNodeColor(draftEntry.category)}
      calendarDate={calendarDate}
    />
  );
};

export const ItineraryTimeline: React.FC<ItineraryTimelineProps> = ({ dayId }) => {
  const { trip, localEntries, editingCardId } = useTripWorkspace();

  const calendarDate = React.useMemo(() => {
    const d = MOCK_TRIP_DAYS.find((x) => x.id === dayId && x.tripId === trip.id);
    return d?.calendarDate ?? '';
  }, [dayId, trip.id]);

  const sorted = React.useMemo(() => sortEntriesForDay(localEntries, dayId), [localEntries, dayId]);

  const nextSortOrder = React.useMemo(() => {
    const dayE = localEntries.filter((e) => e.dayId === dayId);
    if (dayE.length === 0) {
      return 0;
    }
    return Math.max(...dayE.map((e) => e.sortOrder)) + 1;
  }, [localEntries, dayId]);

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
      {sorted.map((entry) => {
        const color = categoryNodeColor(entry.category);
        const editing = editingCardId === entry.id;
        const timeLabel = formatTimeHHMM(entry.timeStart);
        return (
          <div key={entry.id} className={styles.row}>
            <div className={styles.timeCell}>{timeLabel}</div>
            <div className={styles.nodeWrap}>
              <div
                className={`${styles.node} ${editing ? styles.nodeEditing : ''}`}
                style={
                  (editing
                    ? { ['--node-category' as string]: color }
                    : { borderColor: color }) as React.CSSProperties
                }
              />
            </div>
            <div className={styles.cardCell}>
              <ItineraryCard entry={entry} categoryColor={color} calendarDate={calendarDate} />
            </div>
          </div>
        );
      })}
      {showComposer ? (
        <div className={styles.row}>
          <div className={styles.timeCell} />
          <div className={styles.nodeWrap}>
            <div
              className={`${styles.node} ${styles.nodeEditing}`}
              style={
                {
                  borderColor: categoryNodeColor('Other'),
                  '--node-category': categoryNodeColor('Other')
                } as React.CSSProperties
              }
            />
          </div>
          <div className={styles.cardCell}>
            <NewComposer tripId={trip.id} dayId={dayId} calendarDate={calendarDate} nextSortOrder={nextSortOrder} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
