/** Shared offset logic so map route lines end at the same coordinates as markers. */
export function nextDisplayLatLng(
  latitude: number,
  longitude: number,
  visitCountByCoord: Map<string, number>
): [number, number] {
  const key = `${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  const visit = visitCountByCoord.get(key) ?? 0;
  visitCountByCoord.set(key, visit + 1);
  return [latitude + visit * 0.012, longitude + visit * 0.008];
}
