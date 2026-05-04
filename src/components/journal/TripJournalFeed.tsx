import * as React from 'react';
import type { JournalEntry } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryCard } from './JournalEntryCard';
import { JournalEntryComposer } from './JournalEntryComposer';
import styles from './TripJournalFeed.module.css';

type SortOrder = 'newest' | 'oldest';
type ReadFilter = 'all' | 'unread' | 'read';

export const TripJournalFeed: React.FC = () => {
  const { allEntries, photosForEntry } = useJournal();
  const { trip, tripDays, sharedPreview, selectedDayId } = useTripWorkspace();
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('all');
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

  const hidePreTripJournal = sharedPreview;

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
      if (d.dayType === 'PreTrip') return 'Pre-trip';
      return `Day ${d.dayNumber} — ${d.displayTitle}`;
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
    return { order: sectionOrder, map };
  }, [filteredEntries, trip, tripDays, sortOrder, hidePreTripJournal]);

  const openNewEntry = React.useCallback(() => {
    setComposerDayId(resolveDefaultComposerDayId());
    setComposerOpen(true);
  }, [resolveDefaultComposerDayId]);

  return (
    <section className={styles.root} aria-label="Trip journal">
      <header className={styles.header}>
        <h2 className={styles.title}>Journal</h2>
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
      </header>

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
        <div className={styles.list}>
          {groupedByDay.order.map((dayId) => (
            <section key={dayId} className={styles.daySection} aria-label={dayHeading(dayId)}>
              <h3 className={styles.dayTag}>{dayHeading(dayId)}</h3>
              <div className={styles.dayEntries}>
                {(groupedByDay.map.get(dayId) ?? []).map((e) => (
                  <div key={e.id} className={styles.block}>
                    <JournalEntryCard entry={e} photos={photosForEntry(e.id)} canModerate={!sharedPreview} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
};
