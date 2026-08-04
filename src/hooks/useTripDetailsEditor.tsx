import * as React from 'react';
import type { Trip } from '../models/Trip';
import { useTripWorkspace } from '../context/TripWorkspaceContext';
import { useJournal } from '../context/JournalContext';
import {
  analyzeTripDateRangeChange,
  resolveReassignmentTargets,
  ymdSlice,
  type TripDateRangeChangePlan
} from '../utils/tripDateRangeSync';
import { EditTripPanel } from '../components/workspace/EditTripPanel';
import { TripDateRangeReassignDialog } from '../components/workspace/TripDateRangeReassignDialog';

/**
 * Shared edit-trip details flow (desktop + mobile): panel, save, and date-range reassignment.
 */
export function useTripDetailsEditor(): {
  editOpen: boolean;
  openEdit: () => void;
  closeEdit: () => void;
  tripDetailsEditor: React.ReactNode;
} {
  const {
    trip,
    tripDays,
    localEntries,
    updateTrip,
    syncTripCalendarDaysForRange,
    moveAllItineraryEntriesBetweenDays
  } = useTripWorkspace();
  const { allEntries: journalEntries, allTripPhotos, reassignDayContent } = useJournal();

  const [editOpen, setEditOpen] = React.useState(false);
  const [dateReassignState, setDateReassignState] = React.useState<{
    partial: Partial<Trip>;
    plan: TripDateRangeChangePlan;
  } | null>(null);
  const [dateReassignMappings, setDateReassignMappings] = React.useState<Record<string, string>>({});
  const [dateReassignBusy, setDateReassignBusy] = React.useState(false);

  const applyTripDateRangeChange = React.useCallback(
    async (partial: Partial<Trip>, reassignments?: Record<string, string>): Promise<void> => {
      if (!trip || !partial.dateStart || !partial.dateEnd) return;
      const newStart = ymdSlice(partial.dateStart);
      const newEnd = ymdSlice(partial.dateEnd);

      const created = await syncTripCalendarDaysForRange(newStart, newEnd);
      const createdByDate = new Map(created.map((d) => [ymdSlice(d.calendarDate), d]));
      const resolved = reassignments ? resolveReassignmentTargets(reassignments, createdByDate) : {};

      for (const fromDayId of Object.keys(resolved)) {
        const toDayId = resolved[fromDayId];
        if (!toDayId) continue;
        // eslint-disable-next-line no-await-in-loop
        await moveAllItineraryEntriesBetweenDays(fromDayId, toDayId);
        // eslint-disable-next-line no-await-in-loop
        await reassignDayContent(fromDayId, toDayId);
      }

      updateTrip({
        ...partial,
        dateStart: newStart,
        dateEnd: newEnd
      });
    },
    [trip, syncTripCalendarDaysForRange, moveAllItineraryEntriesBetweenDays, reassignDayContent, updateTrip]
  );

  const handleTripDetailsSave = React.useCallback(
    async (partial: Partial<Trip>): Promise<boolean | void> => {
      if (!trip) return;
      const datesChanged =
        Boolean(partial.dateStart && partial.dateEnd) &&
        (ymdSlice(partial.dateStart) !== ymdSlice(trip.dateStart) ||
          ymdSlice(partial.dateEnd) !== ymdSlice(trip.dateEnd));

      if (!datesChanged) {
        updateTrip(partial);
        return;
      }

      const plan = analyzeTripDateRangeChange({
        newStart: partial.dateStart!,
        newEnd: partial.dateEnd!,
        tripDays,
        itinerary: localEntries,
        journalEntries,
        journalPhotos: allTripPhotos
      });

      if (plan.requiresReassignment) {
        setDateReassignMappings({});
        setDateReassignState({ partial, plan });
        return false;
      }

      await applyTripDateRangeChange(partial);
    },
    [trip, tripDays, localEntries, journalEntries, allTripPhotos, updateTrip, applyTripDateRangeChange]
  );

  const tripDetailsEditor = (
    <>
      {trip ? (
        <EditTripPanel
          trip={trip}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={handleTripDetailsSave}
        />
      ) : null}
      {dateReassignState && trip ? (
        <TripDateRangeReassignDialog
          trip={trip}
          plan={dateReassignState.plan}
          tripDays={tripDays}
          mappings={dateReassignMappings}
          onMappingsChange={setDateReassignMappings}
          busy={dateReassignBusy}
          onCancel={() => {
            if (!dateReassignBusy) setDateReassignState(null);
          }}
          onConfirm={() => {
            if (!dateReassignState) return;
            setDateReassignBusy(true);
            applyTripDateRangeChange(dateReassignState.partial, dateReassignMappings)
              .then(() => {
                setDateReassignState(null);
                setEditOpen(false);
                setDateReassignBusy(false);
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error('Trip date range save failed', err);
                setDateReassignBusy(false);
              });
          }}
        />
      ) : null}
    </>
  );

  return {
    editOpen,
    openEdit: () => setEditOpen(true),
    closeEdit: () => setEditOpen(false),
    tripDetailsEditor
  };
}
