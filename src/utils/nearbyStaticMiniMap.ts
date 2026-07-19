/**
 * Free OSM static mini-map URLs for functional Explore cards (no Google Photos).
 * Uses the community staticmap.openstreetmap.de endpoint — no API key, no
 * Places Photo quota. Attribution must remain visible in the UI.
 */

export interface MiniMapPoint {
  lat: number;
  lng: number;
}

function valid(p: MiniMapPoint | undefined): p is MiniMapPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Midpoint between two coordinates (good enough for local walk distances). */
function midPoint(a: MiniMapPoint, b: MiniMapPoint): MiniMapPoint {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Build a 16:9 static map image URL showing the destination pin, and when
 * available the starting point as a second marker.
 */
export function nearbyStaticMiniMapUrl(options: {
  destination: MiniMapPoint;
  origin?: MiniMapPoint;
  width?: number;
  height?: number;
  zoom?: number;
}): string | undefined {
  const dest = options.destination;
  if (!valid(dest)) return undefined;
  const width = Math.max(200, Math.min(options.width || 640, 800));
  const height = Math.max(120, Math.min(options.height || 360, 450));
  const origin = valid(options.origin) ? options.origin : undefined;
  const centre = origin ? midPoint(origin, dest) : dest;
  // Slightly wider zoom when both points are present so the route fits.
  const zoom = options.zoom ?? (origin ? 15 : 16);
  const markers = origin
    ? `${origin.lat},${origin.lng},lightblue1|${dest.lat},${dest.lng},red-pushpin`
    : `${dest.lat},${dest.lng},red-pushpin`;
  return (
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${centre.lat},${centre.lng}` +
    `&zoom=${zoom}` +
    `&size=${width}x${height}` +
    `&maptype=mapnik` +
    `&markers=${markers}`
  );
}
