export type PlaceType =
  | 'city'
  | 'port'
  | 'airport'
  | 'region'
  | 'landmark'
  | 'accommodation'
  | 'other';

export interface Place {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  placeType: PlaceType;
  timeZone: string;
  nominatimId: string;
  /** Optional JSON string from SharePoint BestKnownFor (Phase 8). */
  bestKnownFor?: string;
}

export interface PlaceCandidate {
  title: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  placeType: string;
  timeZone: string;
  nominatimId: string;
}
