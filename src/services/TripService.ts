import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { Trip, TripLifecycleStatus } from '../models';

const LIST = 'Trips';

const TRIP_SELECT_CORE =
  'ID,Title,Destination,DateStart,DateEnd,HeroImageUrl,Status,SharedViewEnabled,Description';
const TRIP_SELECT_WITH_AUTHOR = `${TRIP_SELECT_CORE},ShowAuthorName`;
const TRIP_SELECT_FULL = `${TRIP_SELECT_WITH_AUTHOR},ShowJournalEntryDate`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToTrip(item: any): Trip {
  const sn = item.ShowAuthorName;
  const showAuthorName = sn === false || sn === 'No' ? false : true;
  const sjd = item.ShowJournalEntryDate;
  const showJournalEntryDate = sjd === false || sjd === 'No' ? false : true;
  return {
    id: String(item.ID),
    title: item.Title ?? '',
    destination: item.Destination ?? '',
    dateStart: item.DateStart ? item.DateStart.split('T')[0] : '',
    dateEnd: item.DateEnd ? item.DateEnd.split('T')[0] : '',
    heroImageUrl: item.HeroImageUrl ?? '',
    status: (item.Status as TripLifecycleStatus) ?? 'Planning',
    sharedViewEnabled: item.SharedViewEnabled === true,
    showAuthorName,
    showJournalEntryDate,
    description: item.Description ?? ''
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToSpItem(trip: Partial<Trip>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item: Record<string, any> = {};
  if (trip.title !== undefined) item.Title = trip.title;
  if (trip.destination !== undefined) item.Destination = trip.destination;
  if (trip.dateStart !== undefined) item.DateStart = trip.dateStart;
  if (trip.dateEnd !== undefined) item.DateEnd = trip.dateEnd;
  if (trip.heroImageUrl !== undefined) item.HeroImageUrl = trip.heroImageUrl;
  if (trip.status !== undefined) item.Status = trip.status;
  if (trip.sharedViewEnabled !== undefined) item.SharedViewEnabled = trip.sharedViewEnabled;
  if (trip.showAuthorName !== undefined) item.ShowAuthorName = trip.showAuthorName;
  if (trip.showJournalEntryDate !== undefined) item.ShowJournalEntryDate = trip.showJournalEntryDate;
  if (trip.description !== undefined) item.Description = trip.description;
  return item;
}

export class TripService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  /** SharePoint rejects $select when a column is not provisioned yet — fall back gracefully. */
  private async getWithSelectFallback(itemUrl: string): Promise<Record<string, unknown>> {
    const selects = [TRIP_SELECT_FULL, TRIP_SELECT_WITH_AUTHOR, TRIP_SELECT_CORE];
    let lastStatus = 0;
    for (const fields of selects) {
      const url = `${itemUrl}${itemUrl.includes('?') ? '&' : '?'}$select=${fields}`;
      // eslint-disable-next-line no-await-in-loop
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (resp.ok) {
        return resp.json();
      }
      lastStatus = resp.status;
      if (resp.status !== 400 && resp.status !== 404) {
        break;
      }
    }
    throw new Error(`TripService.get failed: ${lastStatus || 'unknown'}`);
  }

  async getAll(): Promise<Trip[]> {
    const orderby = '$orderby=DateStart desc';
    const url = `${this.baseUrl}?${orderby}`;
    try {
      const data = await this.getWithSelectFallback(url);
      return ((data.value as Record<string, unknown>[]) ?? []).map((item) => mapToTrip(item));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripService.getAll', err);
      throw err;
    }
  }

  async getById(id: string): Promise<Trip> {
    const url = `${this.baseUrl}(${id})`;
    try {
      const item = await this.getWithSelectFallback(url);
      return mapToTrip(item);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripService.getById', err);
      throw err;
    }
  }

  async create(trip: Omit<Trip, 'id'>): Promise<Trip> {
    const body = JSON.stringify(mapToSpItem(trip));
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(
        this.baseUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Content-Type': 'application/json;odata.metadata=minimal',
            Accept: 'application/json;odata.metadata=minimal'
          },
          body
        }
      );
      if (!resp.ok) throw new Error(`TripService.create failed: ${resp.status}`);
      const data = await resp.json();
      return mapToTrip(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripService.create', err);
      throw err;
    }
  }

  async update(id: string, trip: Partial<Trip>): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    const fullItem = mapToSpItem(trip);
    const withoutJournalDate = { ...fullItem };
    delete withoutJournalDate.ShowJournalEntryDate;
    const withoutOptional = { ...withoutJournalDate };
    delete withoutOptional.ShowAuthorName;

    const payloads = [fullItem, withoutJournalDate, withoutOptional];
    let lastStatus = 0;
    try {
      for (const item of payloads) {
        if (!Object.keys(item).length) continue;
        const body = JSON.stringify(item);
        // eslint-disable-next-line no-await-in-loop
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
        if (resp.ok || resp.status === 204) {
          return;
        }
        lastStatus = resp.status;
        if (resp.status !== 400) {
          break;
        }
      }
      throw new Error(`TripService.update failed: ${lastStatus}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripService.update', err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
        method: 'DELETE',
        headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`TripService.delete failed: ${resp.status}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TripService.delete', err);
      throw err;
    }
  }
}
