import type { Place } from '../models/Place';
import type { PlaceCandidate } from '../models/Place';

/** City or short place name from a Nominatim-style title (first segment before comma). */
export function placeNameFromTitle(title: string): string {
  const t = (title || '').trim();
  if (!t) return '';
  const comma = t.indexOf(',');
  return (comma >= 0 ? t.slice(0, comma) : t).trim();
}

/** Display as "Place name, Country" — not the full multi-part geocoder string. */
export function placeDisplayLabel(place: Pick<Place, 'title' | 'country'> | Pick<PlaceCandidate, 'title' | 'country'>): string {
  const name = placeNameFromTitle(place.title) || (place.title || '').trim();
  const country = (place.country || '').trim();
  if (name && country) return `${name}, ${country}`;
  return name || country || '';
}

/** Normalize free-text location fields to place + country when possible. */
export function formatLocationText(text: string, countryFallback?: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }
  if (countryFallback?.trim()) {
    return `${placeNameFromTitle(t) || t}, ${countryFallback.trim()}`;
  }
  return t;
}
