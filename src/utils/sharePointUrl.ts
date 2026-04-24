/**
 * Join a SharePoint web absolute URL with a server-relative path without duplicating the site segment.
 * Example bug: base `https://host/sites/foo` + rel `/sites/foo/TravelHubAssets/x.jpg` → doubled `/sites/foo/sites/foo/...`
 */
export function joinWebAbsoluteAndServerRelative(webAbsoluteUrl: string, serverRelativePath: string): string {
  const base = webAbsoluteUrl.replace(/\/$/, '');
  let rel = serverRelativePath.trim();
  if (!rel) return base;

  if (!rel.startsWith('/')) {
    rel = `/${rel}`;
  }

  let pathname = '';
  try {
    pathname = new URL(base).pathname.replace(/\/$/, '');
  } catch {
    pathname = '';
  }

  if (pathname && (rel === pathname || rel.startsWith(`${pathname}/`))) {
    rel = rel.slice(pathname.length) || '/';
    if (!rel.startsWith('/')) {
      rel = `/${rel}`;
    }
  }

  return `${base}${rel}`;
}

/** Collapse accidental doubled site roots like `/sites/foo/sites/foo/...` → `/sites/foo/...`. */
export function collapseDoubledSitesPath(pathname: string): string {
  const normalized = pathname.replace(/\/+/g, '/');
  return normalized.replace(/(\/sites\/[^/]+)\1(?=\/)/gi, '$1');
}

/** Older bad URLs used `TravelHub/assets` instead of the provisioned `TravelHubAssets` folder. */
export function fixTravelHubAssetsFolderTypo(pathname: string): string {
  return pathname.replace(/\/TravelHub\/assets\//i, '/TravelHubAssets/');
}

export function normalizeSharePointHeroUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    let path = u.pathname || '';
    path = collapseDoubledSitesPath(path);
    path = fixTravelHubAssetsFolderTypo(path);
    u.pathname = path;
    return u.toString();
  } catch {
    if (trimmed.startsWith('/')) {
      let path = trimmed;
      path = collapseDoubledSitesPath(path);
      path = fixTravelHubAssetsFolderTypo(path);
      return path;
    }
    return trimmed;
  }
}

/**
 * Resolve stored SharePoint file URLs for use in <img src> (hero, journal photos, album).
 * Handles doubled site roots, TravelHubAssets path typo, http→https in secure contexts, and server-relative paths.
 */
export function resolveSharePointMediaSrc(
  raw: string,
  webAbsoluteUrl: string,
  webServerRelativeUrl: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https:\/\//i.test(trimmed)) return normalizeSharePointHeroUrl(trimmed);
  if (/^http:\/\//i.test(trimmed)) {
    if (typeof window !== 'undefined' && window.isSecureContext) {
      return normalizeSharePointHeroUrl(`https://${trimmed.slice('http://'.length)}`);
    }
    return normalizeSharePointHeroUrl(trimmed);
  }
  if (trimmed.startsWith('//')) {
    const proto = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return normalizeSharePointHeroUrl(`${proto}${trimmed}`);
  }
  const base = webAbsoluteUrl.replace(/\/$/, '');
  const webRoot = webServerRelativeUrl.replace(/\/$/, '');
  if (trimmed.startsWith('/')) {
    return normalizeSharePointHeroUrl(joinWebAbsoluteAndServerRelative(base, trimmed));
  }
  const rel = trimmed.replace(/^\/+/, '');
  if (webRoot) {
    return normalizeSharePointHeroUrl(joinWebAbsoluteAndServerRelative(base, `${webRoot}/${rel}`));
  }
  return normalizeSharePointHeroUrl(joinWebAbsoluteAndServerRelative(base, `/${rel}`));
}
