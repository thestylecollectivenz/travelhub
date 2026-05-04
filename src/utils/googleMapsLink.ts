/** Google Maps directions deep link (same pattern as ES3-7 / ES3-9). */
export function googleMapsDirectionsUrl(address: string): string | undefined {
  const t = address.trim();
  if (!t) return undefined;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t)}`;
}
