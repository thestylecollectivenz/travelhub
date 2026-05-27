export type LocationInfoAIEventDetail = {
  entryId: string;
  loading: boolean;
  section?: 'sights' | 'food' | 'drink' | 'souvenirs' | 'all' | 'qa';
  error?: string;
  success?: boolean;
};

export const LOCATION_INFO_AI_EVENT = 'travelhub-location-info-ai';

export function emitLocationInfoAIStatus(detail: LocationInfoAIEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCATION_INFO_AI_EVENT, { detail }));
}

export function subscribeLocationInfoAIStatus(
  entryId: string,
  listener: (detail: LocationInfoAIEventDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (ev: Event): void => {
    const d = (ev as CustomEvent<LocationInfoAIEventDetail>).detail;
    if (!d || d.entryId !== entryId) return;
    listener(d);
  };

  window.addEventListener(LOCATION_INFO_AI_EVENT, handler as EventListener);
  return () => window.removeEventListener(LOCATION_INFO_AI_EVENT, handler as EventListener);
}
