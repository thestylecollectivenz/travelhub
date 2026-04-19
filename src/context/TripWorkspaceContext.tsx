import * as React from 'react';
import type { Trip } from '../models/Trip';
import { MOCK_TRIP, MOCK_TRIP_DAYS } from '../mocks/tripMock';

export interface TripWorkspaceContextValue {
  trip: Trip;
  selectedDayId: string;
  setSelectedDayId: (id: string) => void;
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;
}

const TripWorkspaceContext = React.createContext<TripWorkspaceContextValue | undefined>(undefined);

export function TripWorkspaceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [selectedDayId, setSelectedDayId] = React.useState<string>(MOCK_TRIP_DAYS[0].id);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);

  const value = React.useMemo(
    (): TripWorkspaceContextValue => ({
      trip: MOCK_TRIP,
      selectedDayId,
      setSelectedDayId,
      editingCardId,
      setEditingCardId
    }),
    [selectedDayId, editingCardId]
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
