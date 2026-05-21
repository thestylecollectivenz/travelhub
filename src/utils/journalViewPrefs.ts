export type JournalLayoutPref = 'all' | 'by-day';
export type JournalReadFilterPref = 'all' | 'unread' | 'read';
export type JournalSortPref = 'newest' | 'oldest';

export interface JournalViewPrefs {
  layout: JournalLayoutPref;
  scopeDayId: string;
  sortOrder: JournalSortPref;
  readFilter: JournalReadFilterPref;
}

const KEY_PREFIX = 'travelhub-journal-prefs-';

export function loadJournalViewPrefs(tripId: string): JournalViewPrefs | null {
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${tripId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JournalViewPrefs>;
    if (parsed.layout !== 'all' && parsed.layout !== 'by-day') return null;
    return {
      layout: parsed.layout,
      scopeDayId: typeof parsed.scopeDayId === 'string' ? parsed.scopeDayId : '',
      sortOrder: parsed.sortOrder === 'oldest' ? 'oldest' : 'newest',
      readFilter:
        parsed.readFilter === 'unread' || parsed.readFilter === 'read' ? parsed.readFilter : 'all'
    };
  } catch {
    return null;
  }
}

export function saveJournalViewPrefs(tripId: string, prefs: JournalViewPrefs): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${tripId}`, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}
