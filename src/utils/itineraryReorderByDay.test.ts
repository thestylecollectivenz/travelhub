import type { ItineraryEntry } from '../models/ItineraryEntry';
import { orderIdsByHomeDayFromVisualList } from './itineraryReorderByDay';

function stubEntry(id: string, dayId: string): ItineraryEntry {
  return {
    id,
    dayId,
    tripId: 't1',
    title: id,
    category: 'Other',
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
    sortOrder: 0
  };
}

describe('orderIdsByHomeDayFromVisualList', () => {
  it('groups ids by home dayId in visual order', () => {
    const d1 = 'day-1';
    const d2 = 'day-2';
    const a = stubEntry('a', d1);
    const b = stubEntry('b', d2);
    const c = stubEntry('c', d2);
    const visual = [a, b, c];
    const map = orderIdsByHomeDayFromVisualList(visual);
    expect(Array.from(map.entries())).toEqual([
      [d1, ['a']],
      [d2, ['b', 'c']]
    ]);
  });

  it('interleaved carryover order is preserved per day', () => {
    const d1 = 'day-1';
    const d2 = 'day-2';
    const carry = stubEntry('carry', d1);
    const x = stubEntry('x', d2);
    const y = stubEntry('y', d2);
    const visual = [carry, y, x];
    const map = orderIdsByHomeDayFromVisualList(visual);
    expect(map.get(d1)).toEqual(['carry']);
    expect(map.get(d2)).toEqual(['y', 'x']);
  });

  it('skips sub-item rows', () => {
    const d1 = 'day-1';
    const parent = stubEntry('p', d1);
    const sub: ItineraryEntry = { ...stubEntry('s', d1), parentEntryId: 'p' };
    const map = orderIdsByHomeDayFromVisualList([parent, sub]);
    expect(map.get(d1)).toEqual(['p']);
  });
});
