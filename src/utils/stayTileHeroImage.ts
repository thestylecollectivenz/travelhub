const CACHE_KEY = 'travelhub-stay-hero-images-v4';

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

function pollinationsFallback(title: string, location: string, mode: StayHeroMode): string {
  const subject =
    mode === 'cruise'
      ? `real photograph of cruise ship "${title}"${location ? ` operated by / at ${location}` : ''}, ship exterior hull and superstructure`
      : `real photograph of the hotel facade of "${title}"${location ? ` in ${location}` : ''}, building front entrance exterior only, not cityscape`;
  const prompt = encodeURIComponent(
    `${subject}, photorealistic travel photography, sharp facade detail, no illustration, no collage, no text, no watermark`
  );
  const seed = encodeURIComponent(`${cacheKey(title, location, mode)}|facade-v4`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=640&height=480&nologo=true&seed=${seed}`;
}

function looksLikePropertyHit(title: string, pageTitle: string): boolean {
  const prop = title.trim().toLowerCase();
  const hit = pageTitle.trim().toLowerCase();
  if (!prop || !hit) return false;
  // Prefer exact / near-exact property name matches — avoid city or country pages.
  if (hit === prop) return true;
  if (hit.includes(prop) || prop.includes(hit.replace(/\s*\(.*\)\s*/g, '').trim())) return true;
  const propCore = prop.replace(/\b(hotel|resort|inn|lodge|motel|apartments?|suite|suites|cruise|ship)\b/gi, '').trim();
  if (propCore.length >= 5 && hit.includes(propCore)) return true;
  return false;
}

async function fetchWikiThumbnail(query: string, titleHint: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=8&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    const ranked = Object.values(pages).sort((a, b) => {
      const aScore = looksLikePropertyHit(titleHint, a.title || '') ? 1 : 0;
      const bScore = looksLikePropertyHit(titleHint, b.title || '') ? 1 : 0;
      return bScore - aScore;
    });
    for (const page of ranked) {
      if (!looksLikePropertyHit(titleHint, page.title || '')) continue;
      const src = page.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCommonsThumbnail(query: string, titleHint: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=640&format=json&origin=*`;
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
      if (!looksLikePropertyHit(titleHint, page.title || '')) continue;
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
    return [
      `"${name}"`,
      `"${name}" cruise ship`,
      `${name} cruise ship`,
      place ? `${name} ${place}` : ''
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

/** Property-specific hero: exact accommodation / cruise-line+ship name first. */
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
    const wiki = await fetchWikiThumbnail(q, matchHint);
    if (wiki) {
      cache[key] = wiki;
      saveCache(cache);
      return wiki;
    }
  }

  for (const q of queries) {
    const commons = await fetchCommonsThumbnail(
      mode === 'cruise' ? `${q} ship OR vessel` : `${q} facade OR exterior OR building`,
      matchHint
    );
    if (commons) {
      cache[key] = commons;
      saveCache(cache);
      return commons;
    }
  }

  const url = pollinationsFallback(name, place, mode);
  cache[key] = url;
  saveCache(cache);
  return url;
}

/** Sync placeholder while async hero loads. */
export function stayHeroPlaceholderUrl(title: string, location: string, mode: StayHeroMode): string {
  const key = cacheKey(title, location, mode);
  const cached = loadCache()[key];
  return cached || pollinationsFallback(title, location, mode);
}

/** Resolve search title for accommodation (exact itinerary title) or cruise (line + ship). */
export function stayHeroSearchTitle(
  entry: { title?: string; cruiseLineName?: string; shipName?: string },
  mode: StayHeroMode
): string {
  if (mode === 'cruise') {
    const line = (entry.cruiseLineName || '').trim();
    const ship = (entry.shipName || '').trim();
    if (line && ship) return `${line} ${ship}`;
    if (ship) return ship;
    if (line) return line;
  }
  return (entry.title || '').trim() || (mode === 'cruise' ? 'Cruise ship' : 'Hotel');
}
