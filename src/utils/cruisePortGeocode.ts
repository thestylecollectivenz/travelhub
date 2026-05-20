import type { PlaceCandidate } from '../models/Place';

/** Build search query variants for cruise port geocoding (Nominatim). */
export function cruisePortSearchQueries(portName: string): string[] {
  const raw = (portName || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const city = parts[0] || raw;
  const country = parts.slice(1).join(', ');

  const variants = new Set<string>();
  variants.add(raw);
  variants.add(`${raw} cruise port`);
  variants.add(city);
  if (country) {
    variants.add(`${city}, ${country}`);
    variants.add(`${city} port, ${country}`);
  }
  // Alternate names (e.g. Falkland Is / Malvinas)
  const slash = city.split('/').map((s) => s.trim()).filter(Boolean);
  if (slash.length > 1) {
    for (const seg of slash) {
      variants.add(seg);
      if (country) variants.add(`${seg}, ${country}`);
    }
  }
  const paren = raw.match(/^(.+?)\s*\(([^)]+)\)/);
  if (paren) {
    variants.add(paren[1].trim());
    variants.add(paren[2].trim());
    if (country) variants.add(`${paren[1].trim()}, ${country}`);
  }

  return Array.from(variants).filter(Boolean);
}

export function pickBestGeocodeCandidate(
  results: PlaceCandidate[],
  portName: string,
  scoreFn: (c: PlaceCandidate, port: string) => number
): PlaceCandidate | null {
  if (!results.length) return null;
  const ranked = [...results]
    .map((c) => ({ c, score: scoreFn(c, portName) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.c ?? null;
}
