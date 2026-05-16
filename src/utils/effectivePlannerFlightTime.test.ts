import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { effectivePlannerTimeStart } from './itineraryDayEntries';

const tripDays: TripDay[] = [
  {
    id: 'd1',
    tripId: 't1',
    dayNumber: 1,
    calendarDate: '2026-10-25',
    displayTitle: 'Day 1',
    dayType: 'PlacePort'
  }
];

describe('effectivePlannerTimeStart (flights)', () => {
  it('uses departure time on same calendar day as arrival', () => {
    const entry: ItineraryEntry = {
      id: 'f1',
      dayId: 'd1',
      tripId: 't1',
      title: 'WLG–AKL',
      category: 'Flights',
      timeStart: '12:45',
      arrivalTime: '13:50',
      arrivalDate: '2026-10-25',
      duration: '1h 05m',
      supplier: '',
      notes: '',
      decisionStatus: 'Confirmed',
      bookingRequired: true,
      bookingStatus: 'Booked',
      paymentStatus: 'Fully paid',
      amount: 0,
      currency: 'NZD',
      sortOrder: 0
    };
    expect(effectivePlannerTimeStart(entry, '2026-10-25', tripDays)).toBe('12:45');
  });

  it('uses arrival time on the arrival-day column when home day differs', () => {
    const entry: ItineraryEntry = {
      id: 'f1',
      dayId: 'd0',
      tripId: 't1',
      title: 'Overnight',
      category: 'Flights',
      timeStart: '22:00',
      arrivalTime: '06:30',
      arrivalDate: '2026-10-26',
      duration: '8h',
      supplier: '',
      notes: '',
      decisionStatus: 'Confirmed',
      bookingRequired: true,
      bookingStatus: 'Booked',
      paymentStatus: 'Fully paid',
      amount: 0,
      currency: 'NZD',
      sortOrder: 0
    };
    const days: TripDay[] = [
      { id: 'd0', tripId: 't1', dayNumber: 0, calendarDate: '2026-10-25', displayTitle: 'Out', dayType: 'PlacePort' },
      { id: 'd1', tripId: 't1', dayNumber: 1, calendarDate: '2026-10-26', displayTitle: 'In', dayType: 'PlacePort' }
    ];
    expect(effectivePlannerTimeStart(entry, '2026-10-25', days)).toBe('22:00');
    expect(effectivePlannerTimeStart(entry, '2026-10-26', days)).toBe('06:30');
  });
});
