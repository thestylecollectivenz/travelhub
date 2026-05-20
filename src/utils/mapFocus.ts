export const TRAVELHUB_MAP_FOCUS = 'travelhub-map-focus';

export interface MapFocusDetail {
  latitude: number;
  longitude: number;
  title?: string;
}

export function requestMapFocus(latitude: number, longitude: number, title?: string): void {
  window.dispatchEvent(
    new CustomEvent<MapFocusDetail>(TRAVELHUB_MAP_FOCUS, {
      detail: { latitude, longitude, title }
    })
  );
}
