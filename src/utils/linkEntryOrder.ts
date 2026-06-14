const PREFIX = 'travelHub.linkOrder';

function storageKey(tripId: string, entryId: string): string {
  return `${PREFIX}.${tripId}.${entryId}`;
}

export function readLinkOrder(tripId: string, entryId: string): string[] {
  if (!tripId || !entryId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tripId, entryId));
    if (!raw) return [];
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function saveLinkOrder(tripId: string, entryId: string, orderedIds: string[]): void {
  if (!tripId || !entryId) return;
  try {
    window.localStorage.setItem(storageKey(tripId, entryId), JSON.stringify(orderedIds));
  } catch {
    /* ignore */
  }
}

export function applyLinkOrder<T extends { id: string }>(tripId: string, entryId: string, links: T[]): T[] {
  const order = readLinkOrder(tripId, entryId);
  if (!order.length) return links;
  const byId = new Map(links.map((l) => [l.id, l]));
  const out: T[] = [];
  const used = new Set<string>();
  for (const id of order) {
    const link = byId.get(id);
    if (link) {
      out.push(link);
      used.add(id);
    }
  }
  for (const link of links) {
    if (!used.has(link.id)) out.push(link);
  }
  return out;
}

/** Swap one link up or down within an ordered id list. Returns null when move is not possible. */
export function swapLinkOrderIds(orderedIds: string[], linkId: string, direction: -1 | 1): string[] | null {
  const idx = orderedIds.indexOf(linkId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= orderedIds.length) return null;
  const next = [...orderedIds];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  return next;
}
