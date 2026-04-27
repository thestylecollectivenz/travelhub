import * as React from 'react';
import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import { TripService } from '../services/TripService';
import { DayService } from '../services/DayService';
import { ItineraryService } from '../services/ItineraryService';
import { FxService } from '../services/FxService';
import { useSpContext } from './SpContext';
import { minutesFromTimeStart } from '../utils/itineraryTimeUtils';
import { useConfig } from './ConfigContext';

export type MainWorkspaceTab = 'itinerary' | 'journal' | 'photos' | 'files' | 'map' | 'plan';

function newTempId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TripWorkspaceContextValue {
  trip: Trip | null;
  tripDays: TripDay[];
  selectedDayId: string;
  setSelectedDayId: (id: string) => void;
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;
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
  updateEntry: (updated: ItineraryEntry) => void;
  deleteEntry: (entryId: string) => void;
  duplicateEntry: (entryId: string) => void;
  reorderEntries: (dayId: string, orderedIds: string[]) => void;
  moveEntryToDay: (entryId: string, targetDayId: string) => void;
  updateSubItem: (entryId: string, updatedSubItem: ItinerarySubItem) => void;
  addSubItem: (entryId: string, subItem: ItinerarySubItem) => void;
  deleteSubItem: (entryId: string, subItemId: string) => void;
  convertToHomeCurrency: (amount: number, currency: string) => number;
  mainWorkspaceTab: MainWorkspaceTab;
  setMainWorkspaceTab: (tab: MainWorkspaceTab) => void;
  sharedPreview: boolean;
  setSharedPreview: (value: boolean) => void;
  usedSuppliers: string[];
  usedLocations: string[];
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

export function TripWorkspaceProvider({ tripId, onBack, children }: ITripWorkspaceProviderProps): React.ReactElement {
  const spContext = useSpContext();
  const { config } = useConfig();

  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [tripDays, setTripDays] = React.useState<TripDay[]>([]);
  const [localEntries, setLocalEntries] = React.useState<ItineraryEntry[]>([]);
  const [selectedDayId, setSelectedDayId] = React.useState<string>('');
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [mainWorkspaceTab, setMainWorkspaceTab] = React.useState<MainWorkspaceTab>('itinerary');
  const [sharedPreview, setSharedPreview] = React.useState(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = React.useState<boolean>(false);
  const [deleteTripError, setDeleteTripError] = React.useState<string | null>(null);
  const [fxRates, setFxRates] = React.useState<Map<string, number>>(new Map());
  const onBackRef = React.useRef(onBack);

  React.useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

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

      setTrip(loadedTrip);
      setTripDays(loadedDays);
      setLocalEntries(loadedEntries);
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
      if (loadedDays.length > 0) {
        setSelectedDayId(loadedDays[0].id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripWorkspaceProvider.loadData', err);
      setError('Could not load trip data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [tripId, spContext]);

  React.useEffect(() => {
    loadData().catch(console.error);
  }, [loadData]);

  const updateTrip = React.useCallback(
    (partial: Partial<Trip>) => {
      setTrip((prev) => (prev ? { ...prev, ...partial } : prev));
      const currentTripId = trip?.id;
      if (!currentTripId) return;
      const svc = new TripService(spContext);
      svc.update(currentTripId, partial).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('updateTrip: SP persist failed', err);
      });
    },
    [spContext, trip?.id]
  );

  const clearDeleteTripError = React.useCallback(() => {
    setDeleteTripError(null);
  }, []);

  const deleteTrip = React.useCallback(async (): Promise<void> => {
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
  }, [deletingTrip, spContext, tripId]);

  const updateDay = React.useCallback(
    (dayId: string, partial: Partial<TripDay>) => {
      setTripDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...partial } : d)));
      const svc = new DayService(spContext);
      svc.update(dayId, partial).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('updateDay: SP persist failed', err);
      });
    },
    [spContext]
  );

  const updateEntry = React.useCallback((updated: ItineraryEntry) => {
    const isNew = updated.id.startsWith('new-') || updated.id.startsWith('temp-');

    if (isNew) {
      // Optimistically add with temp ID
      const tempId = updated.id;
      setLocalEntries((prev) => {
        const exists = prev.findIndex((e) => e.id === tempId);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = updated;
          return next;
        }
        // Insert in chronological order within the day if time is set
        if (!updated.timeStart) {
          return [...prev, updated];
        }
        const updatedMinutes = minutesFromTimeStart(updated.timeStart) ?? Infinity;
        const dayEntries = prev.filter((e) => e.dayId === updated.dayId && !e.parentEntryId);
        const lastBefore = dayEntries.reduce<number>((lastIdx, e, i) => {
          const eMinutes = minutesFromTimeStart(e.timeStart) ?? Infinity;
          if (eMinutes <= updatedMinutes) return i;
          return lastIdx;
        }, -1);
        const insertAt =
          lastBefore >= 0
            ? prev.indexOf(dayEntries[lastBefore]) + 1
            : Math.max(0, prev.findIndex((e) => e.dayId === updated.dayId));
        const next = [...prev];
        next.splice(insertAt, 0, updated);
        return next;
      });
      // Create in SP and replace temp ID with real SP ID
      const svc = new ItineraryService(spContext);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, subItems: _sub, ...createPayload } = updated;
      svc
        .create(createPayload)
        .then((created) => {
          setLocalEntries((prev) =>
            prev.map((e) => (e.id === tempId ? { ...created, subItems: e.subItems ?? [] } : e))
          );
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('updateEntry (create): SP persist failed', err);
          // Roll back - remove the temp entry
          setLocalEntries((prev) => prev.filter((e) => e.id !== tempId));
        });
    } else {
      // Existing entry - optimistic update then PATCH
      setLocalEntries((prev) => {
        const i = prev.findIndex((e) => e.id === updated.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = updated;
          return next;
        }
        return [...prev, updated];
      });
      const svc = new ItineraryService(spContext);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip nested items before PATCH
      const { subItems: _subItems, ...entryWithoutSubItems } = updated;
      svc.update(updated.id, entryWithoutSubItems).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('updateEntry (update): SP persist failed', err);
      });
    }
  }, [spContext]);

  const deleteEntry = React.useCallback(
    (entryId: string) => {
      setEditingCardId((prev) => (prev === entryId ? null : prev));
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId && e.parentEntryId !== entryId));
      const svc = new ItineraryService(spContext);
      svc.delete(entryId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('deleteEntry: SP persist failed', err);
      });
    },
    [spContext]
  );

  const duplicateEntry = React.useCallback(
    (entryId: string) => {
      setLocalEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === entryId);
        if (idx < 0) return prev;
        const orig = prev[idx];
        const daySiblings = prev.filter((e) => e.dayId === orig.dayId && !e.parentEntryId);
        const maxSort = daySiblings.reduce((acc, e) => Math.max(acc, e.sortOrder), 0);
        const tempId = newTempId();
        const copy: ItineraryEntry = { ...orig, id: tempId, sortOrder: maxSort + 1, subItems: [] };
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        // Persist to SP and replace temp ID with real ID
        const svc = new ItineraryService(spContext);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _omitId, subItems: _omitSub, ...createPayload } = copy;
        svc
          .create({ ...createPayload, sortOrder: maxSort + 1 })
          .then((created) => {
            setLocalEntries((current) => current.map((e) => (e.id === tempId ? { ...e, id: created.id } : e)));
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('duplicateEntry: SP persist failed', err);
            setLocalEntries((current) => current.filter((e) => e.id !== tempId));
          });
        return next;
      });
    },
    [spContext]
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
      setLocalEntries((prev) => {
        const moving = prev.find((e) => e.id === entryId);
        if (!moving || moving.dayId === targetDayId) return prev;
        const targetMaxSort = prev
          .filter((e) => e.dayId === targetDayId && !e.parentEntryId)
          .reduce((max, e) => Math.max(max, e.sortOrder), -1);
        return prev.map((entry) => {
          if (entry.id !== entryId) return entry;
          return { ...entry, dayId: targetDayId, sortOrder: targetMaxSort + 1 };
        });
      });
      const svc = new ItineraryService(spContext);
      svc.moveToDay(entryId, targetDayId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('moveEntryToDay: SP persist failed', err);
      });
    },
    [spContext]
  );

  const updateSubItem = React.useCallback(
    (entryId: string, updatedSubItem: ItinerarySubItem) => {
      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? { ...entry, subItems: entry.subItems?.map((s) => (s.id === updatedSubItem.id ? updatedSubItem : s)) }
            : entry
        )
      );
      // Sub-items are ItineraryEntries in SP — update via ItineraryService
      const svc = new ItineraryService(spContext);
      svc
        .update(updatedSubItem.id, {
          title: updatedSubItem.title,
          decisionStatus: updatedSubItem.decisionStatus,
          paymentStatus: updatedSubItem.paymentStatus,
          amount: updatedSubItem.amount,
          amountPaid: updatedSubItem.amountPaid,
          currency: updatedSubItem.currency,
          notes: updatedSubItem.notes
        } as Partial<ItineraryEntry>)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('updateSubItem: SP persist failed', err);
        });
    },
    [spContext]
  );

  const addSubItem = React.useCallback(
    (entryId: string, subItem: ItinerarySubItem) => {
      const tempId = newTempId();
      const subItemWithTempId = { ...subItem, id: tempId };
      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, subItems: [...(entry.subItems ?? []), subItemWithTempId] } : entry
        )
      );
      // Persist to SP
      const parentEntry = localEntries.find((e) => e.id === entryId);
      if (!parentEntry) return;
      const svc = new ItineraryService(spContext);
      svc
        .createSubItem(parentEntry, subItem)
        .then((created) => {
          setLocalEntries((prev) =>
            prev.map((entry) =>
              entry.id === entryId
                ? { ...entry, subItems: entry.subItems?.map((s) => (s.id === tempId ? { ...s, id: created.id } : s)) }
                : entry
            )
          );
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('addSubItem: SP persist failed', err);
          setLocalEntries((prev) =>
            prev.map((entry) =>
              entry.id === entryId ? { ...entry, subItems: entry.subItems?.filter((s) => s.id !== tempId) } : entry
            )
          );
        });
    },
    [spContext, localEntries]
  );

  const deleteSubItem = React.useCallback(
    (entryId: string, subItemId: string) => {
      setLocalEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, subItems: entry.subItems?.filter((s) => s.id !== subItemId) } : entry
        )
      );
      const svc = new ItineraryService(spContext);
      svc.delete(subItemId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('deleteSubItem: SP persist failed', err);
      });
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
      updateEntry,
      deleteEntry,
      duplicateEntry,
      reorderEntries,
      moveEntryToDay,
      updateSubItem,
      addSubItem,
      deleteSubItem,
      convertToHomeCurrency,
      mainWorkspaceTab,
      setMainWorkspaceTab,
      sharedPreview,
      setSharedPreview,
      usedSuppliers: Array.from(new Set(localEntries.map((e) => (e.supplier || '').trim()).filter(Boolean))).sort(),
      usedLocations: Array.from(new Set(localEntries.map((e) => (e.location || '').trim()).filter(Boolean))).sort()
    }),
    [
      trip,
      tripDays,
      selectedDayId,
      editingCardId,
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
      updateEntry,
      deleteEntry,
      duplicateEntry,
      reorderEntries,
      moveEntryToDay,
      updateSubItem,
      addSubItem,
      deleteSubItem,
      convertToHomeCurrency,
      mainWorkspaceTab,
      sharedPreview
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
