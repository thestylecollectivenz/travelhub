import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import type { TripDay } from '../models/TripDay';
import { resolvePlaceLabel, sumTransportGroundKm, tripPlacePool } from './tripTransportGroundKm';

const pAuckland: Place = {
  id: 'p1',
  title: 'Auckland, New Zealand',
  latitude: -36.8485,
  longitude: 174.7633,
  country: 'NZ',
  countryCode: 'NZ',
  placeType: 'city',
  nominatimId: 'x1',
  timeZone: 'Pacific/Auckland'
};

const pWellington: Place = {
  id: 'p2',
  title: 'Wellington, New Zealand',
  latitude: -41.2865,
  longitude: 174.7762,
  country: 'NZ',
  countryCode: 'NZ',
  placeType: 'city',
  nominatimId: 'x2',
  timeZone: 'Pacific/Auckland'
};

describe('resolvePlaceLabel', () => {
  it('matches exact normalized title', () => {
    expect(resolvePlaceLabel('Wellington, New Zealand', [pAuckland, pWellington])?.id).toBe('p2');
  });

  it('matches substring in trip pool', () => {
    expect(resolvePlaceLabel('Auckland', [pAuckland, pWellington])?.id).toBe('p1');
  });
});

describe('sumTransportGroundKm', () => {
  const tripId = 't1';
  const tripDays: TripDay[] = [
    {
      id: 'd1',
      tripId,
      dayNumber: 1,
      displayTitle: 'Day 1',
      calendarDate: '2026-01-01',
      dayType: 'PlacePort',
      primaryPlaceId: 'p1',
      additionalPlaceIds: []
    }
  ];

  const placeById = (id?: string): Place | undefined => {
    if (id === 'p1') return pAuckland;
    if (id === 'p2') return pWellington;
    return undefined;
  };

  it('sums haversine for transport when labels resolve to places', () => {
    const entries: ItineraryEntry[] = [
      {
        id: 'e1',
        tripId,
        dayId: 'd1',
        title: 'Train',
        category: 'Transport',
        timeStart: '09:00',
        duration: '8h',
        supplier: '',
        notes: '',
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: 'NZD',
        sortOrder: 1,
        transportFrom: 'Auckland',
        transportTo: 'Wellington, New Zealand',
        journeyType: 'oneway'
      }
    ];
    const km = sumTransportGroundKm(entries, tripId, tripDays, placeById, [pAuckland, pWellington]);
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(520);
  });

  it('doubles distance for return journeys', () => {
    const entries: ItineraryEntry[] = [
      {
        id: 'e1',
        tripId,
        dayId: 'd1',
        title: 'Train',
        category: 'Transport',
        timeStart: '09:00',
        duration: '8h',
        supplier: '',
        notes: '',
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: 'NZD',
        sortOrder: 1,
        transportFrom: 'Auckland, New Zealand',
        transportTo: 'Wellington',
        journeyType: 'return'
      }
    ];
    const oneWay = sumTransportGroundKm(
      [{ ...entries[0], journeyType: 'oneway' }],
      tripId,
      tripDays,
      placeById,
      [pAuckland, pWellington]
    );
    const ret = sumTransportGroundKm(entries, tripId, tripDays, placeById, [pAuckland, pWellington]);
    expect(ret).toBeCloseTo(oneWay * 2, 5);
  });

  it('returns 0 when labels cannot resolve', () => {
    const entries: ItineraryEntry[] = [
      {
        id: 'e1',
        tripId,
        dayId: 'd1',
        title: 'Train',
        category: 'Transport',
        timeStart: '09:00',
        duration: '8h',
        supplier: '',
        notes: '',
        decisionStatus: 'Planned',
        bookingRequired: false,
        bookingStatus: 'Not booked',
        paymentStatus: 'Not paid',
        amount: 0,
        currency: 'NZD',
        sortOrder: 1,
        transportFrom: 'Unknown City Xyz',
        transportTo: 'Unknown City Abc',
        journeyType: 'oneway'
      }
    ];
    expect(sumTransportGroundKm(entries, tripId, tripDays, placeById, [pAuckland, pWellington])).toBe(0);
  });
});

describe('tripPlacePool', () => {
  it('collects primary and additional place ids for the trip', () => {
    const days: TripDay[] = [
      {
        id: 'd1',
        tripId: 't1',
        dayNumber: 1,
        displayTitle: 'D1',
        calendarDate: '2026-01-01',
        dayType: 'PlacePort',
        primaryPlaceId: 'p1',
        additionalPlaceIds: []
      },
      {
        id: 'd2',
        tripId: 't1',
        dayNumber: 2,
        displayTitle: 'D2',
        calendarDate: '2026-01-02',
        dayType: 'PlacePort',
        primaryPlaceId: 'p2',
        additionalPlaceIds: []
      }
    ];
    const pool = tripPlacePool('t1', days, (id) => (id === 'p1' ? pAuckland : id === 'p2' ? pWellington : undefined));
    expect(pool.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });
});
