import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import type { Place, PlaceCandidate } from '../models/Place';

const LIST = 'Places';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToPlace(item: any): Place {
  return {
    id: String(item.ID),
    title: item.Title ?? '',
    latitude: Number(item.Latitude ?? 0),
    longitude: Number(item.Longitude ?? 0),
    country: item.Country ?? '',
    countryCode: (item.CountryCode ?? '').toUpperCase(),
    placeType: (item.PlaceType ?? 'other').toLowerCase(),
    timeZone: item.TimeZone ?? '',
    nominatimId: item.NominatimId ?? '',
    bestKnownFor: typeof item.BestKnownFor === 'string' ? item.BestKnownFor : undefined
  } as Place;
}

function mapToSpItem(place: Partial<Place>): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  if (place.title !== undefined) item.Title = place.title;
  if (place.latitude !== undefined) item.Latitude = place.latitude;
  if (place.longitude !== undefined) item.Longitude = place.longitude;
  if (place.country !== undefined) item.Country = place.country;
  if (place.countryCode !== undefined) item.CountryCode = place.countryCode;
  if (place.placeType !== undefined) item.PlaceType = place.placeType;
  if (place.timeZone !== undefined) item.TimeZone = place.timeZone;
  if (place.nominatimId !== undefined) item.NominatimId = place.nominatimId;
  if (place.bestKnownFor !== undefined) item.BestKnownFor = place.bestKnownFor;
  return item;
}

export class PlaceService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  private async getWithBestKnownForFallback(urlWithBestKnownFor: string, urlWithoutBestKnownFor: string): Promise<SPHttpClientResponse> {
    const first = await this.ctx.spHttpClient.get(urlWithBestKnownFor, SPHttpClient.configurations.v1);
    if (first.ok || first.status !== 400) {
      return first;
    }
    // eslint-disable-next-line no-console
    console.warn('PlaceService: BestKnownFor column unavailable, retrying without it');
    return this.ctx.spHttpClient.get(urlWithoutBestKnownFor, SPHttpClient.configurations.v1);
  }

  async search(query: string): Promise<PlaceCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5&addressdetails=1`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TravelHub/1.0'
      }
    });
    if (!resp.ok) {
      throw new Error(`PlaceService.search failed: ${resp.status}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await resp.json()) as any[];
    return rows.map((r) => ({
      title: r.display_name ?? '',
      latitude: Number(r.lat ?? 0),
      longitude: Number(r.lon ?? 0),
      country: r.address?.country ?? '',
      countryCode: String(r.address?.country_code ?? '').toUpperCase(),
      placeType: String(r.type ?? 'other'),
      timeZone: '',
      nominatimId: String(r.place_id ?? '')
    }));
  }

  async getAll(): Promise<Place[]> {
    const selectWithBestKnownFor = '$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId,BestKnownFor';
    const selectBase = '$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId';
    const urlWithBestKnownFor = `${this.baseUrl}?${selectWithBestKnownFor}&$orderby=ID desc&$top=5000`;
    const urlBase = `${this.baseUrl}?${selectBase}&$orderby=ID desc&$top=5000`;
    const resp: SPHttpClientResponse = await this.getWithBestKnownForFallback(urlWithBestKnownFor, urlBase);
    if (!resp.ok) throw new Error(`PlaceService.getAll failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map(mapToPlace);
  }

  async getById(id: string): Promise<Place> {
    const selectWithBestKnownFor = '$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId,BestKnownFor';
    const selectBase = '$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId';
    const urlWithBestKnownFor = `${this.baseUrl}(${id})?${selectWithBestKnownFor}`;
    const urlBase = `${this.baseUrl}(${id})?${selectBase}`;
    const resp: SPHttpClientResponse = await this.getWithBestKnownForFallback(urlWithBestKnownFor, urlBase);
    if (!resp.ok) throw new Error(`PlaceService.getById failed: ${resp.status}`);
    return mapToPlace(await resp.json());
  }

  async create(place: Omit<Place, 'id'>): Promise<Place> {
    if (place.nominatimId) {
      const safe = place.nominatimId.replace(/'/g, "''");
      const dedupeWithBestKnownFor = `${this.baseUrl}?$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId,BestKnownFor&$filter=NominatimId eq '${safe}'&$top=1`;
      const dedupeBase = `${this.baseUrl}?$select=ID,Title,Latitude,Longitude,Country,CountryCode,PlaceType,TimeZone,NominatimId&$filter=NominatimId eq '${safe}'&$top=1`;
      const existingResp: SPHttpClientResponse = await this.getWithBestKnownForFallback(dedupeWithBestKnownFor, dedupeBase);
      if (existingResp.ok) {
        const existingData = await existingResp.json();
        const existing = (existingData.value ?? [])[0];
        if (existing) return mapToPlace(existing);
      }
    }

    const body = JSON.stringify(
      mapToSpItem({
        ...place,
        title: place.title
      })
    );
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`PlaceService.create failed: ${resp.status}`);
    return mapToPlace(await resp.json());
  }

  async update(id: string, partial: Partial<Place>): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    const body = JSON.stringify(mapToSpItem(partial));
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`PlaceService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: {
        'IF-MATCH': '*',
        'X-HTTP-Method': 'DELETE'
      }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`PlaceService.delete failed: ${resp.status}`);
  }
}
