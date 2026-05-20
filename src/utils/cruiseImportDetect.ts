import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';

export function isCruiseImportSegmentEntry(entry: ItineraryEntry): boolean {
  const cat = entry.category || '';
  if (cat === 'Cruise port' || cat === 'Cruise at sea') return true;
  if (cat === 'Cruise' && /cruise import|imported.*port/i.test(entry.notes || '')) return true;
  return false;
}

export function isParentCruiseEntry(entry: ItineraryEntry): boolean {
  return entry.category === 'Cruise' && !entry.parentEntryId;
}

export function dayYmd(calendarDate?: string): string {
  return (calendarDate || '').slice(0, 10);
}

export type CruiseImportConflict = {
  affectedDayCount: number;
  existingCount: number;
  affectedDayIds: Set<string>;
};

export function detectCruiseImportConflict(
  localEntries: ItineraryEntry[],
  tripId: string,
  _tripDays: TripDay[],
  targetDayIds: Set<string>
): CruiseImportConflict {
  const affectedDayIds = new Set<string>();
  let existingCount = 0;

  for (const dayId of Array.from(targetDayIds)) {
    const onDay = localEntries.filter((e) => e.tripId === tripId && e.dayId === dayId && !e.parentEntryId);
    const cruiseRelated = onDay.filter((e) => isCruiseImportSegmentEntry(e) || isParentCruiseEntry(e));
    if (cruiseRelated.length) {
      affectedDayIds.add(dayId);
      existingCount += cruiseRelated.length;
    }
  }

  return {
    affectedDayCount: affectedDayIds.size,
    existingCount,
    affectedDayIds
  };
}

/** Ids of cruise-only itinerary rows to remove before overwrite import (never touches trip days). */
export function entriesToRemoveForCruiseOverwrite(
  localEntries: ItineraryEntry[],
  tripId: string,
  targetDayIds: Set<string>
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const dayId of Array.from(targetDayIds)) {
    for (const e of localEntries) {
      if (e.tripId !== tripId || e.parentEntryId || seen.has(e.id)) continue;
      if (e.dayId !== dayId) continue;
      if (isCruiseImportSegmentEntry(e) || isParentCruiseEntry(e)) {
        ids.push(e.id);
        seen.add(e.id);
      }
    }
  }
  return ids;
}
