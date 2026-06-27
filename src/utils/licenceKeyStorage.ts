const KEY_PREFIX = 'travelhub-licence-key-';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId.trim().toLowerCase()}`;
}

/** Load a previously activated licence key for this browser + user. */
export function loadStoredLicenceKey(userId: string): string {
  if (!userId.trim()) return '';
  try {
    return window.localStorage.getItem(storageKey(userId))?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveStoredLicenceKey(userId: string, licenceKey: string): void {
  const uid = userId.trim();
  const key = licenceKey.trim();
  if (!uid || !key) return;
  try {
    window.localStorage.setItem(storageKey(uid), key);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredLicenceKey(userId: string): void {
  if (!userId.trim()) return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}
