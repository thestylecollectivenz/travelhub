import type { NearYouToolId } from './nearYouTools';
import { NEAR_YOU_TOOLS } from './nearYouTools';
import type { DiningSuggestionRow, LocationInfoNotes, NearestPlaceRow } from './locationInfoEntry';
import { normalizeLocationInfoNotes } from './locationInfoEntry';

function newRowId(): string {
  return `near-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nameExists(names: string[], candidate: string): boolean {
  const key = candidate.trim().toLowerCase();
  return names.some((n) => n.trim().toLowerCase() === key);
}

/** Append a Near-you search result to the location-info entry (dining or nearest lists). */
export function appendNearYouPlaceToLocationInfo(
  data: LocationInfoNotes,
  toolId: NearYouToolId,
  place: {
    name: string;
    note?: string;
    mapsUrl?: string;
    websiteUrl?: string;
    tripadvisorUrl?: string;
    photoUrl?: string;
    address?: string;
    why?: string;
    bestFor?: string;
    rating?: number;
    priceLevel?: string;
    servicesSummary?: string;
  },
  nearLabel?: string
): LocationInfoNotes {
  const name = place.name.trim();
  if (!name) return data;
  const anchor = (nearLabel || '').trim() || undefined;

  if (toolId === 'dining' || toolId === 'cafes') {
    const existing = data.diningSuggestions ?? [];
    if (nameExists(existing.map((x) => x.name), name)) return data;
    const row: DiningSuggestionRow = {
      id: newRowId(),
      name,
      description: place.note,
      bestFor: place.bestFor || place.note,
      why: place.why || place.note,
      rating: place.rating,
      priceLevel: place.priceLevel,
      address: place.address,
      mapsUrl: place.mapsUrl,
      websiteUrl: place.websiteUrl,
      tripadvisorUrl: place.tripadvisorUrl,
      photoUrl: place.photoUrl,
      done: false,
      nearLabel: anchor
    };
    return normalizeLocationInfoNotes({
      ...data,
      diningSuggestions: [...existing, row]
    });
  }

  const kind = NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.kind;
  if (!kind) return data;

  const nearest = data.nearestPlaces ?? {};
  const rows = nearest[kind] ?? [];
  if (nameExists(rows.map((x) => x.name), name)) return data;
  const row: NearestPlaceRow = {
    id: newRowId(),
    name,
    note: place.note,
    address: place.address,
    servicesSummary: place.servicesSummary || place.why || place.note,
    mapsUrl: place.mapsUrl,
    websiteUrl: place.websiteUrl,
    tripadvisorUrl: place.tripadvisorUrl,
    photoUrl: place.photoUrl,
    nearLabel: anchor
  };
  return normalizeLocationInfoNotes({
    ...data,
    nearestPlaces: {
      ...nearest,
      [kind]: [...rows, row]
    }
  });
}
