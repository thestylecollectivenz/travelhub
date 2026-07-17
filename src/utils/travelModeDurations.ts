import { haversineKm } from './distanceUtils';

export type TravelModeDurations = {
  walkMinutes?: number;
  driveMinutes?: number;
  transitMinutes?: number;
};

function formatOsrmMinutes(seconds: number | undefined): number | undefined {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return undefined;
  return Math.max(1, Math.round(Number(seconds) / 60));
}

async function osrmMinutes(
  profile: 'walking' | 'driving',
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number | undefined> {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as { routes?: Array<{ duration?: number }> };
    return formatOsrmMinutes(data.routes?.[0]?.duration);
  } catch {
    return undefined;
  }
}

/** Walking + driving minutes from real road routing (OSRM). Transit left unset (no free GTFS). */
export async function resolveTravelModeDurations(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<TravelModeDurations> {
  const straight = haversineKm(fromLat, fromLng, toLat, toLng);
  if (!Number.isFinite(straight) || straight > 80) return {};

  const [walkMinutes, driveMinutes] = await Promise.all([
    osrmMinutes('walking', fromLat, fromLng, toLat, toLng),
    osrmMinutes('driving', fromLat, fromLng, toLat, toLng)
  ]);

  // Separate haversine fallbacks — never copy walk onto drive.
  const walk =
    walkMinutes ??
    (straight > 0 ? Math.max(1, Math.round((straight * 1000 * 1.25) / 80)) : undefined);
  const drive =
    driveMinutes ??
    (straight > 0.05 ? Math.max(1, Math.round((straight * 1.35 * 60) / 32)) : undefined);

  return {
    walkMinutes: walk && walk <= 180 ? walk : undefined,
    driveMinutes: drive && drive <= 180 ? drive : undefined,
    transitMinutes: undefined
  };
}

export function formatModeMinutes(mins: number | undefined): string {
  if (!Number.isFinite(Number(mins)) || Number(mins) <= 0) return '—';
  return `${Math.round(Number(mins))} min`;
}
