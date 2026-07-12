const CACHE_KEY = 'travelhub-stay-tile-images';

type CacheRow = Record<string, string>;

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
    // ignore quota errors
  }
}

/** Decorative AI-style image URL for stay/cruise tiles (cached per entry). */
export function stayTileAiImageUrl(
  entryId: string,
  title: string,
  location: string,
  mode: 'accommodation' | 'cruise'
): string {
  const cache = loadCache();
  if (cache[entryId]) return cache[entryId];
  const subject =
    mode === 'cruise'
      ? `luxury cruise ship at sea ${title} ${location}`
      : `boutique hotel exterior ${title} ${location}`;
  const prompt = encodeURIComponent(`${subject}, warm travel photography, no text, no watermark`);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=480&height=240&nologo=true`;
  cache[entryId] = url;
  saveCache(cache);
  return url;
}
