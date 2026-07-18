import {
  confidenceAdjustedRating,
  dedupeNearbyPlaces,
  distanceMetresBetween,
  filterNearbyPlaces,
  formatDistanceMetres,
  isNearbyCacheValid,
  nearbyDirectionsUrl,
  nearbyLocationKey,
  normalizePlaceName,
  rankNearbyPlaces,
  type NearbyPlace
} from './nearbyPlaceModel';
import { nearbyCategoryConfig } from './nearbyCategoryConfig';

function makePlace(overrides: Partial<NearbyPlace>): NearbyPlace {
  return {
    id: 'g:abc',
    source: 'google',
    sourcePlaceId: 'abc',
    name: 'Test Place',
    categoryId: 'restaurants',
    latitude: -41.29,
    longitude: 174.78,
    distanceMetres: 500,
    directionsUrl: '',
    lastVerifiedAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

const restaurants = nearbyCategoryConfig('restaurants')!;

describe('nearbyPlaceModel distance', () => {
  it('formats metres below 1 km and km above', () => {
    expect(formatDistanceMetres(350)).toBe('350 m');
    expect(formatDistanceMetres(999)).toBe('999 m');
    expect(formatDistanceMetres(1400)).toBe('1.4 km');
  });

  it('computes straight-line distance with haversine', () => {
    // Wellington Cable Car top to Botanic Garden main gate ≈ a few hundred metres.
    const metres = distanceMetresBetween(-41.2843, 174.7737, -41.2820, 174.7680);
    expect(metres).toBeGreaterThan(300);
    expect(metres).toBeLessThan(800);
  });
});

describe('nearbyDirectionsUrl', () => {
  it('includes origin, destination and walking mode', () => {
    const url = nearbyDirectionsUrl(48.123, 7.456, 48.2, 7.5);
    expect(url).toContain('origin=48.123%2C7.456');
    expect(url).toContain('destination=48.2%2C7.5');
    expect(url).toContain('travelmode=walking');
    expect(url).not.toContain('destination_place_id');
  });

  it('includes destination_place_id for Google places', () => {
    const url = nearbyDirectionsUrl(48.123, 7.456, 48.2, 7.5, 'ChIJabc123');
    expect(url).toContain('destination_place_id=ChIJabc123');
  });
});

describe('deduplication', () => {
  it('removes duplicate Google place ids', () => {
    const a = makePlace({ id: 'g:1', sourcePlaceId: '1' });
    const b = makePlace({ id: 'g:1', sourcePlaceId: '1', name: 'Test Place Again' });
    expect(dedupeNearbyPlaces([a, b])).toHaveLength(1);
  });

  it('prefers Google over an OSM duplicate within 40 metres', () => {
    const osm = makePlace({
      id: 'osm:node:9',
      source: 'openstreetmap',
      sourcePlaceId: 'osm:node:9',
      name: 'Nikau Cafe',
      latitude: -41.29001,
      longitude: 174.78001
    });
    const google = makePlace({
      id: 'g:2',
      sourcePlaceId: '2',
      name: 'Nikau Café',
      latitude: -41.29,
      longitude: 174.78
    });
    const out = dedupeNearbyPlaces([osm, google]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('google');
  });

  it('keeps two branches of the same chain when physically separate', () => {
    const a = makePlace({ id: 'g:3', sourcePlaceId: '3', name: 'Chain Coffee', latitude: -41.29 });
    const b = makePlace({ id: 'g:4', sourcePlaceId: '4', name: 'Chain Coffee', latitude: -41.3 });
    expect(dedupeNearbyPlaces([a, b])).toHaveLength(2);
  });
});

describe('name normalisation', () => {
  it('lowercases, strips punctuation and legal suffixes', () => {
    expect(normalizePlaceName("Bob's Bakery Ltd.")).toBe('bob s bakery');
    expect(normalizePlaceName('  CAFÉ   Uno ')).toBe('cafe uno');
  });
});

describe('filtering', () => {
  it('excludes permanently closed places and results without coordinates', () => {
    const closed = makePlace({ id: 'g:5', sourcePlaceId: '5', businessStatus: 'CLOSED_PERMANENTLY' });
    const noCoords = makePlace({ id: 'g:6', sourcePlaceId: '6', latitude: NaN });
    const ok = makePlace({ id: 'g:7', sourcePlaceId: '7' });
    const out = filterNearbyPlaces([closed, noCoords, ok], restaurants);
    expect(out.map((p) => p.id)).toEqual(['g:7']);
  });

  it('excludes results well outside the configured radius', () => {
    const far = makePlace({ id: 'g:8', sourcePlaceId: '8', distanceMetres: restaurants.defaultRadiusMetres * 2 });
    expect(filterNearbyPlaces([far], restaurants)).toHaveLength(0);
  });
});

describe('ranking', () => {
  it('prefers a credible popular result over a 5-star with 2 reviews', () => {
    expect(confidenceAdjustedRating(4.7, 1000)).toBeGreaterThan(confidenceAdjustedRating(5.0, 2));
    const popular = makePlace({ id: 'g:a', sourcePlaceId: 'a', rating: 4.7, reviewCount: 1000 });
    const sparse = makePlace({ id: 'g:b', sourcePlaceId: 'b', rating: 5.0, reviewCount: 2 });
    const ranked = rankNearbyPlaces([sparse, popular], restaurants);
    expect(ranked[0].id).toBe('g:a');
  });

  it('caps to the category maximum and is deterministic', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makePlace({ id: `g:${i}`, sourcePlaceId: String(i), name: `Place ${i}`, distanceMetres: 100 + i })
    );
    const ranked = rankNearbyPlaces(many, restaurants);
    expect(ranked).toHaveLength(restaurants.maximumResults);
    expect(rankNearbyPlaces(many, restaurants).map((p) => p.id)).toEqual(ranked.map((p) => p.id));
  });
});

describe('cache validity', () => {
  const results = [makePlace({})];

  it('is valid before expiry with results', () => {
    const payload = { results, expiresAt: new Date(Date.now() + 60000).toISOString() };
    expect(isNearbyCacheValid(payload)).toBe(true);
  });

  it('is invalid after expiry or with no results', () => {
    expect(isNearbyCacheValid({ results, expiresAt: new Date(Date.now() - 60000).toISOString() })).toBe(false);
    expect(isNearbyCacheValid({ results: [], expiresAt: new Date(Date.now() + 60000).toISOString() })).toBe(false);
    expect(isNearbyCacheValid(undefined)).toBe(false);
  });
});

describe('location key', () => {
  it('rounds coordinates to 5 decimals and scopes by entry id', () => {
    expect(nearbyLocationKey(48.1234567, 7.4567891)).toBe('coordinates:48.12346:7.45679');
    expect(nearbyLocationKey(48.1, 7.4, 'entry9')).toBe('location:entry9:48.10000:7.40000');
  });
});
