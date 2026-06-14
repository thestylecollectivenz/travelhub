import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { EntryLink } from '../models';

const LINKS_LIST = 'TripLinks';

const SELECT_WITH_SORT =
  'ID,Title,TripId,DayId,EntryId,LinkType,Url,LinkTitle0,Notes,SortOrder';
const SELECT_CORE = 'ID,Title,TripId,DayId,EntryId,LinkType,Url,LinkTitle0,Notes';

function odataEscapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function mapItem(item: Record<string, unknown>): EntryLink {
  return {
    id: String(item.ID),
    title: String(item.Title ?? ''),
    tripId: String(item.TripId ?? ''),
    dayId: String(item.DayId ?? ''),
    entryId: String(item.EntryId ?? ''),
    linkType: String(item.LinkType ?? 'Url') as EntryLink['linkType'],
    url: String(item.Url ?? ''),
    linkTitle: String(item.LinkTitle0 ?? ''),
    notes: String(item.Notes ?? ''),
    sortOrder: typeof item.SortOrder === 'number' ? item.SortOrder : Number(item.SortOrder ?? 0) || 0
  };
}

export class LinkService {
  private readonly ctx: WebPartContext;
  private readonly itemsUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    const web = context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    this.itemsUrl = `${web}/_api/web/lists/getbytitle('${LINKS_LIST}')/items`;
  }

  private async fetchWithSelect(baseUrl: string, includeSortOrder: boolean): Promise<EntryLink[]> {
    const select = `$select=${includeSortOrder ? SELECT_WITH_SORT : SELECT_CORE}`;
    const separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    const url = `${baseUrl}${separator}${select}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`LinkService fetch failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item));
  }

  private async fetchWithSelectFallback(baseUrl: string): Promise<EntryLink[]> {
    try {
      return await this.fetchWithSelect(baseUrl, true);
    } catch (err) {
      if (String(err).indexOf('400') >= 0) {
        // eslint-disable-next-line no-console
        console.warn('LinkService: SortOrder unavailable, retrying without');
        return this.fetchWithSelect(baseUrl, false);
      }
      throw err;
    }
  }

  async getAll(tripId: string): Promise<EntryLink[]> {
    const safeTrip = odataEscapeString(tripId);
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const url = `${this.itemsUrl}?${filter}`;
    return this.fetchWithSelectFallback(url);
  }

  async getForEntry(entryId: string): Promise<EntryLink[]> {
    const safeEntry = odataEscapeString(entryId);
    const filter = `$filter=EntryId eq '${safeEntry}'`;
    const url = `${this.itemsUrl}?${filter}`;
    return this.fetchWithSelectFallback(url);
  }

  async create(link: Omit<EntryLink, 'id'>): Promise<EntryLink> {
    const bodyWithSort = JSON.stringify({
      Title: link.linkTitle,
      TripId: link.tripId,
      DayId: link.dayId,
      EntryId: link.entryId,
      LinkType: link.linkType,
      Url: link.url,
      LinkTitle0: link.linkTitle,
      Notes: link.notes ?? '',
      SortOrder: typeof link.sortOrder === 'number' ? link.sortOrder : 0
    });
    const bodyWithoutSort = JSON.stringify({
      Title: link.linkTitle,
      TripId: link.tripId,
      DayId: link.dayId,
      EntryId: link.entryId,
      LinkType: link.linkType,
      Url: link.url,
      LinkTitle0: link.linkTitle,
      Notes: link.notes ?? ''
    });

    let resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.itemsUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body: bodyWithSort
    });
    if (!resp.ok && resp.status === 400) {
      resp = await this.ctx.spHttpClient.post(this.itemsUrl, SPHttpClient.configurations.v1, {
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal'
        },
        body: bodyWithoutSort
      });
    }
    if (!resp.ok) throw new Error(`LinkService.create failed: ${resp.status}`);
    const created = await resp.json();
    return mapItem(created);
  }

  async update(id: string, partial: Partial<Omit<EntryLink, 'id'>>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildItem = (includeSortOrder: boolean): Record<string, any> => {
      const item: Record<string, unknown> = {};
      if (partial.title !== undefined) item.Title = partial.title;
      if (partial.tripId !== undefined) item.TripId = partial.tripId;
      if (partial.dayId !== undefined) item.DayId = partial.dayId;
      if (partial.entryId !== undefined) item.EntryId = partial.entryId;
      if (partial.linkType !== undefined) item.LinkType = partial.linkType;
      if (partial.url !== undefined) item.Url = partial.url;
      if (partial.linkTitle !== undefined) {
        item.LinkTitle0 = partial.linkTitle;
        item.Title = partial.linkTitle;
      }
      if (partial.notes !== undefined) item.Notes = partial.notes;
      if (includeSortOrder && partial.sortOrder !== undefined) item.SortOrder = partial.sortOrder;
      return item;
    };

    await this.patch(id, buildItem(true));
  }

  private async patch(id: string, item: Record<string, unknown>): Promise<void> {
    const url = `${this.itemsUrl}(${id})`;
    const attempt = async (body: Record<string, unknown>): Promise<SPHttpClientResponse> =>
      this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal',
          'IF-MATCH': '*'
        },
        body: JSON.stringify(body)
      });

    let resp = await attempt(item);
    if (!resp.ok && resp.status === 400 && item.SortOrder !== undefined) {
      const { SortOrder: _sortOrder, ...rest } = item;
      if (Object.keys(rest).length > 0) {
        resp = await attempt(rest);
      }
    }
    if (!resp.ok && resp.status !== 204) throw new Error(`LinkService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const url = `${this.itemsUrl}(${id})`;
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`LinkService.delete failed: ${resp.status}`);
  }
}
