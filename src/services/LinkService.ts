import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { EntryLink } from '../models';

const LINKS_LIST = 'TripLinks';

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
    notes: String(item.Notes ?? '')
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

  async getAll(tripId: string): Promise<EntryLink[]> {
    const safeTrip = odataEscapeString(tripId);
    const select = '$select=ID,Title,TripId,DayId,EntryId,LinkType,Url,LinkTitle0,Notes';
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const url = `${this.itemsUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`LinkService.getAll failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item));
  }

  async getForEntry(entryId: string): Promise<EntryLink[]> {
    const safeEntry = odataEscapeString(entryId);
    const select = '$select=ID,Title,TripId,DayId,EntryId,LinkType,Url,LinkTitle0,Notes';
    const filter = `$filter=EntryId eq '${safeEntry}'`;
    const url = `${this.itemsUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`LinkService.getForEntry failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item));
  }

  async create(link: Omit<EntryLink, 'id'>): Promise<EntryLink> {
    const body = JSON.stringify({
      Title: link.linkTitle,
      TripId: link.tripId,
      DayId: link.dayId,
      EntryId: link.entryId,
      LinkType: link.linkType,
      Url: link.url,
      LinkTitle0: link.linkTitle,
      Notes: link.notes ?? ''
    });
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.itemsUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`LinkService.create failed: ${resp.status}`);
    const created = await resp.json();
    return mapItem(created);
  }

  async update(id: string, partial: Partial<Omit<EntryLink, 'id'>>): Promise<void> {
    const url = `${this.itemsUrl}(${id})`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: Record<string, any> = {};
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
    const body = JSON.stringify(item);
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*'
      },
      body
    });
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

