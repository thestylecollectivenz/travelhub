import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient } from '@microsoft/sp-http';
import type { NearbySearchCachePayload } from '../utils/nearbyPlaceModel';
import { NEARBY_CACHE_REQUEST_VERSION } from '../utils/nearbyPlaceModel';

const LIST = 'NearbySearchCache';

export interface NearbyCacheRow {
  itemId: number;
  locationKey: string;
  categoryId: string;
  radiusMetres: number;
  payload: NearbySearchCachePayload;
}

/**
 * SharePoint-backed cache for nearby-place result sets (shared trip-wide).
 * Failures never block the search flow — a broken cache degrades to a live call.
 */
export class NearbySearchCacheService {
  private readonly baseUrl: string;

  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  async get(locationKey: string, categoryId: string): Promise<NearbyCacheRow | null> {
    try {
      const safeKey = locationKey.replace(/'/g, "''");
      const safeCat = categoryId.replace(/'/g, "''");
      const safeVer = NEARBY_CACHE_REQUEST_VERSION.replace(/'/g, "''");
      const url =
        `${this.baseUrl}?$select=ID,LocationKey,CategoryId,RadiusMetres,ResultsJson,SearchedAt,ExpiresAt` +
        `&$filter=LocationKey eq '${safeKey}' and CategoryId eq '${safeCat}' and RequestVersion eq '${safeVer}'` +
        `&$orderby=Modified desc&$top=1`;
      const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) return null;
      const data = await resp.json();
      const item = (data.value ?? [])[0];
      if (!item) return null;
      const parsed = JSON.parse(item.ResultsJson || 'null') as { results?: unknown } | null;
      if (!parsed || !Array.isArray(parsed.results)) return null;
      return {
        itemId: Number(item.ID),
        locationKey: item.LocationKey ?? '',
        categoryId: item.CategoryId ?? '',
        radiusMetres: Number(item.RadiusMetres) || 0,
        payload: {
          results: parsed.results as NearbySearchCachePayload['results'],
          searchedAt: item.SearchedAt || '',
          expiresAt: item.ExpiresAt || '',
          googleResultCount: Number((parsed as NearbySearchCachePayload).googleResultCount) || 0,
          osmResultCount: Number((parsed as NearbySearchCachePayload).osmResultCount) || 0
        }
      };
    } catch {
      return null;
    }
  }

  async upsert(
    locationKey: string,
    categoryId: string,
    radiusMetres: number,
    origin: { lat: number; lng: number },
    payload: NearbySearchCachePayload
  ): Promise<void> {
    const body = JSON.stringify({
      Title: `${categoryId} @ ${locationKey}`.slice(0, 250),
      LocationKey: locationKey,
      CategoryId: categoryId,
      RadiusMetres: radiusMetres,
      OriginLat: origin.lat,
      OriginLng: origin.lng,
      ResultsJson: JSON.stringify({
        results: payload.results,
        googleResultCount: payload.googleResultCount,
        osmResultCount: payload.osmResultCount
      }),
      SearchedAt: payload.searchedAt,
      ExpiresAt: payload.expiresAt,
      RequestVersion: NEARBY_CACHE_REQUEST_VERSION
    });
    try {
      const existing = await this.get(locationKey, categoryId);
      if (existing) {
        const resp = await this.ctx.spHttpClient.fetch(
          `${this.baseUrl}(${existing.itemId})`,
          SPHttpClient.configurations.v1,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json;odata.metadata=minimal',
              Accept: 'application/json;odata.metadata=minimal',
              'IF-MATCH': '*',
              'X-HTTP-Method': 'MERGE'
            },
            body
          }
        );
        if (!resp.ok && resp.status !== 204) {
          // eslint-disable-next-line no-console
          console.warn('NearbySearchCacheService.upsert update failed', resp.status);
        }
        return;
      }
      const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal'
        },
        body
      });
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.warn('NearbySearchCacheService.upsert create failed', resp.status);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('NearbySearchCacheService.upsert error', err);
    }
  }
}
