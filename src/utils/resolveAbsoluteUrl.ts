/** Resolves server-relative SharePoint URLs so window.open targets a real tab. */
export function resolveAbsoluteUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return u;
  }
}
