/**
 * Cruise paste lines often append ship / operator text ("on Viking Tialfi") that breaks geocoding.
 * Strip that narrative tail for display + place search while optionally preserving it as metadata.
 */
export function splitCruiseShipMeta(port: string): { clean: string; meta?: string } {
  const raw = (port || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { clean: '' };

  const lower = raw.toLowerCase();
  const aboardIdx = lower.indexOf(' aboard ');
  if (aboardIdx > 0) {
    return { clean: raw.slice(0, aboardIdx).trim(), meta: raw.slice(aboardIdx + 1).trim() };
  }

  const onIdx = lower.lastIndexOf(' on ');
  if (onIdx > 0) {
    const tail = raw.slice(onIdx + 4).trim();
    // Require tail to look like a name (ship / operator), not a country clause.
    if (tail && /^[A-Za-z0-9][A-Za-z0-9\s.'-]{2,}$/.test(tail)) {
      return { clean: raw.slice(0, onIdx).trim(), meta: tail };
    }
  }

  return { clean: raw };
}
