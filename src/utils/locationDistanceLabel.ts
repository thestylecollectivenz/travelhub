/** Format distance text as "200 m from Hilton Rotterdam • 3 min walk". */
export function formatDistanceFromStart(raw: string | undefined, startLabel: string): string | undefined {
  const label = (startLabel || '').trim();
  const text = (raw || '').trim();
  if (!text && !label) return undefined;
  if (!text) return label ? `Near ${label}` : undefined;

  const distMatch = text.match(/^([\d.]+\s*(?:m|km|mi))\b/i);
  const walkMatch = text.match(/(\d+\s*min(?:ute)?s?\s*walk)/i);
  if (distMatch && label) {
    const parts = [`${distMatch[1]} from ${label}`];
    if (walkMatch) parts.push(walkMatch[1]);
    else {
      const rest = text.slice(distMatch[0].length).replace(/^[•·|,\s-]+/, '').trim();
      if (rest && /walk|min/i.test(rest) && !/from\s/i.test(rest)) parts.push(rest);
    }
    return parts.join(' • ');
  }

  if (label && !/from\s/i.test(text)) {
    return `${text} from ${label}`;
  }
  return text;
}

/** Parse a distance string into kilometres for filtering (undefined if unknown). */
export function parseDistanceKm(raw: string | undefined): number | undefined {
  const text = (raw || '').trim();
  if (!text) return undefined;
  const km = text.match(/([\d.]+)\s*km\b/i);
  if (km) {
    const n = Number(km[1]);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  const m = text.match(/([\d.]+)\s*m\b/i);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) && n >= 0 ? n / 1000 : undefined;
  }
  const mi = text.match(/([\d.]+)\s*mi(?:le)?s?\b/i);
  if (mi) {
    const n = Number(mi[1]);
    return Number.isFinite(n) && n >= 0 ? n * 1.60934 : undefined;
  }
  return undefined;
}

export function estimateWalkMinutes(raw: string | undefined): string | undefined {
  const text = (raw || '').trim();
  const walk = text.match(/(\d+)\s*min(?:ute)?s?\s*walk/i);
  if (walk) return `${walk[1]} min walk`;
  const m = text.match(/^([\d.]+)\s*m\b/i);
  if (m) {
    const meters = Number(m[1]);
    if (Number.isFinite(meters) && meters > 0) {
      const mins = Math.max(1, Math.round(meters / 80));
      return `${mins} min walk`;
    }
  }
  const km = text.match(/^([\d.]+)\s*km\b/i);
  if (km) {
    const kilos = Number(km[1]);
    if (Number.isFinite(kilos) && kilos > 0) {
      const mins = Math.max(1, Math.round((kilos * 1000) / 80));
      return `${mins} min walk`;
    }
  }
  return undefined;
}

export function distanceDisplayWithWalk(
  raw: string | undefined,
  startLabel: string
): string | undefined {
  const formatted = formatDistanceFromStart(raw, startLabel);
  if (formatted && /min walk/i.test(formatted)) return formatted;
  const walk = estimateWalkMinutes(raw);
  if (formatted && walk && !/min walk/i.test(formatted)) return `${formatted} • ${walk}`;
  return formatted;
}
