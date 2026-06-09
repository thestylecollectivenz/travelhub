import * as React from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { JournalEntry } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import { JournalEntrySortable } from './JournalEntrySortable';
import { JournalEntryComposer } from './JournalEntryComposer';
import { TRAVELHUB_SCROLL_JOURNAL_DAY } from '../../utils/contentScroll';
import { formatJournalDayTitle } from '../../utils/formatDayHeadingLabel';
import { journalFeedCollisionDetection } from '../../utils/journalDndCollision';
import {
  fromJournalEntryPhotoDropId,
  fromPhotoSortId,
  isJournalEntryPhotoDropId,
  isPhotoSortId
} from '../../utils/journalPhotoSortId';
import { loadJournalViewPrefs, saveJournalViewPrefs } from '../../utils/journalViewPrefs';
import styles from './TripJournalFeed.module.css';

type SortOrder = 'newest' | 'oldest';
type ReadFilter = 'all' | 'unread' | 'read';
type JournalLayout = 'all' | 'by-day';

function JournalDayHeaderDrop({
  dayId,
  title
}: {
  dayId: string;
  title: string;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: `journal-day-drop-${dayId}` });
  return (
    <h3
      ref={setNodeRef}
      className={`${styles.dayTag} ${isOver ? styles.dayTagDropActive : ''}`}
      title="Drop here to move entry to this day"
    >
      {title}
    </h3>
  );
}

function JournalDaySection({
  dayId,
  title,
  entryIds,
  children
}: {
  dayId: string;
  title: string;
  entryIds: string[];
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={`journal-day-${dayId}`} className={styles.daySection} aria-label={title}>
      <JournalDayHeaderDrop dayId={dayId} title={title} />
      <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
        <div className={styles.dayEntries}>{children}</div>
      </SortableContext>
    </section>
  );
}

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry, moveEntryToDay, reorderEntryBefore, reorderPhotoInEntry, assignPhotoToEntry } =
    useJournal();
  const { trip, tripDays, sharedPreview, selectedDayId, setSelectedDayId } = useTripWorkspace();
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('all');
  const [layout, setLayout] = React.useState<JournalLayout>('all');
  const [scopeDayId, setScopeDayId] = React.useState('');
  const [lastSeenAt, setLastSeenAt] = React.useState<string | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerDayId, setComposerDayId] = React.useState('');

  React.useEffect(() => {
    if (!trip?.id) return;
    const key = `travelhub-journal-last-seen-${trip.id}`;
    const prev = window.localStorage.getItem(key);
    setLastSeenAt(prev);
    window.localStorage.setItem(key, new Date().toISOString());
  }, [trip?.id]);

  React.useEffect(() => {
    if (!trip?.id) return;
    const saved = loadJournalViewPrefs(trip.id);
    setLayout('all');
    setScopeDayId('');
    setSelectedDayId('');
    if (saved) {
      setSortOrder(saved.sortOrder);
      setReadFilter(saved.readFilter);
    } else {
      setReadFilter('all');
    }
  }, [trip?.id, setSelectedDayId]);

  React.useEffect(() => {
    if (!trip?.id) return;
    saveJournalViewPrefs(trip.id, { layout, scopeDayId, sortOrder, readFilter });
    window.dispatchEvent(new CustomEvent('travelhub-journal-layout', { detail: { layout } }));
  }, [trip?.id, layout, scopeDayId, sortOrder, readFilter]);

  React.useEffect(() => {
    const onLayout = (ev: Event): void => {
      const next = (ev as CustomEvent<{ layout?: JournalLayout }>).detail?.layout;
      if (next === 'all' || next === 'by-day') setLayout(next);
    };
    window.addEventListener('travelhub-journal-layout', onLayout as EventListener);
    return () => window.removeEventListener('travelhub-journal-layout', onLayout as EventListener);
  }, []);

  React.useEffect(() => {
    const onScrollDay = (ev: Event): void => {
      const dayId = (ev as CustomEvent<{ dayId?: string }>).detail?.dayId;
      if (!dayId) return;
      window.requestAnimationFrame(() => {
        document.getElementById(`journal-day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener(TRAVELHUB_SCROLL_JOURNAL_DAY, onScrollDay as EventListener);
    return () => window.removeEventListener(TRAVELHUB_SCROLL_JOURNAL_DAY, onScrollDay as EventListener);
  }, []);

  React.useEffect(() => {
    if (!selectedDayId) return;
    if (layout === 'by-day') {
      setScopeDayId(selectedDayId);
    }
    document.getElementById(`journal-day-${selectedDayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedDayId, layout]);

  const hidePreTripJournal = sharedPreview;

  const journalDays = React.useMemo(() => {
    if (!trip) return [];
    return tripDays
      .filter((d) => d.tripId === trip.id && (!hidePreTripJournal || d.dayType !== 'PreTrip'))
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays, hidePreTripJournal]);

  const daysForTrip = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id);
  }, [trip, tripDays]);

  const selectableComposerDays = React.useMemo(() => {
    if (!hidePreTripJournal) return daysForTrip;
    const nonPre = daysForTrip.filter((d) => d.dayType !== 'PreTrip');
    return nonPre.length > 0 ? nonPre : daysForTrip;
  }, [daysForTrip, hidePreTripJournal]);

  const resolveDefaultComposerDayId = React.useCallback((): string => {
    if (!trip || !daysForTrip.length) return '';
    const sel = daysForTrip.find((d) => d.id === selectedDayId);
    if (sel) {
      if (!hidePreTripJournal || sel.dayType !== 'PreTrip') return sel.id;
      const fallback = daysForTrip.find((d) => d.dayType !== 'PreTrip');
      return fallback?.id ?? sel.id;
    }
    const first = daysForTrip.find((d) => !hidePreTripJournal || d.dayType !== 'PreTrip') ?? daysForTrip[0];
    return first?.id ?? '';
  }, [trip, daysForTrip, selectedDayId, hidePreTripJournal]);

  const preTripDayIds = React.useMemo(() => {
    if (!trip) return new Set<string>();
    return new Set(
      tripDays.filter((d) => d.tripId === trip.id && d.dayType === 'PreTrip').map((d) => d.id)
    );
  }, [trip, tripDays]);

  const entriesForFeed = React.useMemo(() => {
    if (!hidePreTripJournal) return allEntries;
    return allEntries.filter((e) => !preTripDayIds.has(e.dayId));
  }, [allEntries, hidePreTripJournal, preTripDayIds]);

  const isUnread = React.useCallback(
    (entry: JournalEntry): boolean => {
      if (!lastSeenAt) return true;
      return entry.entryTimestamp > lastSeenAt;
    },
    [lastSeenAt]
  );

  const filteredEntries = React.useMemo(() => {
    if (readFilter === 'all') return entriesForFeed;
    return entriesForFeed.filter((entry) => (readFilter === 'unread' ? isUnread(entry) : !isUnread(entry)));
  }, [entriesForFeed, readFilter, isUnread]);

  const dayHeading = React.useCallback(
    (dayId: string): string => {
      const d = tripDays.find((x) => x.id === dayId && trip && x.tripId === trip.id);
      if (!d) return 'Journal';
      return formatJournalDayTitle(d);
    },
    [trip, tripDays]
  );

  /** One section per itinerary day. Day sort is controlled above; entries stay oldest -> newest. */
  const groupedByDay = React.useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filteredEntries) {
      if (!map.has(e.dayId)) map.set(e.dayId, []);
      map.get(e.dayId)!.push(e);
    }
    for (const [dayId, entries] of Array.from(map.entries())) {
      map.set(
        dayId,
        [...entries].sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp))
      );
    }
    const sectionOrder =
      trip && tripDays.length
        ? [...tripDays]
            .filter((d) => d.tripId === trip.id && (!hidePreTripJournal || d.dayType !== 'PreTrip'))
            .sort((a, b) => (sortOrder === 'newest' ? b.dayNumber - a.dayNumber : a.dayNumber - b.dayNumber))
            .map((d) => d.id)
            .filter((id) => (map.get(id) ?? []).length > 0)
        : Array.from(map.keys());
    const order =
      layout === 'by-day' && scopeDayId
        ? sectionOrder.filter((id) => id === scopeDayId)
        : sectionOrder;
    return { order, map };
  }, [filteredEntries, trip, tripDays, sortOrder, hidePreTripJournal, layout, scopeDayId]);

  const selectedDayEntryCount = React.useMemo(
    () => (selectedDayId ? (groupedByDay.map.get(selectedDayId) ?? []).length : 0),
    [groupedByDay.map, selectedDayId]
  );

  const openNewEntry = React.useCallback(() => {
    setComposerDayId(resolveDefaultComposerDayId());
    setComposerOpen(true);
  }, [resolveDefaultComposerDayId]);

  const entryIdSet = React.useMemo(() => new Set(allEntries.map((e) => e.id)), [allEntries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;
      if (!over || sharedPreview) return;
      const activeId = String(active.id);
      const overId = String(over.id);

      if (isPhotoSortId(activeId)) {
        const activePhotoId = fromPhotoSortId(activeId);
        const activeEntryId = active.data.current?.entryId as string | undefined;
        if (!activeEntryId) return;

        if (isJournalEntryPhotoDropId(overId)) {
          const targetEntryId = fromJournalEntryPhotoDropId(overId);
          if (targetEntryId && targetEntryId !== activeEntryId) {
            const targetEntry = allEntries.find((e) => e.id === targetEntryId);
            if (targetEntry) {
              assignPhotoToEntry(activePhotoId, targetEntry.dayId, targetEntryId).catch(console.error);
            }
          }
          return;
        }

        if (!isPhotoSortId(overId)) return;
        const overPhotoId = fromPhotoSortId(overId);
        const overEntryId = over.data.current?.entryId as string | undefined;
        if (!overEntryId || activePhotoId === overPhotoId) return;

        if (activeEntryId === overEntryId) {
          reorderPhotoInEntry(activeEntryId, activePhotoId, overPhotoId).catch(console.error);
          return;
        }

        const targetEntry = allEntries.find((e) => e.id === overEntryId);
        if (!targetEntry) return;
        assignPhotoToEntry(activePhotoId, targetEntry.dayId, overEntryId)
          .then(() => reorderPhotoInEntry(overEntryId, activePhotoId, overPhotoId))
          .catch(console.error);
        return;
      }

      if (isPhotoSortId(overId)) return;
      if (!entryIdSet.has(activeId)) return;
      if (!overId.startsWith('journal-day-drop-') && !entryIdSet.has(overId)) return;
      if (overId.startsWith('journal-day-drop-')) {
        const targetDayId = overId.replace('journal-day-drop-', '');
        moveEntryToDay(activeId, targetDayId).catch(console.error);
        return;
      }
      if (activeId !== overId) {
        reorderEntryBefore(activeId, overId).catch(console.error);
      }
    },
    [sharedPreview, moveEntryToDay, reorderEntryBefore, reorderPhotoInEntry, assignPhotoToEntry, allEntries, entryIdSet]
  );

  const entryList = (
    <div className={styles.list}>
      {selectedDayId && selectedDayEntryCount === 0 ? (
        <div className={styles.empty} role="status">
          No journal entries for the selected day yet.
        </div>
      ) : null}
      {groupedByDay.order.map((dayId) => {
        const dayEntries = groupedByDay.map.get(dayId) ?? [];
        const entryIds = dayEntries.map((e) => e.id);
        const entryCards = dayEntries.map((e) =>
          sharedPreview ? (
            <div key={e.id} className={styles.block}>
              <JournalEntryCard
                entry={e}
                photos={photosForEntry(e.id)}
                journalDays={journalDays}
                canModerate={false}
                isUnread={isUnread(e)}
              />
            </div>
          ) : (
            <JournalEntrySortable
              key={e.id}
              entry={e}
              photos={photosForEntry(e.id)}
              journalDays={journalDays}
              canModerate
              isUnread={isUnread(e)}
            />
          )
        );
        if (sharedPreview) {
          return (
            <section key={dayId} id={`journal-day-${dayId}`} className={styles.daySection} aria-label={dayHeading(dayId)}>
              <h3 className={styles.dayTag}>{dayHeading(dayId)}</h3>
              <div className={styles.dayEntries}>{entryCards}</div>
            </section>
          );
        }
        return (
          <JournalDaySection key={dayId} dayId={dayId} title={dayHeading(dayId)} entryIds={entryIds}>
            {entryCards}
          </JournalDaySection>
        );
      })}
    </div>
  );

  return (
    <section className={styles.root} aria-label="Trip journal">
      <header className={styles.header}>
        <h2 className={styles.title}>Journal</h2>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Journal layout">
          <button
            type="button"
            className={`${styles.segmentBtn} ${layout === 'all' ? styles.segmentActive : ''}`}
            onClick={() => {
              setLayout('all');
              setScopeDayId('');
              setSelectedDayId('');
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${layout === 'by-day' ? styles.segmentActive : ''}`}
            onClick={() => {
              setLayout('by-day');
              setScopeDayId(selectedDayId || '');
            }}
          >
            By day
          </button>
        </div>
        {layout === 'by-day' ? (
          <label className={styles.dayFilter}>
            <span className={styles.dayFilterLabel}>Day</span>
            <select
              className={styles.daySelect}
              value={scopeDayId}
              onChange={(e) => setScopeDayId(e.target.value)}
              aria-label="Filter journal by day"
            >
              <option value="">Every day</option>
              {journalDays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber} — ${d.displayTitle}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className={styles.controls}>
        <div className={styles.sortRow} role="group" aria-label="Sort entries">
          {!sharedPreview ? (
            <button type="button" className={styles.newEntryAction} onClick={openNewEntry}>
              New journal entry
            </button>
          ) : null}
          <button
            type="button"
            className={styles.exportAction}
            onClick={() => window.dispatchEvent(new CustomEvent('open-journal-export'))}
          >
            Export journal
          </button>
          <span className={styles.sortLabel}>Order</span>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'newest' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('newest')}
          >
            Newest first
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${sortOrder === 'oldest' ? styles.sortBtnActive : ''}`}
            onClick={() => setSortOrder('oldest')}
          >
            Oldest first
          </button>
        </div>
        <div className={styles.filterRow} role="group" aria-label="Filter by read status">
          <span className={styles.sortLabel}>Show</span>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'all' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'unread' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('unread')}
          >
            Unread
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${readFilter === 'read' ? styles.sortBtnActive : ''}`}
            onClick={() => setReadFilter('read')}
          >
            Read
          </button>
        </div>
      </div>

      {composerOpen && composerDayId && !sharedPreview ? (
        <div className={styles.composerSection}>
          <label className={styles.composerDayLabel}>
            <span>Day</span>
            <select
              className={styles.composerDaySelect}
              value={composerDayId}
              onChange={(e) => setComposerDayId(e.target.value)}
              aria-label="Journal entry day"
            >
              {selectableComposerDays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber} — ${d.displayTitle}`}
                </option>
              ))}
            </select>
          </label>
          <JournalEntryComposer
            dayId={composerDayId}
            onCancel={() => setComposerOpen(false)}
            onSaved={() => setComposerOpen(false)}
          />
        </div>
      ) : null}

      {filteredEntries.length === 0 && !composerOpen ? (
        <div className={styles.empty} role="status">
          No journal entries for this trip yet.
        </div>
      ) : null}
      {filteredEntries.length > 0 ? (
        !sharedPreview ? (
          <DndContext
            sensors={sensors}
            collisionDetection={journalFeedCollisionDetection}
            onDragEnd={handleDragEnd}
          >
            {entryList}
          </DndContext>
        ) : (
          entryList
        )
      ) : null}
    </section>
  );
};
