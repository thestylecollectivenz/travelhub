import { nominatimFetch } from './nominatimThrottle';

export type ResolvedPlacePhoto = {
  imageUrl: string;
  /** Google Maps place listing (directory) — preferred click target for Explore cards. */
  sourceUrl: string;
  /** Official website when Places Details returns one (hotels). */
  websiteUrl?: string;
  /** Where the image bytes came from — helps verify Google vs fallback. */
  provider?: 'google' | 'wikipedia' | 'commons' | 'openverse' | 'other';
  /** Official Google Places name when resolved (may differ from AI short name). */
  displayName?: string;
  placeId?: string;
};

type CacheRow = Record<string, ResolvedPlacePhoto>;

const CACHE_KEY = 'travelhub-place-photos-v1';

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

function cacheKey(kind: string, a: string, b?: string): string {
  return `${kind}|${a.trim().toLowerCase()}|${(b || '').trim().toLowerCase()}`;
}

type WikiHit = { title: string; thumb?: string; pageUrl?: string };

async function wikiSearch(query: string): Promise<WikiHit[]> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=8&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=960&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<string, { title?: string; fullurl?: string; thumbnail?: { source?: string } }>;
      };
    };
    const pages = data.query?.pages;
    if (!pages) return [];
    return Object.values(pages)
      .map((p) => ({
        title: (p.title || '').trim(),
        thumb: p.thumbnail?.source,
        pageUrl: p.fullurl
      }))
      .filter((p) => p.title && p.thumb);
  } catch {
    return [];
  }
}

async function commonsSearch(query: string): Promise<WikiHit[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=8&prop=imageinfo|info&inprop=url&iiprop=url|mime&iiurlwidth=960&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            fullurl?: string;
            imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string; descriptionurl?: string }>;
          }
        >;
      };
    };
    const pages = data.query?.pages;
    if (!pages) return [];
    const out: WikiHit[] = [];
    for (const p of Object.values(pages)) {
      const info = p.imageinfo?.[0];
      if (!info || (info.mime && !info.mime.startsWith('image/'))) continue;
      const thumb = info.thumburl || info.url;
      if (!thumb) continue;
      out.push({
        title: (p.title || '').trim(),
        thumb,
        pageUrl: info.descriptionurl || p.fullurl
      });
    }
    return out;
  } catch {
    return [];
  }
}

function scoreHit(hit: WikiHit, needles: string[]): number {
  const t = hit.title.toLowerCase();
  let score = 0;
  for (const n of needles) {
    const nrm = n.toLowerCase().trim();
    if (!nrm || nrm.length < 2) continue;
    if (t === nrm) score += 8;
    else if (t.includes(nrm)) score += 4;
  }
  if (/\b(disambiguation|surname|given name|album|film|song)\b/i.test(hit.title)) score -= 10;
  return score;
}

async function resolveFromQueries(
  queries: string[],
  needles: string[],
  commonsExtra?: string
): Promise<ResolvedPlacePhoto | null> {
  for (const q of queries) {
    const hits = await wikiSearch(q);
    const ranked = [...hits].sort((a, b) => scoreHit(b, needles) - scoreHit(a, needles));
    for (const hit of ranked) {
      if (scoreHit(hit, needles) < 1) continue;
      if (hit.thumb && hit.pageUrl) {
        return { imageUrl: hit.thumb, sourceUrl: hit.pageUrl };
      }
    }
  }
  for (const q of queries) {
    const cq = commonsExtra ? `${q} ${commonsExtra}` : q;
    const hits = await commonsSearch(cq);
    const ranked = [...hits].sort((a, b) => scoreHit(b, needles) - scoreHit(a, needles));
    for (const hit of ranked) {
      if (scoreHit(hit, needles) < 0) continue;
      if (hit.thumb && hit.pageUrl) {
        return { imageUrl: hit.thumb, sourceUrl: hit.pageUrl };
      }
    }
  }
  return null;
}

/** Real destination photo from Wikipedia/Commons — never AI-generated imagery. */
export async function resolveDestinationHeroPhoto(
  placeName: string,
  country?: string
): Promise<ResolvedPlacePhoto | null> {
  const name = placeName.trim();
  const ctry = (country || '').trim();
  if (!name) return null;
  const key = cacheKey('hero', name, ctry);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  const queries = [
    ctry ? `${name}, ${ctry}` : name,
    `${name} (city)`,
    ctry ? `${name} ${ctry} skyline` : `${name} skyline`,
    name
  ].filter(Boolean);
  const hit = await resolveFromQueries(queries, [name, ctry].filter(Boolean), 'skyline OR landmark OR cityscape');
  if (hit) {
    cache[key] = hit;
    saveCache(cache);
  }
  return hit;
}

/** Real venue/attraction photo — Wikipedia/Commons only. */
export async function resolveExplorePlacePhoto(
  placeName: string,
  city?: string
): Promise<ResolvedPlacePhoto | null> {
  const name = placeName.trim();
  const locality = (city || '').trim();
  if (!name) return null;
  const key = cacheKey('place', name, locality);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  const queries = [
    locality ? `"${name}" ${locality}` : `"${name}"`,
    locality ? `${name} ${locality}` : name,
    name
  ].filter(Boolean);
  const hit = await resolveFromQueries(queries, [name, locality].filter(Boolean), 'building OR facade OR exterior');
  if (hit) {
    cache[key] = hit;
    saveCache(cache);
  }
  return hit;
}

/** Optional Nominatim reverse to a map feature page-style Wikipedia title (best-effort). */
export async function nominatimMapFeatureUrl(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&extratags=1`;
    const resp = await nominatimFetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as { osm_type?: string; osm_id?: number };
    if (data.osm_type && data.osm_id) {
      const type = data.osm_type === 'node' ? 'node' : data.osm_type === 'way' ? 'way' : 'relation';
      return `https://www.openstreetmap.org/${type}/${data.osm_id}`;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}
