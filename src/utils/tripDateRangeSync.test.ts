import type { TripDay } from '../models/TripDay';
import {
  analyzeTripDateRangeChange,
  eachCalendarDayYmd,
  listMissingCalendarDates,
  planChronologicalRenumber,
  suggestReassignmentTargetDayId
} from './tripDateRangeSync';

const preTrip: TripDay = {
  id: 'pre',
  tripId: 't1',
  dayNumber: 0,
  calendarDate: '2026-05-04',
  displayTitle: 'Pre-trip',
  dayType: 'PreTrip'
};

const day = (id: string, n: number, cal: string): TripDay => ({
  id,
  tripId: 't1',
  dayNumber: n,
  calendarDate: cal,
  displayTitle: `Day ${n}`,
  dayType: 'PlacePort'
});

describe('tripDateRangeSync', () => {
  it('lists inclusive calendar days', () => {
    expect(eachCalendarDayYmd('2026-05-01', '2026-05-03')).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
  });

  it('finds missing dates when extending', () => {
    const days = [preTrip, day('d1', 1, '2026-05-05'), day('d2', 2, '2026-05-06')];
    expect(listMissingCalendarDates('2026-05-05', '2026-05-08', days)).toEqual(['2026-05-07', '2026-05-08']);
  });

  it('flags orphaned days with content when range shifts', () => {
    const days = [preTrip, day('d1', 1, '2026-05-01'), day('d2', 2, '2026-05-02')];
    const plan = analyzeTripDateRangeChange({
      newStart: '2026-06-01',
      newEnd: '2026-06-02',
      tripDays: days,
      itinerary: [{ id: 'e1', dayId: 'd1', tripId: 't1', title: 'Flight', category: 'Flights', sortOrder: 0 } as never],
      journalEntries: [],
      journalPhotos: []
    });
    expect(plan.requiresReassignment).toBe(true);
    expect(plan.orphanedDays).toHaveLength(1);
    expect(plan.orphanedDays[0].day.id).toBe('d1');
    expect(plan.hasOverlapWithContentDays).toBe(false);
    expect(plan.datesToCreate).toEqual(['2026-06-01', '2026-06-02']);
  });

  it('does not require reassignment when extending with no orphans', () => {
    const days = [preTrip, day('d1', 1, '2026-05-01'), day('d2', 2, '2026-05-02')];
    const plan = analyzeTripDateRangeChange({
      newStart: '2026-05-01',
      newEnd: '2026-05-04',
      tripDays: days,
      itinerary: [{ id: 'e1', dayId: 'd1', tripId: 't1', title: 'Hotel', category: 'Accommodation', sortOrder: 0 } as never],
      journalEntries: [],
      journalPhotos: []
    });
    expect(plan.requiresReassignment).toBe(false);
    expect(plan.datesToCreate).toEqual(['2026-05-03', '2026-05-04']);
  });

  it('renumbers days by calendar order when start date moves earlier', () => {
    const days = [preTrip, day('d1', 1, '2026-04-01'), day('d2', 2, '2026-04-02'), day('d5', 5, '2026-03-31')];
    const patches = planChronologicalRenumber(days);
    const byId = new Map(patches.map((p) => [p.id, p]));
    expect(byId.get('d5')?.dayNumber).toBe(1);
    expect(byId.get('d1')?.dayNumber).toBe(2);
    expect(byId.get('d2')?.dayNumber).toBe(3);
  });

  it('suggests nearest in-range target day', () => {
    const targets = [day('n1', 1, '2026-06-01'), day('n2', 2, '2026-06-10')];
    expect(suggestReassignmentTargetDayId('2026-05-28', targets, '2026-06-01', '2026-06-10')).toBe('n1');
    expect(suggestReassignmentTargetDayId('2026-06-08', targets, '2026-06-01', '2026-06-10')).toBe('n2');
  });
});
