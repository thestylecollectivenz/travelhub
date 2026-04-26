export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function formatDistance(value: number, unit: 'Kilometres' | 'Miles'): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString('en-NZ')} ${unit === 'Miles' ? 'mi' : 'km'}`;
}
