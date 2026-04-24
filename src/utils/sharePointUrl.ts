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
