import { parseHomePlaceIds, serializeHomePlaceIds, toggleTripHomePlaceId } from './tripHomePlaces';

describe('tripHomePlaces', () => {
  it('parses single and multi home ids', () => {
    expect(parseHomePlaceIds('abc')).toEqual(['abc']);
    expect(parseHomePlaceIds('a;b;c')).toEqual(['a', 'b', 'c']);
    expect(parseHomePlaceIds('a, b | c')).toEqual(['a', 'b', 'c']);
    expect(parseHomePlaceIds('["x","y"]')).toEqual(['x', 'y']);
  });

  it('serializes uniquely', () => {
    expect(serializeHomePlaceIds(['a', 'b', 'a'])).toBe('a;b');
    expect(serializeHomePlaceIds([])).toBe('');
  });

  it('toggles add and remove', () => {
    expect(toggleTripHomePlaceId([], 'welly')).toEqual(['welly']);
    expect(toggleTripHomePlaceId(['welly'], 'akl')).toEqual(['welly', 'akl']);
    expect(toggleTripHomePlaceId(['welly', 'akl'], 'welly')).toEqual(['akl']);
  });
});
