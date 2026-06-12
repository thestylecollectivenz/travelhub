/** Resize hints for SharePoint Online image URLs (document library thumbnails). */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?|$)/i;

function isRasterImageUrl(url: string): boolean {
  if (!url?.trim()) return false;
  if (IMAGE_EXT.test(url)) return true;
  return url.toLowerCase().includes('/journal-photos/');
}

function appendQueryParam(url: string, key: string, value: string): string {
  const hashIdx = url.indexOf('#');
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${key}=${encodeURIComponent(value)}${hash}`;
}

/** Smaller src for grid thumbnails — reduces scroll jank and memory. */
export function journalPhotoThumbUrl(fileUrl: string, maxEdge = 320): string {
  if (!isRasterImageUrl(fileUrl)) return fileUrl;
  return appendQueryParam(fileUrl, 'width', String(maxEdge));
}

/** Moderate size for print/PDF — faster load than full upload resolution. */
export function journalPhotoPrintUrl(fileUrl: string, maxEdge = 520): string {
  if (!isRasterImageUrl(fileUrl)) return fileUrl;
  return appendQueryParam(fileUrl, 'width', String(maxEdge));
}
