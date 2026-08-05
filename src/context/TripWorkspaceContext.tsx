import * as React from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import { loadTripBookingMechanisms } from '../utils/tripBookingMechanisms';
import { TripService } from '../services/TripService';
import { DayService } from '../services/DayService';
import { ItineraryService } from '../services/ItineraryService';
import { ReminderService } from '../services/ReminderService';
import { syncEntryCancellationDeadlineReminder } from '../utils/entryCancellationReminderSync';
import { insertSubItemByTime } from '../utils/subItemSort';
import { FxService } from '../services/FxService';
import { mergeTripDisplayPrefs, saveTripDisplayPrefs } from '../utils/tripDisplayPrefs';
import { useSpContext } from './SpContext';
import { repairPreTripCalendarIfCollidingWithFirstDay } from '../utils/tripPreTripCalendarAnchor';
import {
  defaultTripDayId,
  peekPendingTripDayPayload,
  resolvePendingTripDayId
} from '../utils/mobileTripDayPending';
import { calendarDayBefore, planChronologicalRenumber, ymdSlice } from '../utils/tripDateRangeSync';
import { formatTimeHHMM } from '../utils/itineraryTimeUtils';
import {
  isPreTripDayRow,
  resolvePreTripDayId,
  sortEntriesForDay
} from '../utils/itineraryDayEntries';
import { isPendingItineraryEntryId, isPendingSubItemId } from '../utils/itineraryEntryIds';
import { itineraryEntryCreatePayload } from '../utils/itineraryCreatePayload';
import {
  clearLegacyDayPlanningStatus,
  loadLegacyDayPlanningStatus
} from '../utils/tripDayPlanningStatus';
import {
  insertAfterInDayViewEntryOrder,
  removeFromDayViewEntryOrder,
  replaceIdInDayViewEntryOrder,
  syncDayColumnsForEntryTimeOrder
} from '../utils/dayViewEntryOrder';
import { useConfig } from './ConfigContext';
import { useOfflineStatus, OFFLINE_WRITE_MESSAGE } from './OfflineStatusContext';
import {
  loadTripOfflineCache,
  scheduleTripOfflineCacheWrite,
  flushTripOfflineCacheWrite
} from '../utils/tripOfflineCache';
import { warmTripOfflineExtras, syncOpenTripIntoTripsIndex, TRIP_OFFLINE_EXTRAS_REFRESH_MS } from '../utils/warmTripOfflineExtras';
import { refreshTripOfflineRemindersCache } from '../utils/refreshTripOfflineRemindersCache';
import { isLikelyNetworkError } from '../utils/networkError';
import type { BudgetCategoryKey } from '../utils/financialUtils';
import type { WorkspaceReturnState } from '../types/workspaceReturn';

export type MainWorkspaceTab = 'itinerary' | 'journal' | 'photos' | 'files' | 'map' | 'plan' | 'budget';

export interface EditingSubItemRef {
  parentEntryId: string;
  subItemId: string;
}

function newTempId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortItineraryEntries(entries: ItineraryEntry[]): ItineraryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId, undefined, { numeric: true });
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

/** Keep in-flight creates/duplicates when reloading from SharePoint after background updates. */
function mergeLoadedItineraryEntries(loaded: ItineraryEntry[], previous: ItineraryEntry[]): ItineraryEntry[] {
  const pending = previous.filter((e) => isPendingItineraryEntryId(e.id));
  if (pending.length === 0) {
    return loaded;
  }
  const merged = [...loaded];
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    if (!merged.some((e) => e.id === p.id)) {
      merged.push(p);
    }
  }
  return sortItineraryEntries(merged);
}

export interface TripWorkspaceContextValue {
  trip: Trip | null;
  tripDays: TripDay[];
  selectedDayId: string;
  setSelectedDayId: (id: string) => void;
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;
  /** Option/sub-item open in the right-hand edit panel. */
  editingSubItem: EditingSubItemRef | null;
  setEditingSubItem: (ref: EditingSubItemRef | null) => void;
  /** Scroll/highlight an itinerary card in read mode (not edit). */
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  localEntries: ItineraryEntry[];
  loading: boolean;
  error: string | null;
  deletingTrip: boolean;
  deleteTripError: string | null;
  retryLoad: () => void;
  updateTrip: (partial: Partial<Trip>) => void;
  deleteTrip: () => Promise<void>;
  clearDeleteTripError: () => void;
  updateDay: (dayId: string, partial: Partial<TripDay>) => void;
  reloadItineraryEntries: () => Promise<void>;
  updateEntry: (updated: ItineraryEntry, options?: { persistPending?: boolean }) => void | Promise<void>;
  /** Add or update a pending draft in local state only — does not persist to SharePoint. */
  stageDraftEntry: (draft: ItineraryEntry) => void;
  /** Ensure a draft entry exists in SharePoint; returns the persisted row (same id if already saved). */
  persistEntry: (entry: ItineraryEntry) => Promise<ItineraryEntry>;
  deleteEntry: (entryId: string) => void;
  duplicateEntry: (entryId: string) => void;
  reorderEntries: (dayId: string, orderedIds: string[]) => void;
  moveEntryToDay: (entryId: string, targetDayId: string) => void;
  /** Add missing TripDay rows for a date range and refresh pre-trip anchor. Returns newly created days. */
  syncTripCalendarDaysForRange: (dateStart: string, dateEnd: string) => Promise<TripDay[]>;
  moveAllItineraryEntriesBetweenDays: (fromDayId: string, toDayId: string) => Promise<void>;
  updateSubItem: (entryId: string, updatedSubItem: ItinerarySubItem) => void;
  /** Ensure a draft option exists in SharePoint; returns the persisted row. */
  persistSubItem: (entryId: string, subItem: ItinerarySubItem) => Promise<ItinerarySubItem>;
  addSubItem: (entryId: string, subItem: Omit<ItinerarySubItem, 'id'> & { id?: string }) => string;
  deleteSubItem: (entryId: string, subItemId: string) => void;
  duplicateSubItem: (entryId: string, subItemId: string) => void;
  reorderSubItems: (entryId: string, orderedSubItemIds: string[]) => void;
  moveSubItem: (fromEntryId: string, subItemId: string, toEntryId: string) => void;
  convertToHomeCurrency: (amount: number, currency: string) => number;
  mainWorkspaceTab: MainWorkspaceTab;
  setMainWorkspaceTab: (tab: MainWorkspaceTab) => void;
  selectedBudgetCategory: BudgetCategoryKey | null;
  setSelectedBudgetCategory: (category: BudgetCategoryKey | null) => void;
  sharedPreview: boolean;
  setSharedPreview: (value: boolean) => void;
  /** When set, itinerary shows a control to return to the prior tab/view (tasks, missing costs, etc.). */
  workspaceReturn: WorkspaceReturnState | null;
  setWorkspaceReturn: (state: WorkspaceReturnState | null) => void;
  usedSuppliers: string[];
  usedLocations: string[];
  usedCurrencies: string[];
  usedBookingMechanisms: string[];
}

const TripWorkspaceContext = React.createContext<TripWorkspaceContextValue | undefined>(undefined);

export interface ITripWorkspaceProviderProps {
  tripId: string;
  onBack: () => void;
  children: React.ReactNode;
}

async function runBatched<T>(items: T[], batchSize: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(worker));
  }
}

function itineraryEntryTimeFieldsChanged(prev: ItineraryEntry, next: ItineraryEntry): boolean {
  const normTime = (value?: string): string => formatTimeHHMM(value || '');
  return (
    normTime(prev.timeStart) !== normTime(next.timeStart) ||
    normTime(prev.arrivalTime) !== normTime(next.arrivalTime) ||
    normTime(prev.checkOutTime) !== normTime(next.checkOutTime) ||
    normTime(prev.returnTime) !== normTime(next.returnTime) ||
    normTime(prev.returnArrivalTime) !== normTime(next.returnArrivalTime) ||
    ymdSlice(prev.dateStart) !== ymdSlice(next.dateStart) ||
    ymdSlice(prev.dateEnd) !== ymdSlice(next.dateEnd) ||
    ymdSlice(prev.returnDate) !== ymdSlice(next.returnDate) ||
    ymdSlice(prev.arrivalDate) !== ymdSlice(next.arrivalDate)
  );
}

async function persistHomeDaySortOrders(
  spContext: WebPartContext,
  dayId: string,
  entries: ItineraryEntry[],
  tripDays: TripDay[],
  setLocalEntries: React.Dispatch<React.SetStateAction<ItineraryEntry[]>>
): Promise<void> {
  const day = tripDays.find((d) => d.id === dayId);
  const tripId = day?.tripId;
  if (!day || !tripId) return;

  const preTripDayId = resolvePreTripDayId(tripDays, tripId);
  const sorted = sortEntriesForDay(
    entries,
    dayId,
    day.calendarDate,
    day.dayType,
    preTripDayId,
    isPreTripDayRow(day),
    tripDays
  );
  const native = sorted.filter((e) => e.dayId === dayId);
  const orderMap = new Map(native.map((e, i) => [e.id, i]));
  const updates = native
    .map((e, i) => ({ id: e.id, sortOrder: i }))
    .filter(({ id, sortOrder }) => {
      const current = entries.find((e) => e.id === id);
      return (current?.sortOrder ?? -1) !== sortOrder;
    });

  setLocalEntries((prev) =>
    prev.map((e) => (orderMap.has(e.id) ? { ...e, sortOrder: orderMap.get(e.id)! } : e))
  );

  if (!updates.length) return;
  const svc = new ItineraryService(spContext);
  await runBatched(updates, 5, async ({ id, sortOrder }) => {
    await svc.update(id, { sortOrder });
  });
}

export function TripWorkspaceProvider({ tripId, onBack, children }: ITripWorkspaceProviderProps): React.ReactElement {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { isOnline, warnIfOffline, setViewingCachedTrip, setLastCachedAt, reportNetworkFailure } =
    useOfflineStatus();

  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [tripDays, setTripDays] = React.useState<TripDay[]>([]);
  const [localEntries, setLocalEntries] = React.useState<ItineraryEntry[]>([]);
  const localEntriesRef = React.useRef<ItineraryEntry[]>([]);
  const tripDaysRef = React.useRef<TripDay[]>([]);
  const pendingEntryCreatesRef = React.useRef<Map<string, Promise<ItineraryEntry>>>(new Map());
  const pendingSubItemCreatesRef = React.useRef<Map<string, Promise<ItinerarySubItem>>>(new Map());
  const [selectedDayId, setSelectedDayId] = React.useState<string>('');
  const [editingCardId, setEditingCardIdState] = React.useState<string | null>(null);
  const [editingSubItem, setEditingSubItemState] = React.useState<EditingSubItemRef | null>(null);
  const [focusedEntryId, setFocusedEntryId] = React.useState<string | null>(null);
  const [mainWorkspaceTab, setMainWorkspaceTab] = React.useState<MainWorkspaceTab>('itinerary');
  const [selectedBudgetCategory, setSelectedBudgetCategory] = React.useState<BudgetCategoryKey | null>(null);
  const [sharedPreview, setSharedPreview] = React.useState(false);
  const [workspaceReturn, setWorkspaceReturn] = React.useState<WorkspaceReturnState | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = React.useState<boolean>(false);
  const [deleteTripError, setDeleteTripError] = React.useState<string | null>(null);
  const [fxRates, setFxRates] = React.useState<Map<string, number>>(new Map());
  const onBackRef = React.useRef(onBack);

  React.useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const setEditingCardId = React.useCallback(
    (id: string | null) => {
      if (id !== null && warnIfOffline('edit')) return;
      setEditingCardIdState(id);
    },
    [warnIfOffline]
  );

  const setEditingSubItem = React.useCallback(
    (ref: EditingSubItemRef | null) => {
      if (ref !== null && warnIfOffline('edit')) return;
      setEditingSubItemState(ref);
    },
    [warnIfOffline]
  );

  const loadData = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const tripSvc = new TripService(spContext);
      const daySvc = new DayService(spContext);
      const entrySvc = new ItineraryService(spContext);

      const [loadedTrip, loadedDays, loadedEntries] = await Promise.all([
        tripSvc.getById(tripId),
        daySvc.getAll(tripId),
        entrySvc.getAll(tripId)
      ]);

      let anchoredDays = await repairPreTripCalendarIfCollidingWithFirstDay(daySvc, loadedTrip, loadedDays);
      for (const day of anchoredDays) {
        const legacy = loadLegacyDayPlanningStatus(tripId, day.id);
        if (legacy && legacy !== 'NotStarted' && day.planningStatus !== legacy) {
          try {
            await daySvc.update(day.id, { planningStatus: legacy });
            day.planningStatus = legacy;
          } catch {
            /* PlanningStatus column may not exist yet */
          }
        }
      }
      clearLegacyDayPlanningStatus(tripId);
      if (planChronologicalRenumber(anchoredDays).length) {
        anchoredDays = await daySvc.renumberDaysChronologically(tripId, anchoredDays);
      }
      const mergedTrip = mergeTripDisplayPrefs(loadedTrip);
      // Set trip + days + entries together so mobile does not paint mid-repair with a trip id
      // that kicks off members/role fetches before itinerary data is ready.
      setTrip(mergedTrip);
      setTripDays(anchoredDays);
      setLocalEntries(loadedEntries);
      setViewingCachedTrip(false);
      const savedAt = new Date().toISOString();
      setLastCachedAt(savedAt);
      scheduleTripOfflineCacheWrite({
        tripId,
        trip: mergedTrip,
        tripDays: anchoredDays,
        entries: loadedEntries,
        savedAt
      });
      void warmTripOfflineExtras(spContext, tripId)
        .then((extrasAt) => {
          if (extrasAt) setLastCachedAt(extrasAt);
        })
        .catch(() => undefined);
      void syncOpenTripIntoTripsIndex(mergedTrip).catch(() => undefined);
      // Initialise FX rates
      try {
        const fxSvc = new FxService(spContext);
        await fxSvc.initialise();
        // Extract the populated session cache via a helper
        const ratesMap = fxSvc.getRates();
        setFxRates(ratesMap);
      } catch (err) {
        console.error('FX init failed — proceeding without FX conversion', err);
      }
      if (anchoredDays.length > 0) {
        const pendingDayId = resolvePendingTripDayId(tripId, anchoredDays);
        if (pendingDayId) {
          setSelectedDayId(pendingDayId);
        } else if (!peekPendingTripDayPayload(tripId)) {
          const fallback = defaultTripDayId(anchoredDays);
          if (fallback) setSelectedDayId(fallback);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripWorkspaceProvider.loadData', err);
      reportNetworkFailure(err);
      const cached = await loadTripOfflineCache(tripId);
      if (cached?.trip) {
        setTrip(mergeTripDisplayPrefs(cached.trip));
        setTripDays(cached.tripDays || []);
        setLocalEntries(cached.entries || []);
        setViewingCachedTrip(true);
        setLastCachedAt(cached.savedAt || null);
        setError(null);
        if ((cached.tripDays || []).length > 0) {
          const fallback = defaultTripDayId(cached.tripDays);
          if (fallback) setSelectedDayId(fallback);
        }
      } else {
        setError(
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'This trip isn’t available offline yet. Open it once while online to save it for offline use, then try again.'
            : 'Could not load trip data. Check your connection and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, spContext, setViewingCachedTrip, setLastCachedAt, reportNetworkFailure]);

  React.useEffect(() => {
    loadData().catch(console.error);
  }, [loadData]);

  // Keep one overwritten snapshot current after successful online edits (short debounce).
  React.useEffect(() => {
    if (!trip || loading) return;
    scheduleTripOfflineCacheWrite({
      tripId: trip.id,
      trip,
      tripDays,
      entries: localEntries
    });
    void syncOpenTripIntoTripsIndex(trip).catch(() => undefined);
  }, [trip, tripDays, localEntries, loading, isOnline]);

  // Flush pending core snapshot when the tab hides / app backgrounds so offline
  // opens don't miss the last edit still sitting in the debounce timer.
  React.useEffect(() => {
    const flush = (): void => flushTripOfflineCacheWrite();
    const onVis = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // While the trip stays open for days: refresh lists/docs/places periodically and
  // whenever the app returns to the foreground (no need to exit via Home).
  React.useEffect(() => {
    if (!trip?.id || loading || !isOnline) return;
    let cancelled = false;

    const refreshExtras = (): void => {
      if (cancelled || typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void warmTripOfflineExtras(spContext, trip.id)
        .then((extrasAt) => {
          if (!cancelled && extrasAt) setLastCachedAt(extrasAt);
        })
        .catch(() => undefined);
    };

    const intervalId = window.setInterval(refreshExtras, TRIP_OFFLINE_EXTRAS_REFRESH_MS);
    const onVis = (): void => {
      if (document.visibilityState === 'visible') refreshExtras();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [trip?.id, loading, isOnline, spContext, setLastCachedAt]);

  // Immediately refresh reminders/ideas in the offline snapshot after any save
  // (day ideas, jotter, tasks) — do not wait for the 5‑minute extras warm.
  React.useEffect(() => {
    if (!trip?.id || loading || !isOnline) return;
    let cancelled = false;
    let debounceTimer: number | undefined;

    const flush = (): void => {
      if (cancelled) return;
      void refreshTripOfflineRemindersCache(spContext, trip.id)
        .then((savedAt) => {
          if (!cancelled && savedAt) setLastCachedAt(savedAt);
        })
        .catch(() => undefined);
    };

    const onChange = (): void => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      // Coalesce rapid successive saves, but still flush within ~300ms.
      debounceTimer = window.setTimeout(flush, 300);
    };

    window.addEventListener('trip-reminders-updated', onChange);
    window.addEventListener('travelhub-day-ideas-changed', onChange);
    window.addEventListener('travelhub-trip-ideas-changed', onChange);
    return () => {
      cancelled = true;
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      window.removeEventListener('trip-reminders-updated', onChange);
      window.removeEventListener('travelhub-day-ideas-changed', onChange);
      window.removeEventListener('travelhub-trip-ideas-changed', onChange);
    };
  }, [trip?.id, loading, isOnline, spContext, setLastCachedAt]);

  const wasOnlineRef = React.useRef(isOnline);
  React.useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) {
      loadData().catch(console.error);
    }
  }, [isOnline, loadData]);

  const updateTrip = React.useCallback(
    (partial: Partial<Trip>) => {
      if (warnIfOffline('write')) return;
      setTrip((prev) => (prev ? { ...prev, ...partial } : prev));
      const currentTripId = trip?.id;
      if (!currentTripId) return;
      if (partial.showAuthorName !== undefined || partial.showJournalEntryDate !== undefined) {
        saveTripDisplayPrefs(currentTripId, {
          ...(partial.showAuthorName !== undefined ? { showAuthorName: partial.showAuthorName } : {}),
          ...(partial.showJournalEntryDate !== undefined ? { showJournalEntryDate: partial.showJournalEntryDate } : {})
        });
      }
      const svc = new TripService(spContext);
      svc.update(currentTripId, partial).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('updateTrip: SP persist failed', err);
      });
    },
    [spContext, trip?.id, warnIfOffline]
  );

  const clearDeleteTripError = React.useCallback(() => {
    setDeleteTripError(null);
  }, []);

  const deleteTrip = React.useCallback(async (): Promise<void> => {
    if (warnIfOffline('write')) return;
    if (deletingTrip) return;
    setDeletingTrip(true);
    setDeleteTripError(null);
    try {
      const entrySvc = new ItineraryService(spContext);
      const daySvc = new DayService(spContext);
      const tripSvc = new TripService(spContext);

      const allEntries = await entrySvc.getAll(tripId);
      const entryIds: string[] = [];
      for (const entry of allEntries) {
        entryIds.push(entry.id);
        for (const sub of entry.subItems ?? []) {
          entryIds.push(sub.id);
        }
      }
      await runBatched(entryIds, 10, async (id) => entrySvc.delete(id));

      const days = await daySvc.getAll(tripId);
      const dayIds = days.map((d) => d.id);
      await runBatched(dayIds, 10, async (id) => daySvc.delete(id));

      await tripSvc.delete(tripId);
      onBackRef.current();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('deleteTrip failed', err);
      setDeleteTripError('Delete failed. Please try again.');
    } finally {
      setDeletingTrip(false);
    }
  }, [deletingTrip, spContext, tripId, warnIfOffline]);

  const updateDay = React.useCallback(
    (dayId: string, partial: Partial<TripDay>) => {
      if (warnIfOffline('write')) return;
      setTripDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...partial } : d)));
      const svc = new DayService(spContext);
      svc.update(dayId, partial).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('updateDay: SP persist failed', err);
      });
    },
    [spContext, warnIfOffline]
  );

  const reloadItineraryEntries = React.useCallback(async () => {
    if (!tripId) return;
    const entrySvc = new ItineraryService(spContext);
    const loaded = await entrySvc.getAll(tripId);
    setLocalEntries((prev) => mergeLoadedItineraryEntries(loaded, prev));
  }, [tripId, spContext]);

  const reloadItineraryTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const onItineraryUpdated = (): void => {
      if (reloadItineraryTimerRef.current !== undefined) {
        window.clearTimeout(reloadItineraryTimerRef.current);
      }
      reloadItineraryTimerRef.current = window.setTimeout(() => {
        reloadItineraryTimerRef.current = undefined;
        void reloadItineraryEntries();
      }, 400);
    };
    window.addEventListener('trip-itinerary-updated', onItineraryUpdated);
    return () => {
      window.removeEventListener('trip-itinerary-updated', onItineraryUpdated);
      if (reloadItineraryTimerRef.current !== undefined) {
        window.clearTimeout(reloadItineraryTimerRef.current);
      }
    };
  }, [reloadItineraryEntries]);

  React.useEffect(() => {
    localEntriesRef.current = localEntries;
  }, [localEntries]);

  React.useEffect(() => {
    tripDaysRef.current = tripDays;
  }, [tripDays]);

  const persistEntry = React.useCallback(async (entry: ItineraryEntry): Promise<ItineraryEntry> => {
    if (warnIfOffline('write')) {
      throw new Error(OFFLINE_WRITE_MESSAGE);
    }
    const latest = localEntriesRef.current.find((e) => e.id === entry.id) ?? entry;
    if (!isPendingItineraryEntryId(latest.id)) {
      return latest;
    }

    const inflight = pendingEntryCreatesRef.current.get(latest.id);
    if (inflight) {
      return inflight;
    }

    const promise = (async (): Promise<ItineraryEntry> => {
      const tempId = latest.id;
      try {
        const svc = new ItineraryService(spContext);
        const created = await svc.create(itineraryEntryCreatePayload(latest));
        // Prefer client values when SP create response omits fields (common for DayId/Notes)
        // or Phase 7 columns were stripped on 400 fallback. Empty DayId makes Pre-trip
        // items vanish from the day list (strict dayId filter).
        const createdDayId = String(created.dayId || '').trim();
        const latestDayId = String(latest.dayId || '').trim();
        const createdNotes = String(created.notes || '').trim();
        const latestNotes = String(latest.notes || '').trim();
        const merged = {
          ...latest,
          ...created,
          id: created.id,
          dayId: createdDayId || latestDayId,
          title: String(created.title || '').trim() || latest.title,
          category: String(created.category || '').trim() || latest.category,
          notes: createdNotes || latestNotes,
          amount: created.amount != null && created.amount !== 0 ? created.amount : latest.amount,
          currency: String(created.currency || '').trim() || latest.currency,
          transportFrom: created.transportFrom ?? latest.transportFrom,
          transportTo: created.transportTo ?? latest.transportTo,
          transportMode: created.transportMode ?? latest.transportMode,
          transportTransfers: created.transportTransfers ?? latest.transportTransfers,
          journeyType: created.journeyType ?? latest.journeyType,
          returnDate: created.returnDate ?? latest.returnDate,
          returnTime: created.returnTime ?? latest.returnTime,
          returnArrivalTime: created.returnArrivalTime ?? latest.returnArrivalTime,
          subItems: latest.subItems ?? []
        };
        // Repair DayId on the server when create response omitted it but client had one.
        if (!createdDayId && latestDayId) {
          void svc.update(merged.id, { dayId: latestDayId } as Partial<typeof merged>).catch((repairErr) => {
            // eslint-disable-next-line no-console
            console.error('persistEntry: DayId repair failed', repairErr);
          });
        }
        setLocalEntries((prev) => prev.map((e) => (e.id === tempId ? merged : e)));
        setEditingCardIdState((prev) => (prev === tempId ? merged.id : prev));
        pendingEntryCreatesRef.current.delete(tempId);
        const allEntries = localEntriesRef.current.map((e) => (e.id === tempId ? merged : e));
        syncDayColumnsForEntryTimeOrder(merged, allEntries, tripDaysRef.current);
        void persistHomeDaySortOrders(spContext, merged.dayId, allEntries, tripDaysRef.current, setLocalEntries).catch(
          (sortErr) => {
            // eslint-disable-next-line no-console
            console.error('persistEntry: sort order sync failed', sortErr);
          }
        );
        void syncEntryCancellationDeadlineReminder(spContext, merged)
          .then(
            () => undefined,
            (syncErr) => {
              // eslint-disable-next-line no-console
              console.error('persistEntry: cancellation reminder sync failed', syncErr);
            }
          )
          .then(() => {
            window.dispatchEvent(new Event('trip-reminders-updated'));
          });
        return merged;
      } catch (err) {
        pendingEntryCreatesRef.current.delete(tempId);
        // Keep the local draft so the user can retry — wiping it made Pre-trip adds look like "save then vanish".
        throw err;
      }
    })();

    pendingEntryCreatesRef.current.set(latest.id, promise);
    return promise;
  }, [spContext, warnIfOffline]);

  const stageDraftEntry = React.useCallback((draft: ItineraryEntry) => {
    if (!isPendingItineraryEntryId(draft.id)) return;
    if (warnIfOffline('edit')) return;
    setLocalEntries((prev) => {
      const i = prev.findIndex((e) => e.id === draft.id);
      if (i >= 0) return prev.map((e, idx) => (idx === i ? draft : e));
      return [...prev, draft];
    });
  }, [warnIfOffline]);

  const updateEntry = React.useCallback(
    async (updated: ItineraryEntry, options?: { persistPending?: boolean }): Promise<void> => {
      if (warnIfOffline('write')) {
        throw new Error(OFFLINE_WRITE_MESSAGE);
      }
      const isNew = isPendingItineraryEntryId(updated.id);
      const prev = localEntriesRef.current;
      const i = prev.findIndex((e) => e.id === updated.id);
      const prevEntry = i >= 0 ? prev[i] : undefined;
      const next = i >= 0 ? prev.map((e, idx) => (idx === i ? updated : e)) : [...prev, updated];
      localEntriesRef.current = next;
      setLocalEntries(next);

      if (isNew) {
        syncDayColumnsForEntryTimeOrder(updated, next, tripDays);
        if (options?.persistPending) {
          try {
            await persistEntry(updated);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('updateEntry (create): SP persist failed', err);
            if (isLikelyNetworkError(err)) reportNetworkFailure(err);
            // Draft already staged in `next` — reopen edit so the user can retry.
            setEditingCardId(updated.id);
            window.alert(
              isLikelyNetworkError(err)
                ? OFFLINE_WRITE_MESSAGE
                : err instanceof Error
                  ? `Could not save itinerary item: ${err.message}`
                  : 'Could not save itinerary item. Please try again.'
            );
            throw err;
          }
        }
        return;
      }

      const timeChanged = prevEntry ? itineraryEntryTimeFieldsChanged(prevEntry, updated) : false;
      if (timeChanged) {
        syncDayColumnsForEntryTimeOrder(updated, next, tripDays, { reposition: true });
        void persistHomeDaySortOrders(spContext, updated.dayId, next, tripDays, setLocalEntries).catch((sortErr) => {
          // eslint-disable-next-line no-console
          console.error('updateEntry: sort order sync failed', sortErr);
        });
      }
      const svc = new ItineraryService(spContext);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip nested items before PATCH
      const { subItems: _subItems, ...entryWithoutSubItems } = updated;
      try {
        await svc.update(updated.id, entryWithoutSubItems);
        await syncEntryCancellationDeadlineReminder(spContext, updated);
        window.dispatchEvent(new Event('trip-reminders-updated'));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('updateEntry (update): SP persist or cancellation reminder sync failed', err);
        if (isLikelyNetworkError(err)) reportNetworkFailure(err);
        if (prevEntry) {
          const rolled = localEntriesRef.current.map((e) => (e.id === prevEntry.id ? prevEntry : e));
          localEntriesRef.current = rolled;
          setLocalEntries(rolled);
        }
        window.alert(
          isLikelyNetworkError(err)
            ? OFFLINE_WRITE_MESSAGE
            : err instanceof Error
              ? `Could not save itinerary item: ${err.message}`
              : 'Could not save itinerary item. Changes were reverted.'
        );
        throw err;
      }
    },
    [spContext, persistEntry, tripDays, warnIfOffline, reportNetworkFailure]
  );

  const deleteEntry = React.useCallback(
    (entryId: string) => {
      if (warnIfOffline('write')) return;
      const victim = localEntries.find((e) => e.id === entryId);
      const tripId = (victim?.tripId ?? '').trim();
      const childIds = localEntries.filter((e) => e.parentEntryId === entryId).map((e) => e.id);
      const reminderEntryIds = new Set<string>([entryId, ...childIds]);

      setEditingCardIdState((prev) => (prev === entryId ? null : prev));
      setEditingSubItemState((prev) => (prev?.parentEntryId === entryId ? null : prev));
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId && e.parentEntryId !== entryId));

      if (isPendingItineraryEntryId(entryId)) {
        return;
      }

      const entrySvc = new ItineraryService(spContext);
      const reminderSvc = new ReminderService(spContext);

      const run = async (): Promise<void> => {
        try {
          for (const cid of childIds) {
            try {
              await entrySvc.delete(cid);
            } catch (childErr) {
              // eslint-disable-next-line no-console
              console.warn('deleteEntry: child itinerary delete failed (may already be gone)', cid, childErr);
            }
          }
          await entrySvc.delete(entryId);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('deleteEntry: SP persist failed', err);
          return;
        }
        if (tripId && reminderEntryIds.size > 0) {
          try {
            await reminderSvc.deleteByEntryIds(tripId, reminderEntryIds);
          } catch (rerr) {
            // eslint-disable-next-line no-console
            console.error('deleteEntry: reminder cleanup failed', rerr);
          }
        }
        window.dispatchEvent(new Event('trip-reminders-updated'));
      };
      void run();
    },
    [spContext, localEntries, warnIfOffline]
  );

  const duplicateEntry = React.useCallback(
    (entryId: string) => {
      if (warnIfOffline('write')) return;
      const prev = localEntriesRef.current;
      const idx = prev.findIndex((e) => e.id === entryId);
      if (idx < 0) return;
      const orig = prev[idx];
      if (orig.parentEntryId) return;

      const copySortOrder = orig.sortOrder + 1;
      const bumped = prev.map((e) =>
        e.dayId === orig.dayId && !e.parentEntryId && e.sortOrder >= copySortOrder
          ? { ...e, sortOrder: e.sortOrder + 1 }
          : e
      );
      const tempId = newTempId();
      const copyTitle = orig.title?.trim() ? `${orig.title.trim()} (copy)` : 'Untitled (copy)';
      const copy: ItineraryEntry = {
        ...orig,
        id: tempId,
        title: copyTitle,
        sortOrder: copySortOrder,
        subItems: [],
        amountPaidConverted: undefined
      };
      const insertAt = bumped.findIndex((e) => e.id === entryId);
      const next = [...bumped];
      if (insertAt >= 0) {
        next.splice(insertAt + 1, 0, copy);
      } else {
        next.push(copy);
      }

      setLocalEntries(next);
      setFocusedEntryId(tempId);
      const fallbackOrder = bumped
        .filter((e) => e.dayId === orig.dayId && !e.parentEntryId)
        .map((e) => e.id);
      insertAfterInDayViewEntryOrder(orig.tripId, orig.dayId, entryId, tempId, fallbackOrder);

      const sortUpdates = bumped
        .filter(
          (e) =>
            e.dayId === orig.dayId &&
            !e.parentEntryId &&
            e.id !== entryId &&
            e.id !== tempId &&
            (e.sortOrder ?? 0) > (orig.sortOrder ?? 0)
        )
        .map((e) => ({ id: e.id, sortOrder: e.sortOrder }));

      void (async () => {
        try {
          const created = await persistEntry(copy);
          replaceIdInDayViewEntryOrder(orig.tripId, orig.dayId, tempId, created.id);
          setFocusedEntryId(created.id);
          window.dispatchEvent(
            new CustomEvent('trip-entry-duplicated', {
              detail: {
                sourceEntryId: entryId,
                sourceDayId: orig.dayId,
                targetEntryId: created.id,
                targetDayId: created.dayId,
                tripId: created.tripId
              }
            })
          );
          const svc = new ItineraryService(spContext);
          await runBatched(sortUpdates, 5, async ({ id, sortOrder }) => {
            await svc.update(id, { sortOrder });
          });
          await syncEntryCancellationDeadlineReminder(spContext, created);
          window.dispatchEvent(new Event('trip-reminders-updated'));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('duplicateEntry: SP persist failed', err);
          removeFromDayViewEntryOrder(orig.tripId, orig.dayId, tempId);
          setFocusedEntryId((focused) => (focused === tempId ? null : focused));
        }
      })();
    },
    [spContext, persistEntry, warnIfOffline]
  );

  const reorderEntries = React.useCallback(
    (dayId: string, orderedIds: string[]) => {
      setLocalEntries((prev) => {
        const orderIndex = new Map<string, number>();
        orderedIds.forEach((id, index) => orderIndex.set(id, index));
        return prev.map((entry) => {
          if (entry.dayId !== dayId) return entry;
          const nextOrder = orderIndex.get(entry.id);
          if (nextOrder === undefined) return entry;
          return { ...entry, sortOrder: nextOrder };
        });
      });
      const svc = new ItineraryService(spContext);
      const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
      svc.updateSortOrders(updates).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('reorderEntries: SP persist failed', err);
      });
    },
    [spContext]
  );

  const moveEntryToDay = React.useCallback(
    (entryId: string, targetDayId: string) => {
      const moving = localEntries.find((e) => e.id === entryId);
      if (!moving || moving.dayId === targetDayId) {
        return;
      }
      const targetDay = tripDays.find((d) => d.id === targetDayId);
      const targetMaxSort = localEntries
        .filter((e) => e.dayId === targetDayId && !e.parentEntryId)
        .reduce((max, e) => Math.max(max, e.sortOrder), -1);
      const nextSort = targetMaxSort + 1;
      const transportDateStart =
        moving.category === 'Transport' && targetDay?.calendarDate
          ? ymdSlice(targetDay.calendarDate)
          : undefined;

      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                dayId: targetDayId,
                sortOrder: nextSort,
                ...(transportDateStart ? { dateStart: transportDateStart } : {})
              }
            : entry
        )
      );

      const svc = new ItineraryService(spContext);
      const extra: Partial<ItineraryEntry> = transportDateStart ? { dateStart: transportDateStart } : {};
      svc.moveToDay(entryId, targetDayId, nextSort, extra).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('moveEntryToDay: SP persist failed', err);
      });
    },
    [spContext, localEntries, tripDays]
  );

  const syncTripCalendarDaysForRange = React.useCallback(
    async (dateStart: string, dateEnd: string): Promise<TripDay[]> => {
      if (!trip?.id) return [];
      const daySvc = new DayService(spContext);
      const created = await daySvc.appendMissingCalendarDays(trip.id, dateStart, dateEnd, tripDays);
      await daySvc.ensurePreTripAnchorForStart(trip.id, dateStart, tripDays);

      let nextDays = [...tripDays, ...created];
      const pre = nextDays.find((d) => d.tripId === trip.id && isPreTripDayRow(d));
      if (pre) {
        const anchor = calendarDayBefore(dateStart);
        if (anchor && ymdSlice(pre.calendarDate) !== anchor) {
          nextDays = nextDays.map((d) => (d.id === pre.id ? { ...d, calendarDate: anchor } : d));
        }
      }

      nextDays = await daySvc.renumberDaysChronologically(trip.id, nextDays);
      nextDays = await repairPreTripCalendarIfCollidingWithFirstDay(daySvc, trip, nextDays);
      setTripDays(nextDays);
      return created;
    },
    [spContext, trip, tripDays]
  );

  const moveAllItineraryEntriesBetweenDays = React.useCallback(
    async (fromDayId: string, toDayId: string): Promise<void> => {
      if (!fromDayId || !toDayId || fromDayId === toDayId) return;
      const toMove = localEntries.filter((e) => e.dayId === fromDayId && !e.parentEntryId);
      if (!toMove.length) return;

      const svc = new ItineraryService(spContext);
      let sortCursor = localEntries
        .filter((e) => e.dayId === toDayId && !e.parentEntryId)
        .reduce((max, e) => Math.max(max, e.sortOrder), -1);

      const updates: Array<{ id: string; sortOrder: number }> = [];
      for (const entry of toMove) {
        sortCursor += 1;
        updates.push({ id: entry.id, sortOrder: sortCursor });
      }

      setLocalEntries((prev) =>
        prev.map((entry) => {
          const hit = updates.find((u) => u.id === entry.id);
          if (!hit) return entry;
          return { ...entry, dayId: toDayId, sortOrder: hit.sortOrder };
        })
      );

      await runBatched(updates, 5, async ({ id, sortOrder }) => {
        await svc.moveToDay(id, toDayId, sortOrder);
      });
    },
    [localEntries, spContext]
  );

  const persistSubItem = React.useCallback(
    async (entryId: string, subItem: ItinerarySubItem): Promise<ItinerarySubItem> => {
      if (warnIfOffline('write')) return subItem;
      if (!isPendingSubItemId(subItem.id)) {
        return subItem;
      }

      const inflight = pendingSubItemCreatesRef.current.get(subItem.id);
      if (inflight) {
        return inflight;
      }

      const promise = (async (): Promise<ItinerarySubItem> => {
        let parent = localEntriesRef.current.find((e) => e.id === entryId);
        if (!parent) {
          throw new Error('persistSubItem: parent entry not found');
        }
        if (isPendingItineraryEntryId(parent.id)) {
          parent = await persistEntry(parent);
        }
        const parentId = parent.id;
        const latestParent = localEntriesRef.current.find((e) => e.id === parentId) ?? parent;
        const existingSub = latestParent.subItems?.find((s) => s.id === subItem.id);
        const currentSub = existingSub ? { ...existingSub, ...subItem } : subItem;
        if (!isPendingSubItemId(currentSub.id)) {
          pendingSubItemCreatesRef.current.delete(subItem.id);
          return currentSub;
        }

        try {
          const svc = new ItineraryService(spContext);
          const { id: _id, ...payload } = currentSub;
          const created = await svc.createSubItem(latestParent, payload);
          const merged = { ...created, ...currentSub, id: created.id };
          setLocalEntries((prev) =>
            prev.map((entry) =>
              entry.id === parentId
                ? { ...entry, subItems: entry.subItems?.map((s) => (s.id === subItem.id ? merged : s)) }
                : entry
            )
          );
          setEditingSubItemState((prev) =>
            prev?.subItemId === subItem.id ? { parentEntryId: parentId, subItemId: merged.id } : prev
          );
          pendingSubItemCreatesRef.current.delete(subItem.id);
          return merged;
        } catch (err) {
          pendingSubItemCreatesRef.current.delete(subItem.id);
          setLocalEntries((prev) =>
            prev.map((entry) =>
              entry.id === parentId ? { ...entry, subItems: entry.subItems?.filter((s) => s.id !== subItem.id) } : entry
            )
          );
          throw err;
        }
      })();

      pendingSubItemCreatesRef.current.set(subItem.id, promise);
      return promise;
    },
    [spContext, persistEntry, warnIfOffline]
  );

  const updateSubItem = React.useCallback(
    (entryId: string, updatedSubItem: ItinerarySubItem) => {
      void (async () => {
        const sub = await (async (): Promise<ItinerarySubItem | null> => {
          if (isPendingSubItemId(updatedSubItem.id)) {
            try {
              return await persistSubItem(entryId, updatedSubItem);
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('updateSubItem: persist failed', err);
              return null;
            }
          }
          return updatedSubItem;
        })();
        if (!sub) return;
        const merged = { ...sub, ...updatedSubItem, id: sub.id };
        let slot = merged;
        setLocalEntries((prev) =>
          prev.map((entry) => {
            if (entry.id !== entryId) return entry;
            const subs = entry.subItems ?? [];
            const prior = subs.find((s) => s.id === merged.id);
            const timeChanged = (prior?.startTime || '') !== (merged.startTime || '');
            const nextSubs = timeChanged
              ? insertSubItemByTime(subs, merged)
              : subs.map((s) => (s.id === merged.id ? merged : s));
            slot = nextSubs.find((s) => s.id === merged.id) ?? merged;
            return { ...entry, subItems: nextSubs };
          })
        );
        const svc = new ItineraryService(spContext);
        svc
          .update(slot.id, {
            title: slot.title,
            category: slot.category,
            dateStart: slot.optionDate,
            timeStart: slot.startTime,
            arrivalTime: slot.endTime,
            duration: slot.duration,
            supplier: (slot.supplier ?? '').trim(),
            decisionStatus: slot.decisionStatus,
            paymentStatus: slot.paymentStatus,
            amount: slot.amount,
            amountPaid: slot.amountPaid,
            currency: slot.currency,
            costCertainty: slot.costCertainty,
            notes: slot.notes,
            location: slot.location,
            streetAddress: slot.streetAddress,
            bookingRequired: slot.bookingRequired === true,
            sortOrder: slot.sortOrder,
            cancellationPolicy: slot.cancellationPolicy
          } as Partial<ItineraryEntry>)
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('updateSubItem: SP persist failed', err);
          });
      })();
    },
    [spContext, persistSubItem]
  );

  const addSubItem = React.useCallback(
    (entryId: string, subItem: Omit<ItinerarySubItem, 'id'> & { id?: string }): string => {
      const tempId = subItem.id && isPendingSubItemId(subItem.id) ? subItem.id : newTempId();
      setLocalEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          const subs = entry.subItems ?? [];
          const subItemWithTempId: ItinerarySubItem = { ...subItem, id: tempId, sortOrder: subs.length };
          return { ...entry, subItems: insertSubItemByTime(subs, subItemWithTempId) };
        })
      );
      return tempId;
    },
    []
  );

  const deleteSubItem = React.useCallback(
    (entryId: string, subItemId: string) => {
      const parent = localEntries.find((e) => e.id === entryId);
      const tripId = (parent?.tripId ?? '').trim();

      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, subItems: entry.subItems?.filter((s) => s.id !== subItemId) } : entry
        )
      );
      setEditingSubItemState((prev) =>
        prev?.parentEntryId === entryId && prev.subItemId === subItemId ? null : prev
      );
      const svc = new ItineraryService(spContext);
      const reminderSvc = new ReminderService(spContext);
      svc
        .delete(subItemId)
        .then(() => (tripId ? reminderSvc.deleteByEntryIds(tripId, new Set([subItemId])) : Promise.resolve()))
        .then(() => {
          window.dispatchEvent(new Event('trip-reminders-updated'));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('deleteSubItem: SP persist or reminder cleanup failed', err);
        });
    },
    [spContext, localEntries]
  );

  const reorderSubItems = React.useCallback(
    (entryId: string, orderedSubItemIds: string[]) => {
      setLocalEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId || !entry.subItems?.length) return entry;
          const byId = new Map(entry.subItems.map((s) => [s.id, s]));
          const reordered = orderedSubItemIds
            .map((id, index) => {
              const sub = byId.get(id);
              return sub ? { ...sub, sortOrder: index } : null;
            })
            .filter(Boolean) as ItinerarySubItem[];
          const used = new Set(reordered.map((s) => s.id));
          for (const sub of entry.subItems) {
            if (!used.has(sub.id)) {
              reordered.push({ ...sub, sortOrder: reordered.length });
            }
          }
          return { ...entry, subItems: reordered };
        })
      );
      const svc = new ItineraryService(spContext);
      orderedSubItemIds.forEach((id, index) => {
        svc.update(id, { sortOrder: index } as Partial<ItineraryEntry>).catch(console.error);
      });
    },
    [spContext]
  );

  const duplicateSubItem = React.useCallback(
    (entryId: string, subItemId: string) => {
      const parent = localEntriesRef.current.find((e) => e.id === entryId);
      const orig = parent?.subItems?.find((s) => s.id === subItemId);
      if (!parent || !orig) return;
      const tempId = newTempId();
      const copy: ItinerarySubItem = {
        ...orig,
        id: tempId,
        title: orig.title?.trim() ? `${orig.title.trim()} (copy)` : 'Untitled (copy)',
        sortOrder: (orig.sortOrder ?? 0) + 1
      };
      setLocalEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          const subs = [...(entry.subItems ?? [])];
          const idx = subs.findIndex((s) => s.id === subItemId);
          if (idx < 0) return entry;
          subs.splice(idx + 1, 0, copy);
          return {
            ...entry,
            subItems: subs.map((s, i) => ({ ...s, sortOrder: i }))
          };
        })
      );
      setEditingSubItem({ parentEntryId: entryId, subItemId: tempId });
      void persistSubItem(entryId, copy).catch(console.error);
    },
    [persistSubItem]
  );

  const moveSubItem = React.useCallback(
    (fromEntryId: string, subItemId: string, toEntryId: string) => {
      if (fromEntryId === toEntryId) return;
      const fromParent = localEntriesRef.current.find((e) => e.id === fromEntryId);
      const toParent = localEntriesRef.current.find((e) => e.id === toEntryId);
      const sub = fromParent?.subItems?.find((s) => s.id === subItemId);
      if (!fromParent || !toParent || !sub) return;

      const nextSort =
        (toParent.subItems ?? []).reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1) + 1;
      const moved = { ...sub, sortOrder: nextSort };

      setLocalEntries((prev) =>
        prev.map((entry) => {
          if (entry.id === fromEntryId) {
            return { ...entry, subItems: entry.subItems?.filter((s) => s.id !== subItemId) };
          }
          if (entry.id === toEntryId) {
            return { ...entry, subItems: [...(entry.subItems ?? []), moved] };
          }
          return entry;
        })
      );
      setEditingSubItemState((prev) =>
        prev?.subItemId === subItemId ? { parentEntryId: toEntryId, subItemId } : prev
      );

      const svc = new ItineraryService(spContext);
      svc
        .update(subItemId, {
          parentEntryId: toEntryId,
          dayId: toParent.dayId,
          sortOrder: nextSort
        } as Partial<ItineraryEntry>)
        .catch(console.error);
    },
    [spContext]
  );

  const convertToHomeCurrency = React.useCallback((amount: number, currency: string): number => {
    const source = (currency || 'NZD').toUpperCase();
    const target = (config.homeCurrency || 'NZD').toUpperCase();
    if (source === target) return amount;
    if (source === 'NZD') {
      const targetRate = fxRates.get(target);
      return targetRate && targetRate !== 0 ? amount * targetRate : amount;
    }
    const sourceRate = fxRates.get(source);
    if (!sourceRate || sourceRate === 0) return amount;
    const nzdAmount = amount / sourceRate;
    if (target === 'NZD') return nzdAmount;
    const targetRate = fxRates.get(target);
    if (!targetRate || targetRate === 0) return amount;
    return nzdAmount * targetRate;
  }, [config.homeCurrency, fxRates]);

  const value = React.useMemo(
    (): TripWorkspaceContextValue => ({
      trip,
      tripDays,
      selectedDayId,
      setSelectedDayId,
      editingCardId,
      setEditingCardId,
      editingSubItem,
      setEditingSubItem,
      focusedEntryId,
      setFocusedEntryId,
      localEntries,
      loading,
      error,
      deletingTrip,
      deleteTripError,
      retryLoad: () => {
        loadData().catch(console.error);
      },
      updateTrip,
      deleteTrip,
      clearDeleteTripError,
      updateDay,
      reloadItineraryEntries,
      updateEntry,
      stageDraftEntry,
      persistEntry,
      deleteEntry,
      duplicateEntry,
      reorderEntries,
      moveEntryToDay,
      syncTripCalendarDaysForRange,
      moveAllItineraryEntriesBetweenDays,
      updateSubItem,
      persistSubItem,
      addSubItem,
      deleteSubItem,
      duplicateSubItem,
      reorderSubItems,
      moveSubItem,
      convertToHomeCurrency,
      mainWorkspaceTab,
      setMainWorkspaceTab,
      selectedBudgetCategory,
      setSelectedBudgetCategory,
      sharedPreview,
      setSharedPreview,
      workspaceReturn,
      setWorkspaceReturn,
      usedSuppliers: (() => {
        const names = new Set<string>();
        for (const e of localEntries) {
          const main = (e.supplier || '').trim();
          if (main) names.add(main);
          const operating = (e.operatingAirline || '').trim();
          if (operating) names.add(operating);
          for (const sub of e.subItems ?? []) {
            const subSup = (sub.supplier || '').trim();
            if (subSup) names.add(subSup);
          }
        }
        return Array.from(names).sort();
      })(),
      usedLocations: Array.from(new Set(localEntries.map((e) => (e.location || '').trim()).filter(Boolean))).sort(),
      usedCurrencies: (() => {
        const codes = new Set<string>();
        for (const e of localEntries) {
          const cur = (e.currency || '').trim().toUpperCase();
          if (cur) codes.add(cur);
          for (const s of e.subItems ?? []) {
            const sc = (s.currency || '').trim().toUpperCase();
            if (sc) codes.add(sc);
          }
        }
        return Array.from(codes).sort();
      })(),
      usedBookingMechanisms: Array.from(
        new Set([
          ...loadTripBookingMechanisms(tripId),
          ...localEntries.map((e) => (e.bookingMechanism || '').trim()).filter(Boolean)
        ])
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }),
    [
      trip,
      tripDays,
      selectedDayId,
      editingCardId,
      editingSubItem,
      focusedEntryId,
      localEntries,
      loading,
      error,
      deletingTrip,
      deleteTripError,
      loadData,
      updateTrip,
      deleteTrip,
      clearDeleteTripError,
      updateDay,
      reloadItineraryEntries,
      updateEntry,
      stageDraftEntry,
      persistEntry,
      deleteEntry,
      duplicateEntry,
      reorderEntries,
      moveEntryToDay,
      syncTripCalendarDaysForRange,
      moveAllItineraryEntriesBetweenDays,
      updateSubItem,
      persistSubItem,
      addSubItem,
      deleteSubItem,
      duplicateSubItem,
      reorderSubItems,
      moveSubItem,
      convertToHomeCurrency,
      mainWorkspaceTab,
      selectedBudgetCategory,
      sharedPreview,
      workspaceReturn
    ]
  );

  return <TripWorkspaceContext.Provider value={value}>{children}</TripWorkspaceContext.Provider>;
}

export function useTripWorkspace(): TripWorkspaceContextValue {
  const ctx = React.useContext(TripWorkspaceContext);
  if (ctx === undefined) {
    throw new Error('useTripWorkspace must be used within TripWorkspaceProvider');
  }
  return ctx;
}
