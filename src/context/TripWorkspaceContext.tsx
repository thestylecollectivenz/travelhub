import * as React from 'react';
import type { ItineraryEntry } from '../models/ItineraryEntry';
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
      duplicateEntry
    }),
    [selectedDayId, editingCardId, localEntries, updateEntry, deleteEntry, duplicateEntry]
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
