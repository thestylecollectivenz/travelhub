import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { TripDay, TripDayType } from '../models';

const LIST = 'TripDays';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToDay(item: any): TripDay {
  return {
    id: String(item.ID),
    tripId: item.TripId ?? '',
    dayNumber: item.DayNumber ?? 0,
    calendarDate: item.CalendarDate ? item.CalendarDate.split('T')[0] : '',
    displayTitle: item.DisplayTitle ?? item.Title ?? '',
    dayType: (item.DayType as TripDayType) ?? 'PlacePort'
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToSpItem(day: Partial<TripDay>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item: Record<string, any> = {};
  if (day.tripId !== undefined) item.TripId = day.tripId;
  if (day.dayNumber !== undefined) item.DayNumber = day.dayNumber;
  if (day.calendarDate !== undefined) item.CalendarDate = day.calendarDate;
  if (day.displayTitle !== undefined) {
    item.DisplayTitle = day.displayTitle;
    item.Title = day.displayTitle; // Title is required by SP
  }
  if (day.dayType !== undefined) item.DayType = day.dayType;
  return item;
}

export class DayService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  async getAll(tripId: string): Promise<TripDay[]> {
    const select = '$select=ID,Title,TripId,DayNumber,CalendarDate,DisplayTitle,DayType';
    const filter = `$filter=TripId eq '${tripId}'`;
    const orderby = '$orderby=DayNumber asc';
    const url = `${this.baseUrl}?${select}&${filter}&${orderby}`;
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`DayService.getAll failed: ${resp.status}`);
      const data = await resp.json();
      return (data.value ?? []).map(mapToDay);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DayService.getAll', err);
      throw err;
    }
  }

  async getById(id: string): Promise<TripDay> {
    const select = '$select=ID,Title,TripId,DayNumber,CalendarDate,DisplayTitle,DayType';
    const url = `${this.baseUrl}(${id})?${select}`;
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`DayService.getById failed: ${resp.status}`);
      const item = await resp.json();
      return mapToDay(item);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DayService.getById', err);
      throw err;
    }
  }

  async create(day: Omit<TripDay, 'id'>): Promise<TripDay> {
    const body = JSON.stringify({
      __metadata: { type: 'SP.Data.TripDaysListItem' },
      ...mapToSpItem(day)
    });
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
        headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=verbose' },
        body
      });
      if (!resp.ok) throw new Error(`DayService.create failed: ${resp.status}`);
      const data = await resp.json();
      return mapToDay(data.d ?? data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DayService.create', err);
      throw err;
    }
  }

  /**
   * Generates and creates one TripDay per calendar day between dateStart and dateEnd (inclusive).
   * Returns the created days in order.
   */
  async generateDays(tripId: string, dateStart: string, dateEnd: string): Promise<TripDay[]> {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const created: TripDay[] = [];
    let dayNumber = 1;
    const current = new Date(start);
    while (current <= end) {
      const isoDate = current.toISOString().split('T')[0];
      // eslint-disable-next-line no-await-in-loop
      const day = await this.create({
        tripId,
        dayNumber,
        calendarDate: isoDate,
        displayTitle: `Day ${dayNumber}`,
        dayType: 'PlacePort'
      });
      created.push(day);
      dayNumber++;
      current.setDate(current.getDate() + 1);
    }
    return created;
  }

  async update(id: string, day: Partial<TripDay>): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    const body = JSON.stringify({
      __metadata: { type: 'SP.Data.TripDaysListItem' },
      ...mapToSpItem(day)
    });
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json;odata=verbose',
          Accept: 'application/json;odata=verbose',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`DayService.update failed: ${resp.status}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DayService.update', err);
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
      if (!resp.ok && resp.status !== 204) throw new Error(`DayService.delete failed: ${resp.status}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DayService.delete', err);
      throw err;
    }
  }
}
