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

const SEA_ROUTE_CLUE =
  /\b(fjord|fjords|strait|channel|passage|sound|gulf|bay|sea|ocean|arctic|antarctic|glacier|drake|magellan|beagle|scenic|cruising|experience)\b/i;

/** Search variants for scenic / at-sea cruise lines (fjords, passages, etc.). */
export function cruiseSeaDaySearchQueries(portName: string): string[] {
  const raw = (portName || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const variants = new Set<string>();
  const lower = raw.toLowerCase();
  if (lower.includes('at sea') || lower.includes('days at sea') || lower.includes('day at sea')) {
    return [];
  }

  if (!SEA_ROUTE_CLUE.test(raw)) {
    variants.add(raw);
  }

  const segments = raw
    .split(/[,;–—]|(?:\s+and\s+)|(?:\s+via\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && SEA_ROUTE_CLUE.test(s));

  for (const seg of segments.length ? segments : [raw]) {
    const cleaned = seg.replace(/\b(scenic|experience|daylight|cruising|only)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    variants.add(cleaned);
    if (/\bfjord/i.test(cleaned)) {
      variants.add(`${cleaned}, Norway`);
      variants.add(`${cleaned}, Chile`);
    }
    if (/\bpassage\b/i.test(cleaned)) variants.add(cleaned);
    if (/\bchannel\b/i.test(cleaned)) {
      variants.add(`${cleaned}, Chile`);
      variants.add(`${cleaned}, Argentina`);
    }
    if (/\barctic\b/i.test(cleaned)) variants.add(`${cleaned}, Norway`);
    if (/\bdrake\b/i.test(cleaned)) variants.add(`${cleaned}, Antarctica`);
    if (/\bglacier\b/i.test(cleaned)) variants.add(`${cleaned}, Alaska`);
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
