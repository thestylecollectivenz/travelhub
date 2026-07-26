const KEY = 'travelhub-trip-travellers-';

function isPlaceholderTravellerName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/^traveller\s*\d+$/i.test(n)) return true;
  if (/^follower$/i.test(n)) return true;
  return false;
}

export function loadTripTravellers(tripId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${KEY}${tripId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x === 'string' && (x as string).trim())
      .map((x) => (x as string).trim())
      .filter((n) => !isPlaceholderTravellerName(n));
  } catch {
    return [];
  }
}

export function saveTripTravellers(tripId: string, names: string[]): void {
  try {
    const cleaned = names.map((n) => n.trim()).filter((n) => n && !isPlaceholderTravellerName(n));
    window.localStorage.setItem(`${KEY}${tripId}`, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

/**
 * Traveller chip labels for packing/shopping: Editors + Companions only.
 * Prefer journal display name for the signed-in user when provided.
 * Never seeds "Traveller 1" / "Follower".
 */
export function travellersFromEligibleMembers(
  members: Array<{ userDisplayName: string; userEmail: string; role: string }>,
  options?: { currentUserEmail?: string; journalAuthorName?: string }
): string[] {
  const eligible = members.filter((m) => m.role === 'Editor' || m.role === 'Companion');
  const names: string[] = [];
  const seen = new Set<string>();
  const mine = (options?.currentUserEmail || '').trim().toLowerCase();
  const journal = (options?.journalAuthorName || '').trim();

  for (const m of eligible) {
    let name = (m.userDisplayName || '').trim();
    if (mine && m.userEmail.trim().toLowerCase() === mine && journal) {
      name = journal;
    }
    if (isPlaceholderTravellerName(name)) {
      name = (m.userEmail.split('@')[0] || m.userEmail || '').trim();
    }
    if (isPlaceholderTravellerName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

/** Merge trip member display names into the traveller pick list (case-insensitive). */
export function mergeTripTravellersWithMembers(
  tripId: string,
  members: Array<{ userDisplayName: string; userEmail?: string; role?: string }>,
  options?: { currentUserEmail?: string; journalAuthorName?: string }
): string[] {
  const fromMembers = travellersFromEligibleMembers(
    members.map((m) => ({
      userDisplayName: m.userDisplayName,
      userEmail: m.userEmail || '',
      role: m.role || 'Companion'
    })),
    options
  );

  // Prefer SharePoint members only — do not reintroduce localStorage "Traveller 1" / Follower.
  const existing = loadTripTravellers(tripId).filter((n) => {
    if (isPlaceholderTravellerName(n)) return false;
    // Keep legacy custom names only if they match a member display/email
    const key = n.toLowerCase();
    return members.some((m) => {
      const d = (m.userDisplayName || '').trim().toLowerCase();
      const e = (m.userEmail || '').trim().toLowerCase();
      return d === key || e === key;
    });
  });

  const seen = new Set(fromMembers.map((n) => n.toLowerCase()));
  const merged = [...fromMembers];
  for (const name of existing) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    // Skip if journal already covers current user under another label
    seen.add(key);
    merged.push(name);
  }

  saveTripTravellers(tripId, merged);
  return merged;
}
