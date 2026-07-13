const CACHE_KEY = 'travelhub-stay-hero-images';

type CacheRow = Record<string, string>;

function cacheKey(title: string, location: string, mode: 'accommodation' | 'cruise'): string {
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

function pollinationsFallback(title: string, location: string, mode: 'accommodation' | 'cruise'): string {
  const subject =
    mode === 'cruise'
      ? `official photo of cruise ship ${title} ${location}`
      : `official exterior photo of hotel ${title} ${location}`;
  const prompt = encodeURIComponent(`${subject}, realistic travel photography, no text, no watermark`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=480&height=320&nologo=true&seed=${encodeURIComponent(cacheKey(title, location, mode))}`;
}

async function fetchWikimediaThumbnail(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

/** Property-specific hero image: Wikimedia when available, unique Pollinations fallback per hotel/cruise. */
export async function resolveStayHeroImageUrl(
  title: string,
  location: string,
  mode: 'accommodation' | 'cruise'
): Promise<string> {
  const key = cacheKey(title, location, mode);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  const query =
    mode === 'cruise'
      ? `${title} cruise ship`.trim()
      : `${title} hotel ${location}`.trim();
  const wiki = await fetchWikimediaThumbnail(query);
  const url = wiki || pollinationsFallback(title, location, mode);
  cache[key] = url;
  saveCache(cache);
  return url;
}

/** Sync placeholder while async hero loads. */
export function stayHeroPlaceholderUrl(title: string, location: string, mode: 'accommodation' | 'cruise'): string {
  const key = cacheKey(title, location, mode);
  const cached = loadCache()[key];
  return cached || pollinationsFallback(title, location, mode);
}
