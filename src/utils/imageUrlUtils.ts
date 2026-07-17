/** Normalise and validate external https URLs used for photos and listings. */
export function normalizeHttpsUrl(raw: string | undefined): string | undefined {
  const url = (raw || '').trim();
  if (!url) return undefined;
  if (/^https:\/\/.+/i.test(url)) return url;
  if (/^http:\/\/.+/i.test(url)) return `https://${url.slice(7)}`;
  return undefined;
}

/** True when the URL looks like a listing/page rather than a direct image asset. */
export function isLikelyListingPageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!u.includes('tripadvisor.')) return false;
  if (u.includes('/photo') || u.includes('media-cdn') || u.includes('/img/')) return false;
  return true;
}

/** Best-effort check that a URL is plausibly an embeddable image. */
export function isLikelyImageUrl(url: string | undefined): boolean {
  const u = normalizeHttpsUrl(url);
  if (!u) return false;
  const lower = u.toLowerCase();
  if (isLikelyListingPageUrl(u)) return false;
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(lower)) return true;
  if (
    lower.includes('wikimedia.org') ||
    lower.includes('upload.wikimedia') ||
    lower.includes('googleusercontent.com') ||
    lower.includes('ggpht.com') ||
    lower.includes('media-cdn') ||
    lower.includes('/photo') ||
    lower.includes('openverse') ||
    lower.includes('pollinations.ai')
  ) {
    return true;
  }
  return false;
}

/** Probe whether an image URL actually loads in the browser (hotlink-safe check). */
export function probeImageLoads(url: string, timeoutMs = 4500): Promise<boolean> {
  const src = normalizeHttpsUrl(url);
  if (!src) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    let timer = 0;
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(ok);
    };
    timer = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}
