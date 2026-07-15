const CACHE_KEY = 'travelhub-stay-hero-images-v5';

type CacheRow = Record<string, string>;

export type StayHeroMode = 'accommodation' | 'cruise';

function cacheKey(title: string, location: string, mode: StayHeroMode): string {
  return `${mode}|${title.trim().toLowerCase()}|${location.trim().toLowerCase()}`;
}

function loadCache(): CacheRow {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as CacheRow) : {};
  } catch {
    return {};
  }
}

function saveCache(row: CacheRow): void {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

function isLikelyRiverCruise(line: string, shipOrTitle: string): boolean {
  return /\b(viking|amah|avalon|uniworld|scenic|emerald|riviera|tauck|american\s+cruise|yangtze|mekong|danube|rhine|river\s+cruise|riverboat)\b/i.test(
    `${line} ${shipOrTitle}`
  );
}

function pollinationsFallback(_title: string, _location: string, _mode: StayHeroMode): string {
  return '';
}

function looksLikePersonPage(pageTitle: string): boolean {
  const t = pageTitle.trim().toLowerCase();
  if (/\b(singer|actor|actress|footballer|athlete|politician|writer|author|musician|biography|disambiguation)\b/.test(t)) {
    return true;
  }
  // Single personal name pattern without ship cues.
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(pageTitle) && !/\b(ship|cruise|ms |mv |ss )\b/i.test(pageTitle)) {
    return true;
  }
  return false;
}

function looksLikePropertyHit(title: string, pageTitle: string, mode: StayHeroMode): boolean {
  const prop = title.trim().toLowerCase();
  const hit = pageTitle.trim().toLowerCase();
  if (!prop || !hit) return false;
  if (looksLikePersonPage(pageTitle)) return false;
  if (mode === 'cruise') {
    // Prefer pages that clearly refer to a ship / vessel of this name.
    const core = prop.replace(/^(ms|mv|ss|m\/s|m\.s\.)\s+/i, '').trim();
    if (!hit.includes(core) && !core.includes(hit.replace(/\s*\(.*\)\s*/g, '').trim())) return false;
    if (/\b(ship|cruise|vessel|liner|riverboat|ferry)\b/.test(hit)) return true;
    if (hit === prop || hit === core || hit.includes(prop) || prop.includes(hit.replace(/\s*\(.*\)\s*/g, '').trim())) {
      return true;
    }
    return false;
  }
  if (hit === prop) return true;
  if (hit.includes(prop) || prop.includes(hit.replace(/\s*\(.*\)\s*/g, '').trim())) return true;
  const propCore = prop.replace(/\b(hotel|resort|inn|lodge|motel|apartments?|suite|suites)\b/gi, '').trim();
  if (propCore.length >= 5 && hit.includes(propCore)) return true;
  return false;
}

async function fetchWikiThumbnail(query: string, titleHint: string, mode: StayHeroMode): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=10&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    const ranked = Object.values(pages).sort((a, b) => {
      const aScore = looksLikePropertyHit(titleHint, a.title || '', mode) ? 1 : 0;
      const bScore = looksLikePropertyHit(titleHint, b.title || '', mode) ? 1 : 0;
      return bScore - aScore;
    });
    for (const page of ranked) {
      if (!looksLikePropertyHit(titleHint, page.title || '', mode)) continue;
      const src = page.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCommonsThumbnail(query: string, titleHint: string, mode: StayHeroMode): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=12&prop=imageinfo&iiprop=url|mime&iiurlwidth=640&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }
        >;
      };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      if (!looksLikePropertyHit(titleHint, page.title || '', mode)) continue;
      const info = page.imageinfo?.[0];
      if (!info) continue;
      if (info.mime && !info.mime.startsWith('image/')) continue;
      const src = info.thumburl || info.url;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

function buildQueries(name: string, place: string, mode: StayHeroMode): string[] {
  if (mode === 'cruise') {
    const river = isLikelyRiverCruise(place, name);
    const bare = name.replace(/^(ms|mv|ss|m\/s|m\.s\.)\s+/i, '').trim();
    return [
      `"${name}" cruise ship`,
      river ? `"${name}" river cruise ship` : `"${name}" ocean cruise ship`,
      bare !== name ? `"MS ${bare}" cruise ship` : '',
      place ? `"${name}" ${place}` : '',
      place ? `${place} ${bare} cruise ship` : '',
      `"${name}"`
    ].filter(Boolean);
  }
  return [
    `"${name}"`,
    `"${name}" hotel`,
    place ? `"${name}" ${place}` : '',
    `${name} hotel exterior`,
    place ? `${name} hotel ${place}` : ''
  ].filter(Boolean);
}

/** Property-specific hero: exact accommodation / ship name first. */
export async function resolveStayHeroImageUrl(
  title: string,
  location: string,
  mode: StayHeroMode
): Promise<string> {
  const key = cacheKey(title, location, mode);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  const name = title.trim();
  const place = location.trim();
  const matchHint = name;
  const queries = buildQueries(name, place, mode);

  for (const q of queries) {
    const wiki = await fetchWikiThumbnail(q, matchHint, mode);
    if (wiki) {
      cache[key] = wiki;
      saveCache(cache);
      return wiki;
    }
  }

  for (const q of queries) {
    const commons = await fetchCommonsThumbnail(
      mode === 'cruise' ? `${q} cruise ship OR vessel OR riverboat` : `${q} facade OR exterior OR building`,
      matchHint,
      mode
    );
    if (commons) {
      cache[key] = commons;
      saveCache(cache);
      return commons;
    }
  }

  const url = '';
  // Never invent AI images — leave blank so CSS shows a neutral tile until a real photo is resolved.
  if (url) {
    cache[key] = url;
    saveCache(cache);
  }
  return url || '';
}

/** Sync placeholder while async hero loads. */
export function stayHeroPlaceholderUrl(title: string, location: string, mode: StayHeroMode): string {
  const key = cacheKey(title, location, mode);
  const cached = loadCache()[key];
  return cached || '';
}

/**
 * Resolve search title: accommodation = itinerary title;
 * cruise = ship name first (so each vessel gets a distinct image), then line, then title.
 */
export function stayHeroSearchTitle(
  entry: { title?: string; cruiseLineName?: string; shipName?: string },
  mode: StayHeroMode
): string {
  if (mode === 'cruise') {
    const ship = (entry.shipName || '').trim();
    const line = (entry.cruiseLineName || '').trim();
    if (ship) return ship;
    if (line) return line;
    return (entry.title || '').trim() || 'Cruise ship';
  }
  return (entry.title || '').trim() || 'Hotel';
}

/** Place / operator string paired with stayHeroSearchTitle for caching and prompts. */
export function stayHeroSearchPlace(
  entry: { location?: string; cruiseLineName?: string },
  mode: StayHeroMode
): string {
  if (mode === 'cruise') {
    return (entry.cruiseLineName || '').trim();
  }
  return (entry.location || '').trim();
}
