export type PlaceType =
  | 'City'
  | 'Port'
  | 'Airport'
  | 'Region'
  | 'Landmark'
  | 'Accommodation'
  | 'Other';

export interface Place {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  country: string;
  placeType: PlaceType;
}
