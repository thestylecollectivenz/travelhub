import { isLikelyImageUrl, normalizeHttpsUrl, probeImageLoads } from './imageUrlUtils';
import { resolveVenueListingPhoto } from './venueListingPhoto';

const CACHE_KEY = 'travelhub-stay-hero-images-v8';

type CacheRow = Record<string, string>;
type MetaCacheRow = Record<string, { imageUrl: string; clickUrl: string; displayName?: string }>;
const META_CACHE_KEY = 'travelhub-stay-hero-meta-v8';

export type StayHeroMode = 'accommodation' | 'cruise';

export type StayHeroResolved = {
  imageUrl: string;
  /** TripAdvisor or official website when known; else Maps search. */
  clickUrl: string;
  displayName?: string;
};

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

function pollinationsFallback(title: string, location: string, mode: StayHeroMode): string {
  const subject =
    mode === 'cruise'
      ? `photograph of cruise ship ${title}${location ? ` operated by ${location}` : ''}, exterior, realistic`
      : `photograph of ${title} hotel exterior${location ? ` in ${location}` : ''}, building facade, realistic`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(subject)}?width=800&height=500&nologo=true&seed=${encodeURIComponent(
    `${mode}-${title}-${location}`.slice(0, 48)
  )}`;
}

function looksLikePersonPage(pageTitle: string): boolean {
  const t = pageTitle.trim().toLowerCase();
  if (/\b(singer|actor|actress|footballer|athlete|politician|writer|author|musician|biography|disambiguation)\b/.test(t)) {
    return true;
  }
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
    const core = prop.replace(/^(ms|mv|ss|m\/s|m\.s\.)\s+/i, '').trim();
    const hitCore = hit.replace(/\s*\(.*\)\s*/g, '').trim();
    if (hit.includes(core) || core.includes(hitCore) || hit === prop || hit === core) return true;
    if (/\b(ship|cruise|vessel|liner|riverboat|ferry)\b/.test(hit) && core.length >= 3 && hit.includes(core.split(/\s+/)[0])) {
      return true;
    }
    return false;
  }
  if (hit === prop) return true;
  if (hit.includes(prop) || prop.includes(hit.replace(/\s*\(.*\)\s*/g, '').trim())) return true;
  const propCore = prop.replace(/\b(hotel|resort|inn|lodge|motel|apartments?|suite|suites)\b/gi, '').trim();
  if (propCore.length >= 4 && hit.includes(propCore)) return true;
  const first = propCore.split(/\s+/).find((w) => w.length >= 5);
  if (first && hit.includes(first)) return true;
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

function listingFallbackUrl(title: string, location: string): string {
  const q = [title, location].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

async function resolveLegacyStayImage(
  name: string,
  place: string,
  mode: StayHeroMode,
  key: string,
  cache: CacheRow
): Promise<string> {
  if (cache[key]) return cache[key];
  const matchHint = name;
  const queries = buildQueries(name, place, mode);

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

  const url = pollinationsFallback(name, place, mode);
  cache[key] = url;
  saveCache(cache);
  return url;
}

function loadMetaCache(): MetaCacheRow {
  try {
    const raw = window.sessionStorage.getItem(META_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as MetaCacheRow) : {};
  } catch {
    return {};
  }
}

function saveMetaCache(row: MetaCacheRow): void {
  try {
    window.sessionStorage.setItem(META_CACHE_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

async function resolveGeminiStayMedia(
  name: string,
  place: string,
  mode: StayHeroMode,
  apiKey: string
): Promise<{ imageUrl?: string; clickUrl?: string; displayName?: string } | null> {
  const key = (apiKey || '').trim();
  if (!key) return null;
  const subject =
    mode === 'cruise'
      ? `cruise ship "${name}"${place ? ` (${place})` : ''}`
      : `hotel/accommodation "${name}"${place ? ` in ${place}` : ''}`;
  const prompt =
    `Find media for ${subject}. Respond with ONLY JSON (no markdown):\n` +
    `{"displayName":"official name","tripadvisorUrl":"https://...","websiteUrl":"https://...","photoUrl":"https://..."}\n` +
    `Rules:\n` +
    `- Prefer TripAdvisor listing URL when a real listing exists; otherwise omit tripadvisorUrl\n` +
    `- photoUrl: exterior of the ${mode === 'cruise' ? 'ship' : 'building'} from TripAdvisor or official site — NO people, NO interiors-only when exterior exists\n` +
    `- websiteUrl: official site when known\n` +
    `- Omit any field you are not confident is a real URL — never invent URLs`;
  try {
    const { GEMINI_MODEL_FALLBACK_CHAIN } = await import('../services/GeminiService');
    for (const model of GEMINI_MODEL_FALLBACK_CHAIN) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
        })
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as {
        displayName?: string;
        tripadvisorUrl?: string;
        websiteUrl?: string;
        photoUrl?: string;
      };
      const photoUrl = (parsed.photoUrl || '').trim();
      const clickUrl =
        normalizeHttpsUrl(parsed.tripadvisorUrl) || normalizeHttpsUrl(parsed.websiteUrl) || undefined;
      if (!photoUrl && !clickUrl) continue;
      let imageUrl: string | undefined;
      if (photoUrl && isLikelyImageUrl(photoUrl) && (await probeImageLoads(photoUrl))) {
        imageUrl = photoUrl;
      }
      return {
        imageUrl,
        clickUrl,
        displayName: (parsed.displayName || '').trim() || undefined
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Prefer Gemini TripAdvisor-first exterior media; fall back to Commons/Pollinations.
 * Wikipedia is NOT used for hotel/cruise heroes (reserved for Location Info overview).
 */
export async function resolveStayHero(
  title: string,
  location: string,
  mode: StayHeroMode,
  googleMapsApiKey?: string,
  geminiApiKey?: string
): Promise<StayHeroResolved> {
  const name = title.trim() || (mode === 'cruise' ? 'Cruise ship' : 'Hotel');
  const place = location.trim();
  const clickFallback = listingFallbackUrl(name, place);
  const key = cacheKey(name, place, mode);
  const cache = loadCache();
  const meta = loadMetaCache();
  if (meta[key]?.imageUrl) {
    return meta[key];
  }

  const geminiKey = (geminiApiKey || '').trim();
  if (geminiKey) {
    const hit = await resolveGeminiStayMedia(name, place, mode, geminiKey);
    if (hit?.imageUrl || hit?.clickUrl) {
      let imageUrl = (hit.imageUrl || '').trim();
      if (imageUrl && !(await probeImageLoads(imageUrl))) {
        imageUrl = '';
      }
      if (!imageUrl) {
        const venue = await resolveVenueListingPhoto({
          name,
          address: place,
          city: place,
          googleMapsApiKey
        });
        imageUrl = (venue?.imageUrl || '').trim() || (await resolveLegacyStayImage(name, place, mode, key, cache));
      }
      const resolved: StayHeroResolved = {
        imageUrl,
        clickUrl: (hit.clickUrl || '').trim() || clickFallback,
        displayName: hit.displayName
      };
      meta[key] = resolved;
      saveMetaCache(meta);
      cache[key] = imageUrl;
      saveCache(cache);
      return resolved;
    }
  }

  const venue = await resolveVenueListingPhoto({
    name,
    address: place,
    city: place,
    googleMapsApiKey
  });
  const imageUrl =
    (venue?.imageUrl || '').trim() || (await resolveLegacyStayImage(name, place, mode, key, cache));
  const { placeWebsiteSearchUrl } = await import('./googleMapsLink');
  const resolved: StayHeroResolved = {
    imageUrl,
    clickUrl: placeWebsiteSearchUrl(name, place) || clickFallback
  };
  meta[key] = resolved;
  saveMetaCache(meta);
  return resolved;
}

/** Prefer resolveStayHero — kept for call sites that only need an image URL. */
export async function resolveStayHeroImageUrl(
  title: string,
  location: string,
  mode: StayHeroMode,
  googleMapsApiKey?: string,
  geminiApiKey?: string
): Promise<string> {
  const hit = await resolveStayHero(title, location, mode, googleMapsApiKey, geminiApiKey);
  return hit.imageUrl;
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
  entry: { location?: string; cruiseLineName?: string; streetAddress?: string },
  mode: StayHeroMode
): string {
  if (mode === 'cruise') {
    return (entry.cruiseLineName || '').trim();
  }
  return (entry.streetAddress || entry.location || '').trim();
}
