export const MAP_PLACE_SELECT_EVENT = 'travelhub-map-place-select';

export interface MapPlaceSelectDetail {
  placeKey: string;
  label: string;
  placeId?: string;
}

export function requestMapPlaceSelect(detail: MapPlaceSelectDetail | null): void {
  window.dispatchEvent(
    new CustomEvent<MapPlaceSelectDetail | null>(MAP_PLACE_SELECT_EVENT, {
      detail
    })
  );
}
