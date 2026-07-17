import type { ResolvedPlacePhoto } from './placePhotoResolve';
import { resolveDestinationHeroPhoto, resolveExplorePlacePhoto } from './placePhotoResolve';
import { resolveVenueListingPhoto } from './venueListingPhoto';
import { isLikelyImageUrl, normalizeHttpsUrl, probeImageLoads } from './imageUrlUtils';
import { placeQueryMapsUrl } from './googleMapsLink';

export type PlaceCardPhotoInput = {
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  photoKind?: 'landmark' | 'venue';
  photoUrl?: string;
  tripadvisorUrl?: string;
  websiteUrl?: string;
  googleMapsApiKey?: string;
};

function listingClickUrl(input: PlaceCardPhotoInput): string {
  return (
    normalizeHttpsUrl(input.tripadvisorUrl) ||
    normalizeHttpsUrl(input.websiteUrl) ||
    placeQueryMapsUrl(input.name, input.address) ||
    ''
  );
}

async function tryProvidedPhoto(input: PlaceCardPhotoInput): Promise<ResolvedPlacePhoto | null> {
  const imageUrl = (input.photoUrl || '').trim();
  if (!imageUrl || !isLikelyImageUrl(imageUrl)) return null;
  const loads = await probeImageLoads(imageUrl);
  if (!loads) return null;
  return {
    imageUrl,
    sourceUrl: listingClickUrl(input),
    displayName: input.name,
    provider: 'other'
  };
}

async function resolveFromServices(input: PlaceCardPhotoInput): Promise<ResolvedPlacePhoto | null> {
  const city = (input.city || '').trim();
  const click = listingClickUrl(input);

  if (input.photoKind === 'landmark') {
    const hero = (await resolveDestinationHeroPhoto(input.name, city)) || (await resolveExplorePlacePhoto(input.name, city));
    if (hero?.imageUrl) {
      return { ...hero, sourceUrl: click || hero.sourceUrl };
    }
  }

  const venue = await resolveVenueListingPhoto({
    name: input.name,
    address: input.address,
    city,
    latitude: input.latitude,
    longitude: input.longitude,
    googleMapsApiKey: input.googleMapsApiKey
  });
  if (venue?.imageUrl) {
    return {
      ...venue,
      sourceUrl: click || venue.sourceUrl || venue.websiteUrl || venue.sourceUrl
    };
  }

  const landmark = await resolveExplorePlacePhoto(input.name, city);
  if (landmark?.imageUrl) {
    return { ...landmark, sourceUrl: click || landmark.sourceUrl };
  }

  if (venue?.sourceUrl || click) {
    return {
      imageUrl: '',
      sourceUrl: click || venue?.sourceUrl || '',
      displayName: venue?.displayName || input.name,
      provider: undefined
    };
  }

  return null;
}

/** Resolve a card photo: try Gemini/TripAdvisor URL, then Google/Commons/Openverse/Wikipedia fallbacks. */
export async function resolvePlaceCardPhoto(input: PlaceCardPhotoInput): Promise<ResolvedPlacePhoto | null> {
  const provided = await tryProvidedPhoto(input);
  if (provided?.imageUrl) return provided;
  return resolveFromServices(input);
}
