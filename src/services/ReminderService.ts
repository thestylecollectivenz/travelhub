import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const LIST = 'TripReminders';

export interface TripReminder {
  id: string;
  title: string;
  tripId: string;
  dayId?: string;
  entryId?: string;
  reminderType: string;
  reminderText: string;
  dueDate?: string;
  isComplete: boolean;
}

function mapToReminder(item: any): TripReminder {
  return {
    id: String(item.ID),
    title: item.Title ?? '',
    tripId: item.TripId ?? '',
    dayId: item.DayId ?? '',
    entryId: item.EntryId ?? '',
    reminderType: item.ReminderType ?? 'Custom',
    reminderText: item.ReminderText ?? '',
    dueDate: item.DueDate ?? undefined,
    isComplete: item.IsComplete === true
  };
}

function mapToSpItem(partial: Partial<TripReminder>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (partial.title !== undefined) out.Title = partial.title;
  if (partial.tripId !== undefined) out.TripId = partial.tripId;
  if (partial.dayId !== undefined) out.DayId = partial.dayId || '';
  if (partial.entryId !== undefined) out.EntryId = partial.entryId || '';
  if (partial.reminderType !== undefined) out.ReminderType = partial.reminderType;
  if (partial.reminderText !== undefined) out.ReminderText = partial.reminderText;
  if (partial.dueDate !== undefined) out.DueDate = partial.dueDate || null;
  if (partial.isComplete !== undefined) out.IsComplete = partial.isComplete;
  return out;
}

export class ReminderService {
  private readonly baseUrl: string;
  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  async getForTrip(tripId: string): Promise<TripReminder[]> {
    const safeTripId = tripId.replace(/'/g, "''");
    const url = `${this.baseUrl}?$select=ID,Title,TripId,DayId,EntryId,ReminderType,ReminderText,DueDate,IsComplete&$filter=TripId eq '${safeTripId}'&$orderby=ID desc&$top=5000`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`ReminderService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map(mapToReminder);
  }

  async create(input: Omit<TripReminder, 'id'>): Promise<TripReminder> {
    const resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify(mapToSpItem(input))
    });
    if (!resp.ok) throw new Error(`ReminderService.create failed: ${resp.status}`);
    return mapToReminder(await resp.json());
  }

  async update(id: string, partial: Partial<Omit<TripReminder, 'id' | 'tripId'>>): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify(mapToSpItem(partial))
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`ReminderService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`ReminderService.delete failed: ${resp.status}`);
  }
}
