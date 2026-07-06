import { describe, expect, it } from '@jest/globals';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import { deriveTransportDisplayTitle } from './transportDisplayTitle';

function transportEntry(overrides: Partial<ItineraryEntry> = {}): ItineraryEntry {
  return {
    id: 't1',
    dayId: 'd1',
    tripId: 'trip1',
    title: '',
    category: 'Transport',
    timeStart: '',
    duration: '',
    supplier: '',
    notes: '',
    decisionStatus: 'Planned',
    bookingRequired: false,
    bookingStatus: 'Not booked',
    paymentStatus: 'Not paid',
    amount: 0,
    currency: 'NZD',
    sortOrder: 0,
    journeyType: 'return',
    transportFrom: 'Colmar Station',
    transportTo: 'Strasbourg Station',
    returnDate: '2026-12-04',
    ...overrides
  };
}

describe('deriveTransportDisplayTitle', () => {
  it('flips from/to on return leg even when title is stored', () => {
    const entry = transportEntry({
      title: 'Colmar Station → Strasbourg Station (Train)',
      transportMode: 'Train',
      returnDate: '2026-12-04'
    });
    expect(deriveTransportDisplayTitle(entry, '2026-12-04', 'return')).toBe(
      'Strasbourg Station → Colmar Station (Train)'
    );
  });

  it('keeps outbound direction on departure day', () => {
    const entry = transportEntry({
      title: 'Colmar Station → Strasbourg Station',
      dateStart: '2026-12-03',
      returnDate: '2026-12-04'
    });
    expect(deriveTransportDisplayTitle(entry, '2026-12-03', 'outbound')).toBe(
      'Colmar Station → Strasbourg Station'
    );
  });
});
