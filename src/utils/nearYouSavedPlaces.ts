export const NEAR_YOU_SAVED_STORAGE_KEY = 'travelhub-near-you-saved';

export interface NearYouSavedPlace {
  id: string;
  name: string;
  note?: string;
  mapsUrl?: string;
  websiteUrl?: string;
  savedAt: string;
  toolId?: string;
}

function newId(): string {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadNearYouSavedPlaces(): NearYouSavedPlace[] {
  try {
    const raw = window.localStorage.getItem(NEAR_YOU_SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is NearYouSavedPlace => Boolean(x && typeof x === 'object' && typeof (x as NearYouSavedPlace).name === 'string'))
      .map((x) => ({
        id: x.id || newId(),
        name: x.name,
        note: x.note,
        mapsUrl: x.mapsUrl,
        websiteUrl: x.websiteUrl,
        savedAt: x.savedAt || new Date().toISOString(),
        toolId: x.toolId
      }));
  } catch {
    return [];
  }
}

export function saveNearYouSavedPlace(
  place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string },
  max = 40
): NearYouSavedPlace {
  const row: NearYouSavedPlace = {
    id: newId(),
    name: place.name.trim(),
    note: place.note?.trim() || undefined,
    mapsUrl: place.mapsUrl,
    websiteUrl: place.websiteUrl,
    savedAt: new Date().toISOString(),
    toolId: place.toolId
  };
  const list = loadNearYouSavedPlaces().filter((x) => x.name.trim().toLowerCase() !== row.name.toLowerCase());
  list.unshift(row);
  window.localStorage.setItem(NEAR_YOU_SAVED_STORAGE_KEY, JSON.stringify(list.slice(0, max)));
  window.dispatchEvent(new Event('travelhub-near-you-saved-changed'));
  return row;
}

export function removeNearYouSavedPlace(id: string): void {
  const list = loadNearYouSavedPlaces().filter((x) => x.id !== id);
  window.localStorage.setItem(NEAR_YOU_SAVED_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('travelhub-near-you-saved-changed'));
}
