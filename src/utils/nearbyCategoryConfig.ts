import type { ExploreCategoryId } from './exploreCategories';

/**
 * Central configuration for factual nearby-place searches (Explore, and later Near Me).
 *
 * Data rules:
 * - Google Places (Maps JS Places library) is the primary factual source.
 * - OpenStreetMap Overpass is the fallback when Google returns fewer than
 *   `minimumResults` suitable places.
 * - Gemini is never used to discover or invent venues, URLs, coordinates,
 *   ratings or opening data.
 *
 * Google type names below are legacy Places API types — the project already
 * depends on the legacy Maps JS `PlacesService`, so we intentionally stay on it.
 */
export interface NearbyCategoryConfig {
  id: ExploreCategoryId;
  label: string;
  /** Legacy Places API types for nearbySearch (one request per type). */
  googleTypes: string[];
  /** Controlled text queries for textSearch when types alone are not enough. */
  googleTextQueries: string[];
  /**
   * Google results whose PRIMARY type (types[0]) is in this list are dropped —
   * e.g. hotels with in-house restaurants surface under type=restaurant but
   * their primary type is 'lodging'.
   */
  googleExcludedPrimaryTypes?: string[];
  /** OSM tag filters for the Overpass fallback (each entry is one selector). */
  osmTags: Array<Record<string, string>>;
  defaultRadiusMetres: number;
  minimumResults: number;
  maximumResults: number;
  /** Ranking signal only — never an absolute exclusion when options are few. */
  minimumReviewCount?: number;
  /** Cache lifetime for stored result sets. */
  cacheTtlDays: number;
}

const CONFIGS: NearbyCategoryConfig[] = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    googleTypes: ['restaurant'],
    googleTextQueries: [],
    googleExcludedPrimaryTypes: [
      'lodging',
      'meal_takeaway',
      'meal_delivery',
      'gas_station',
      'supermarket',
      'grocery_or_supermarket',
      'convenience_store',
      'night_club'
    ],
    osmTags: [{ amenity: 'restaurant' }],
    defaultRadiusMetres: 2500,
    minimumResults: 6,
    maximumResults: 12,
    minimumReviewCount: 10,
    cacheTtlDays: 21
  },
  {
    id: 'cafes',
    label: 'Cafés',
    googleTypes: ['cafe'],
    googleTextQueries: ['coffee'],
    googleExcludedPrimaryTypes: ['lodging', 'gas_station', 'supermarket', 'grocery_or_supermarket'],
    osmTags: [{ amenity: 'cafe' }],
    defaultRadiusMetres: 2000,
    minimumResults: 6,
    maximumResults: 12,
    minimumReviewCount: 10,
    cacheTtlDays: 21
  },
  {
    id: 'shopping',
    label: 'Shopping',
    googleTypes: ['shopping_mall', 'department_store', 'clothing_store'],
    googleTextQueries: [],
    osmTags: [{ shop: 'department_store' }, { shop: 'clothes' }, { shop: 'mall' }],
    defaultRadiusMetres: 4000,
    minimumResults: 6,
    maximumResults: 12,
    cacheTtlDays: 30
  },
  {
    id: 'sights',
    label: 'Sights',
    googleTypes: ['tourist_attraction', 'church', 'museum'],
    googleTextQueries: ['landmark', 'cathedral', 'historic site', 'tourist attraction'],
    googleExcludedPrimaryTypes: [
      'lodging',
      'restaurant',
      'bar',
      'cafe',
      'night_club',
      'travel_agency',
      'real_estate_agency'
    ],
    osmTags: [
      { tourism: 'attraction' },
      { tourism: 'museum' },
      { historic: 'monument' },
      { historic: 'castle' },
      { historic: 'church' },
      { historic: 'ruins' },
      { building: 'cathedral' },
      { amenity: 'place_of_worship' }
    ],
    defaultRadiusMetres: 5000,
    minimumResults: 6,
    maximumResults: 12,
    cacheTtlDays: 60
  },
  {
    id: 'bakeries',
    label: 'Bakeries',
    googleTypes: ['bakery'],
    googleTextQueries: ['patisserie'],
    googleExcludedPrimaryTypes: ['lodging', 'supermarket', 'grocery_or_supermarket'],
    osmTags: [{ shop: 'bakery' }],
    defaultRadiusMetres: 2500,
    minimumResults: 4,
    maximumResults: 10,
    cacheTtlDays: 30
  },
  {
    id: 'groceries',
    label: 'Groceries',
    googleTypes: ['supermarket', 'convenience_store'],
    googleTextQueries: [],
    osmTags: [{ shop: 'supermarket' }, { shop: 'convenience' }, { shop: 'greengrocer' }],
    defaultRadiusMetres: 2500,
    minimumResults: 4,
    maximumResults: 10,
    cacheTtlDays: 30
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    googleTypes: ['pharmacy', 'drugstore'],
    googleTextQueries: [],
    osmTags: [{ amenity: 'pharmacy' }],
    defaultRadiusMetres: 3000,
    minimumResults: 3,
    maximumResults: 8,
    cacheTtlDays: 30
  },
  {
    id: 'parks',
    label: 'Parks',
    googleTypes: ['park'],
    googleTextQueries: ['garden'],
    osmTags: [{ leisure: 'park' }, { leisure: 'garden' }],
    defaultRadiusMetres: 4000,
    minimumResults: 4,
    maximumResults: 10,
    cacheTtlDays: 90
  },
  {
    id: 'museums',
    label: 'Museums',
    googleTypes: ['museum', 'art_gallery'],
    googleTextQueries: [],
    osmTags: [{ tourism: 'museum' }, { tourism: 'gallery' }],
    defaultRadiusMetres: 6000,
    minimumResults: 4,
    maximumResults: 10,
    cacheTtlDays: 60
  },
  {
    id: 'markets',
    label: 'Markets',
    googleTypes: [],
    googleTextQueries: ['food market', 'farmers market', 'market hall'],
    osmTags: [{ amenity: 'marketplace' }],
    defaultRadiusMetres: 5000,
    minimumResults: 3,
    maximumResults: 10,
    cacheTtlDays: 30
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    googleTypes: ['bar', 'night_club'],
    googleTextQueries: ['cocktail bar', 'wine bar'],
    googleExcludedPrimaryTypes: ['lodging'],
    osmTags: [{ amenity: 'bar' }, { amenity: 'pub' }, { amenity: 'nightclub' }],
    defaultRadiusMetres: 4000,
    minimumResults: 5,
    maximumResults: 10,
    minimumReviewCount: 10,
    cacheTtlDays: 21
  },
  {
    id: 'viewpoints',
    label: 'Viewpoints',
    googleTypes: [],
    googleTextQueries: ['viewpoint', 'scenic lookout', 'observation deck'],
    osmTags: [{ tourism: 'viewpoint' }],
    defaultRadiusMetres: 10000,
    minimumResults: 3,
    maximumResults: 10,
    cacheTtlDays: 90
  },
  {
    id: 'atm',
    label: 'ATM',
    googleTypes: ['atm'],
    googleTextQueries: [],
    osmTags: [{ amenity: 'atm' }],
    defaultRadiusMetres: 2000,
    minimumResults: 3,
    maximumResults: 8,
    cacheTtlDays: 30
  },
  {
    id: 'restroom',
    label: 'Restrooms',
    googleTypes: [],
    googleTextQueries: ['public toilet', 'public restroom'],
    osmTags: [{ amenity: 'toilets' }],
    defaultRadiusMetres: 1500,
    minimumResults: 2,
    maximumResults: 8,
    cacheTtlDays: 90
  },
  {
    id: 'transport',
    label: 'Transport',
    googleTypes: ['train_station', 'transit_station', 'bus_station'],
    googleTextQueries: [],
    osmTags: [{ railway: 'station' }, { amenity: 'bus_station' }, { highway: 'bus_stop' }],
    defaultRadiusMetres: 2500,
    minimumResults: 3,
    maximumResults: 10,
    cacheTtlDays: 90
  },
  {
    id: 'medical',
    label: 'Medical',
    googleTypes: ['hospital', 'doctor'],
    googleTextQueries: ['medical centre', 'urgent care'],
    osmTags: [{ amenity: 'hospital' }, { amenity: 'clinic' }, { amenity: 'doctors' }],
    defaultRadiusMetres: 5000,
    minimumResults: 2,
    maximumResults: 8,
    cacheTtlDays: 60
  },
  {
    id: 'fuel',
    label: 'Fuel',
    googleTypes: ['gas_station'],
    googleTextQueries: [],
    osmTags: [{ amenity: 'fuel' }],
    defaultRadiusMetres: 5000,
    minimumResults: 2,
    maximumResults: 8,
    cacheTtlDays: 60
  }
];

export function nearbyCategoryConfig(id: ExploreCategoryId): NearbyCategoryConfig | undefined {
  return CONFIGS.find((c) => c.id === id);
}

export function allNearbyCategoryConfigs(): NearbyCategoryConfig[] {
  return CONFIGS.slice();
}
