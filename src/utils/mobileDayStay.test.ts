import { findStayTileForDay } from './mobileDayStay';
import type { ItineraryEntry } from '../models/ItineraryEntry';

function cruise(
  id: string,
  embark: string,
  disembark: string
): ItineraryEntry {
  return {
    id,
    tripId: 't1',
    category: 'Cruise',
    title: id,
    embarksDate: embark,
    disembarksDate: disembark
  } as ItineraryEntry;
}

describe('findStayTileForDay', () => {
  it('prefers boarding cruise over finishing cruise on the same day', () => {
    const finishing = cruise('old', '2026-11-01', '2026-11-15');
    const boarding = cruise('new', '2026-11-15', '2026-11-28');
    const result = findStayTileForDay([finishing, boarding], '2026-11-15');
    expect(result?.entry.id).toBe('new');
    expect(result?.mode).toBe('cruise');
  });

  it('uses overnight cruise mid-voyage (not disembark morning alone)', () => {
    const mid = cruise('ship', '2026-11-01', '2026-11-15');
    expect(findStayTileForDay([mid], '2026-11-10')?.entry.id).toBe('ship');
    expect(findStayTileForDay([mid], '2026-11-15')).toBeUndefined();
  });
});
