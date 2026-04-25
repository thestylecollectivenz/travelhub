import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import {
  ItineraryEntry,
  ItinerarySubItem,
  ItineraryDecisionStatus,
  ItineraryBookingStatus,
  ItineraryPaymentStatus,
  ItineraryUnitType
} from '../models';

const LIST = 'ItineraryEntries';

const SELECT = [
  'ID',
  'Title',
  'TripId',
  'DayId',
  'Category',
  'TimeStart',
  'Duration',
  'Supplier',
  'Location',
  'Notes',
  'DecisionStatus',
  'BookingRequired',
  'BookingStatus',
  'PaymentStatus',
  'Amount',
  'AmountPaid',
  'Currency',
  'DateStart',
  'DateEnd',
  'UnitType',
  'UnitAmount',
  'SortOrder',
  'ParentEntryId',
  'GroupLabel'
].join(',');

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseTime(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return '';
  // Already HH:MM — return as-is
  if (/^\d{2}:\d{2}$/.test(isoOrTime.trim())) return isoOrTime.trim();
  // ISO datetime — extract UTC hours/minutes (we store on fixed UTC reference date)
  try {
    const d = new Date(isoOrTime);
    if (Number.isNaN(d.getTime())) return '';
    const hh = pad2(d.getUTCHours());
    const mm = pad2(d.getUTCMinutes());
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function serializeTime(time: string | undefined): string | null {
  if (!time) return null;
  // HH:MM — store on fixed UTC reference date to avoid timezone issues
  if (/^\d{2}:\d{2}$/.test(time.trim())) {
    return `1970-01-01T${time.trim()}:00.000Z`;
  }
  // Already a full ISO string — extract time and re-serialize on reference date
  try {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) {
      return `1970-01-01T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00.000Z`;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function parseDate(isoOrDate: string | null | undefined): string | undefined {
  if (!isoOrDate) return undefined;
  const s = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return undefined;
    const yyyy = d.getUTCFullYear();
    const mm = pad2(d.getUTCMonth() + 1);
    const dd = pad2(d.getUTCDate());
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return undefined;
  }
}

function serializeDate(date: string | undefined): string | null {
  if (!date) return null;
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00:00.000Z`;
  }
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = pad2(d.getUTCMonth() + 1);
      const dd = pad2(d.getUTCDate());
      return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
    }
  } catch {
    /* fall through */
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToEntry(item: any): ItineraryEntry {
  return {
    id: String(item.ID),
    tripId: item.TripId ?? '',
    dayId: item.DayId ?? '',
    title: item.Title ?? '',
    category: item.Category ?? 'Other',
    timeStart: parseTime(item.TimeStart),
    duration: item.Duration != null ? String(item.Duration) : '',
    supplier: item.Supplier ?? '',
    location: item.Location ?? '',
    notes: item.Notes ?? '',
    decisionStatus: (item.DecisionStatus as ItineraryDecisionStatus) ?? 'Planned',
    bookingRequired: item.BookingRequired === true,
    bookingStatus: (item.BookingStatus as ItineraryBookingStatus) ?? 'Not booked',
    paymentStatus: (item.PaymentStatus as ItineraryPaymentStatus) ?? 'Not paid',
    amount: item.Amount ?? 0,
    amountPaid: item.AmountPaid ?? undefined,
    currency: item.Currency ?? 'NZD',
    dateStart: parseDate(item.DateStart),
    dateEnd: parseDate(item.DateEnd),
    unitType: item.UnitType ? (item.UnitType as ItineraryUnitType) : undefined,
    unitAmount: item.UnitAmount ?? undefined,
    sortOrder: item.SortOrder ?? 0,
    parentEntryId: item.ParentEntryId ?? undefined,
    subItems: [] // assembled separately
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToSubItem(item: any): ItinerarySubItem {
  return {
    id: String(item.ID),
    title: item.Title ?? '',
    decisionStatus: (item.DecisionStatus as ItineraryDecisionStatus) ?? 'Planned',
    paymentStatus: (item.PaymentStatus as ItineraryPaymentStatus) ?? 'Not paid',
    amount: item.Amount ?? 0,
    amountPaid: item.AmountPaid ?? undefined,
    currency: item.Currency ?? 'NZD',
    notes: item.Notes ?? '',
    groupLabel: item.GroupLabel ?? undefined
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToSpItem(entry: Partial<ItineraryEntry> & { groupLabel?: string }): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item: Record<string, any> = {};
  if (entry.title !== undefined) item.Title = entry.title;
  if (entry.tripId !== undefined) item.TripId = entry.tripId;
  if (entry.dayId !== undefined) item.DayId = entry.dayId;
  if (entry.category !== undefined) item.Category = entry.category;
  if (entry.timeStart !== undefined) item.TimeStart = serializeTime(entry.timeStart);
  if (entry.duration !== undefined) item.Duration = entry.duration ?? '';
  if (entry.supplier !== undefined) item.Supplier = entry.supplier;
  if (entry.location !== undefined) item.Location = entry.location;
  if (entry.notes !== undefined) item.Notes = entry.notes;
  if (entry.decisionStatus !== undefined) item.DecisionStatus = entry.decisionStatus;
  if (entry.bookingRequired !== undefined) item.BookingRequired = entry.bookingRequired;
  if (entry.bookingStatus !== undefined) item.BookingStatus = entry.bookingStatus;
  if (entry.paymentStatus !== undefined) item.PaymentStatus = entry.paymentStatus;
  if (entry.amount !== undefined) item.Amount = entry.amount;
  if (entry.amountPaid !== undefined) item.AmountPaid = entry.amountPaid;
  if (entry.currency !== undefined) item.Currency = entry.currency;
  if (entry.dateStart !== undefined) item.DateStart = serializeDate(entry.dateStart);
  if (entry.dateEnd !== undefined) item.DateEnd = serializeDate(entry.dateEnd);
  if (entry.unitType !== undefined) item.UnitType = entry.unitType;
  if (entry.unitAmount !== undefined) item.UnitAmount = entry.unitAmount;
  if (entry.sortOrder !== undefined) item.SortOrder = entry.sortOrder;
  if (entry.parentEntryId !== undefined) item.ParentEntryId = entry.parentEntryId;
  if (entry.groupLabel !== undefined) item.GroupLabel = entry.groupLabel;
  return item;
}

/** Assemble flat SP rows into parent entries with nested subItems arrays. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleTree(rows: any[]): ItineraryEntry[] {
  const parents: ItineraryEntry[] = [];
  const childMap: Map<string, ItinerarySubItem[]> = new Map();

  for (const row of rows) {
    if (row.ParentEntryId) {
      const sub = mapToSubItem(row);
      const existing = childMap.get(row.ParentEntryId) ?? [];
      existing.push(sub);
      childMap.set(row.ParentEntryId, existing);
    } else {
      parents.push(mapToEntry(row));
    }
  }

  return parents
    .map((p) => ({ ...p, subItems: childMap.get(p.id) ?? [] }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export class ItineraryService {
  private ctx: WebPartContext;
  private baseUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    this.baseUrl = `${context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  /** Fetch all entries (parents + sub-items) for a trip and return assembled tree. */
  async getAll(tripId: string): Promise<ItineraryEntry[]> {
    const select = `$select=${SELECT}`;
    const filter = `$filter=TripId eq '${tripId}'`;
    const orderby = '$orderby=SortOrder asc';
    const url = `${this.baseUrl}?${select}&${filter}&${orderby}&$top=5000`;
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`ItineraryService.getAll failed: ${resp.status}`);
      const data = await resp.json();
      return assembleTree(data.value ?? []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.getAll', err);
      throw err;
    }
  }

  async getById(id: string): Promise<ItineraryEntry> {
    const url = `${this.baseUrl}(${id})?$select=${SELECT}`;
    try {
      const resp: SPHttpClientResponse = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`ItineraryService.getById failed: ${resp.status}`);
      const item = await resp.json();
      return mapToEntry(item);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.getById', err);
      throw err;
    }
  }

  async create(entry: Omit<ItineraryEntry, 'id' | 'subItems'>): Promise<ItineraryEntry> {
    const body = JSON.stringify(mapToSpItem(entry));
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
      if (!resp.ok) throw new Error(`ItineraryService.create failed: ${resp.status}`);
      const data = await resp.json();
      return { ...mapToEntry(data), subItems: [] };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.create', err);
      throw err;
    }
  }

  async update(id: string, entry: Partial<ItineraryEntry>): Promise<void> {
    const url = `${this.baseUrl}(${id})`;
    const body = JSON.stringify(mapToSpItem(entry));
    try {
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
      if (!resp.ok && resp.status !== 204) throw new Error(`ItineraryService.update failed: ${resp.status}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.update', err);
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
      if (!resp.ok && resp.status !== 204) throw new Error(`ItineraryService.delete failed: ${resp.status}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.delete', err);
      throw err;
    }
  }

  /** Update SortOrder for a batch of entries after drag/drop reorder. */
  async updateSortOrders(updates: { id: string; sortOrder: number }[]): Promise<void> {
    await Promise.all(updates.map((u) => this.update(u.id, { sortOrder: u.sortOrder } as Partial<ItineraryEntry>)));
  }

  /** Move an entry to a different day. */
  async moveToDay(entryId: string, newDayId: string): Promise<void> {
    await this.update(entryId, { dayId: newDayId } as Partial<ItineraryEntry>);
  }

  /** Create a sub-item (an ItineraryEntry with parentEntryId set). */
  async createSubItem(parentEntry: ItineraryEntry, subItem: Omit<ItinerarySubItem, 'id'>): Promise<ItinerarySubItem> {
    const body = JSON.stringify({
      Title: subItem.title,
      TripId: parentEntry.tripId,
      DayId: parentEntry.dayId,
      Category: parentEntry.category,
      ParentEntryId: parentEntry.id,
      DecisionStatus: subItem.decisionStatus,
      PaymentStatus: subItem.paymentStatus,
      Amount: subItem.amount,
      AmountPaid: subItem.amountPaid ?? null,
      Currency: subItem.currency,
      Notes: subItem.notes ?? '',
      GroupLabel: subItem.groupLabel ?? '',
      SortOrder: 0,
      BookingRequired: false,
      BookingStatus: 'Not booked'
    });
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
      if (!resp.ok) throw new Error(`ItineraryService.createSubItem failed: ${resp.status}`);
      const data = await resp.json();
      return mapToSubItem(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ItineraryService.createSubItem', err);
      throw err;
    }
  }
}
