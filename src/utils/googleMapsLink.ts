import type { ItineraryEntry } from '../models/ItineraryEntry';

/** Google Maps place search — shows the destination on the map. */
export function googleMapsPlaceUrl(address: string): string | undefined {
  const t = address.trim();
  if (!t) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}

/** Google Maps directions from current location (same pattern as ES3-7 / ES3-9). */
export function googleMapsDirectionsUrl(address: string): string | undefined {
  const t = address.trim();
  if (!t) return undefined;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t)}`;
}

/** Directions from the user's current location to lat/lng. */
export function googleMapsDirectionsToCoords(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
}

/** Google search for reviews of a venue. */
export function googleReviewsSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} reviews`)}`;
}

export function placeQueryMapsUrl(name: string, address?: string): string | undefined {
  const q = [name.trim(), (address || '').trim()].filter(Boolean).join(', ');
  return googleMapsPlaceUrl(q);
}

export function placeQueryDirectionsUrl(name: string, address?: string): string | undefined {
  const q = [name.trim(), (address || '').trim()].filter(Boolean).join(', ');
  return googleMapsDirectionsUrl(q);
}

/**
 * Directions from the user's current location to a place.
 * Prefers a full destination (name + address + locality) so Maps opens routing,
 * not a place-search results list.
 */
export function placeDirectionsFromHereUrl(
  name: string,
  address?: string,
  locality?: string
): string | undefined {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [name, address, locality]) {
    const t = (raw || '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(t);
  }
  if (!parts.length) return undefined;
  return googleMapsDirectionsUrl(parts.join(', '));
}

/** Best-effort official site lookup for a venue/service. */
export function placeWebsiteSearchUrl(name: string, address?: string): string | undefined {
  const q = [name.trim(), (address || '').trim(), 'official site'].filter(Boolean).join(' ');
  if (!q) return undefined;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Best text query for maps: street address first, then location / transport endpoints. */
export function entryMapsQuery(
  entry: Pick<ItineraryEntry, 'streetAddress' | 'location' | 'transportFrom' | 'transportTo' | 'category'>
): string {
  const street = (entry.streetAddress ?? '').trim();
  if (street) return street;
  const location = (entry.location ?? '').trim();
  if (location) return location;
  const to = (entry.transportTo ?? '').trim();
  const from = (entry.transportFrom ?? '').trim();
  if (entry.category === 'Transport' || entry.category === 'Flights') {
    if (to && from) return `${from} to ${to}`;
    return to || from;
  }
  return '';
}

export function entryMapsPlaceUrl(
  entry: Pick<ItineraryEntry, 'streetAddress' | 'location' | 'transportFrom' | 'transportTo' | 'category'>
): string | undefined {
  return googleMapsPlaceUrl(entryMapsQuery(entry));
}

export function entryMapsDirectionsUrl(
  entry: Pick<ItineraryEntry, 'streetAddress' | 'location' | 'transportFrom' | 'transportTo' | 'category'>
): string | undefined {
  return googleMapsDirectionsUrl(entryMapsQuery(entry));
}
