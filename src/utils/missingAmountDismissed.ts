const KEY_PREFIX = 'th-missing-amount-ok';

function storageKey(tripId: string): string {
  return `${KEY_PREFIX}-${tripId}`;
}

export function loadDismissedMissingAmountIds(tripId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(tripId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedMissingAmountIds(tripId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(tripId), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore quota */
  }
}

export function dismissMissingAmountEntry(tripId: string, entryId: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  next.add(entryId);
  saveDismissedMissingAmountIds(tripId, next);
  return next;
}

export function restoreMissingAmountEntry(tripId: string, entryId: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  next.delete(entryId);
  saveDismissedMissingAmountIds(tripId, next);
  return next;
}
