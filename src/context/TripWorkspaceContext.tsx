import * as React from 'react';
import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import { MOCK_ITINERARY_ENTRIES, MOCK_TRIP, MOCK_TRIP_DAYS } from '../mocks/tripMock';

function newEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TripWorkspaceContextValue {
  trip: Trip;
  selectedDayId: string;
  setSelectedDayId: (id: string) => void;
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;
  localEntries: ItineraryEntry[];
  updateEntry: (updated: ItineraryEntry) => void;
  deleteEntry: (entryId: string) => void;
  duplicateEntry: (entryId: string) => void;
  reorderEntries: (dayId: string, orderedIds: string[]) => void;
  moveEntryToDay: (entryId: string, targetDayId: string) => void;
  updateSubItem: (entryId: string, updatedSubItem: ItinerarySubItem) => void;
}

const TripWorkspaceContext = React.createContext<TripWorkspaceContextValue | undefined>(undefined);

export function TripWorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [selectedDayId, setSelectedDayId] = React.useState<string>(MOCK_TRIP_DAYS[0].id);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [localEntries, setLocalEntries] = React.useState<ItineraryEntry[]>(() => [...MOCK_ITINERARY_ENTRIES]);

  const updateEntry = React.useCallback((updated: ItineraryEntry) => {
    setLocalEntries((prev) => {
      const i = prev.findIndex((e) => e.id === updated.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }, []);

  const deleteEntry = React.useCallback((entryId: string) => {
    setEditingCardId((prev) => (prev === entryId ? null : prev));
    setLocalEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  const duplicateEntry = React.useCallback((entryId: string) => {
    setLocalEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entryId);
      if (idx < 0) {
        return prev;
      }
      const orig = prev[idx];
      const daySiblings = prev.filter((e) => e.dayId === orig.dayId);
      const maxSort = daySiblings.reduce((acc, e) => Math.max(acc, e.sortOrder), 0);
      const copy: ItineraryEntry = {
        ...orig,
        id: newEntryId(),
        sortOrder: maxSort + 1
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const reorderEntries = React.useCallback((dayId: string, orderedIds: string[]) => {
    setLocalEntries((prev) => {
      const orderIndex = new Map<string, number>();
      orderedIds.forEach((id, index) => {
        orderIndex.set(id, index);
      });
      return prev.map((entry) => {
        if (entry.dayId !== dayId) {
          return entry;
        }
        const nextOrder = orderIndex.get(entry.id);
        if (nextOrder === undefined) {
          return entry;
        }
        return {
          ...entry,
          sortOrder: nextOrder
        };
      });
    });
  }, []);

  const moveEntryToDay = React.useCallback((entryId: string, targetDayId: string) => {
    setLocalEntries((prev) => {
      const moving = prev.find((e) => e.id === entryId);
      if (!moving || moving.dayId === targetDayId) {
        return prev;
      }
      const targetMaxSort = prev
        .filter((e) => e.dayId === targetDayId)
        .reduce((max, entry) => Math.max(max, entry.sortOrder), -1);
      return prev.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }
        return {
          ...entry,
          dayId: targetDayId,
          sortOrder: targetMaxSort + 1
        };
      });
    });
  }, []);

  const updateSubItem = React.useCallback((entryId: string, updatedSubItem: ItinerarySubItem) => {
    setLocalEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              subItems: entry.subItems?.map((subItem) => (subItem.id === updatedSubItem.id ? updatedSubItem : subItem))
            }
          : entry
      )
    );
  }, []);

  const value = React.useMemo(
    (): TripWorkspaceContextValue => ({
      trip: MOCK_TRIP,
      selectedDayId,
      setSelectedDayId,
      editingCardId,
      setEditingCardId,
      localEntries,
      updateEntry,
      deleteEntry,
      duplicateEntry,
      reorderEntries,
      moveEntryToDay,
      updateSubItem
    }),
    [selectedDayId, editingCardId, localEntries, updateEntry, deleteEntry, duplicateEntry, reorderEntries, moveEntryToDay, updateSubItem]
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
