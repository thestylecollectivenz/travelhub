import { arrivalTimeFromDuration, isDurationExpressionComplete, parseDurationMinutes } from './durationFromTimes';

describe('durationFromTimes', () => {
  it('parses hours and minutes', () => {
    expect(parseDurationMinutes('6h')).toBe(360);
    expect(parseDurationMinutes('2h 30m')).toBe(150);
    expect(parseDurationMinutes('45m')).toBe(45);
  });

  it('waits for explicit duration units before auto end-time', () => {
    expect(isDurationExpressionComplete('6')).toBe(false);
    expect(isDurationExpressionComplete('6h')).toBe(true);
  });

  it('adds duration to afternoon start without timezone drift', () => {
    const result = arrivalTimeFromDuration({
      startDate: '2026-11-20',
      startTime: '12:30',
      duration: '6h'
    });
    expect(result).toEqual({ arrivalDate: '2026-11-20', arrivalTime: '18:30' });
  });
});
