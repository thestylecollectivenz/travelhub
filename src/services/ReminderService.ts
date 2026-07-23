import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ensureReminderTaskNoteLong } from './provisioning/ensureReminderTaskNoteLong';

const LIST = 'TripReminders';
/** SharePoint Text columns reject values over 255 chars — long meta goes to TaskNoteLong. */
const TASK_NOTE_TEXT_MAX = 255;

export interface TripReminder {
  id: string;
  title: string;
  tripId: string;
  dayId?: string;
  entryId?: string;
  reminderType: string;
  reminderText: string;
  /** Optional user-facing note / idea meta JSON (N1). Prefer TaskNoteLong when present. */
  taskNote?: string;
  /** Category for standalone manual tasks (TripReminders.TaskCategory). */
  taskCategory?: string;
  assignedTo?: string;
  dueDate?: string;
  isComplete: boolean;
}

function mapToReminder(item: any): TripReminder {
  const longNote =
    typeof item.TaskNoteLong === 'string' && item.TaskNoteLong.trim()
      ? item.TaskNoteLong
      : undefined;
  const shortNote = typeof item.TaskNote === 'string' ? item.TaskNote : undefined;
  return {
    id: String(item.ID),
    title: item.Title ?? '',
    tripId: item.TripId ?? '',
    dayId: item.DayId ?? '',
    entryId: item.EntryId ?? '',
    reminderType: item.ReminderType ?? 'Custom',
    reminderText: item.ReminderText ?? '',
    taskNote: longNote || shortNote || undefined,
    taskCategory: item.TaskCategory ?? undefined,
    assignedTo: item.AssignedTo ?? undefined,
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
  if (partial.taskNote !== undefined) {
    const note = partial.taskNote || '';
    if (note.length > TASK_NOTE_TEXT_MAX) {
      // Keep TaskNote under 255 with a stub — full JSON lives in TaskNoteLong.
      out.TaskNoteLong = note;
      out.TaskNote = 'meta:long';
    } else {
      out.TaskNote = note;
      out.TaskNoteLong = note;
    }
  }
  if (partial.taskCategory !== undefined) out.TaskCategory = partial.taskCategory || '';
  if (partial.assignedTo !== undefined) out.AssignedTo = partial.assignedTo || '';
  if (partial.dueDate !== undefined) out.DueDate = partial.dueDate || null;
  if (partial.isComplete !== undefined) out.IsComplete = partial.isComplete;
  return out;
}

export class ReminderService {
  private readonly baseUrl: string;
  private ensuredLongNote = false;

  constructor(private readonly ctx: WebPartContext) {
    this.baseUrl = `${ctx.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${LIST}')/items`;
  }

  private async ensureLongNoteColumn(): Promise<void> {
    if (this.ensuredLongNote) return;
    try {
      await ensureReminderTaskNoteLong(this.ctx);
      this.ensuredLongNote = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('ReminderService: could not ensure TaskNoteLong column', err);
    }
  }

  async getForTrip(tripId: string): Promise<TripReminder[]> {
    await this.ensureLongNoteColumn();
    const safeTripId = tripId.replace(/'/g, "''");
    const urlFull = `${this.baseUrl}?$select=ID,Title,TripId,DayId,EntryId,ReminderType,ReminderText,TaskNote,TaskNoteLong,TaskCategory,AssignedTo,DueDate,IsComplete&$filter=TripId eq '${safeTripId}'&$orderby=ID desc&$top=5000`;
    const urlNoLong = `${this.baseUrl}?$select=ID,Title,TripId,DayId,EntryId,ReminderType,ReminderText,TaskNote,TaskCategory,AssignedTo,DueDate,IsComplete&$filter=TripId eq '${safeTripId}'&$orderby=ID desc&$top=5000`;
    const urlLegacy = `${this.baseUrl}?$select=ID,Title,TripId,DayId,EntryId,ReminderType,ReminderText,TaskNote,AssignedTo,DueDate,IsComplete&$filter=TripId eq '${safeTripId}'&$orderby=ID desc&$top=5000`;
    let resp = await this.ctx.spHttpClient.get(urlFull, SPHttpClient.configurations.v1);
    if (!resp.ok && resp.status === 400) {
      resp = await this.ctx.spHttpClient.get(urlNoLong, SPHttpClient.configurations.v1);
    }
    if (!resp.ok && resp.status === 400) {
      // eslint-disable-next-line no-console
      console.warn('ReminderService.getForTrip: retrying without TaskNote column (provision TripReminders.TaskNote).', resp.status);
      resp = await this.ctx.spHttpClient.get(urlLegacy, SPHttpClient.configurations.v1);
    }
    if (!resp.ok) throw new Error(`ReminderService.getForTrip failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map(mapToReminder);
  }

  async create(input: Omit<TripReminder, 'id'>): Promise<TripReminder> {
    await this.ensureLongNoteColumn();
    const body = mapToSpItem(input);
    let resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
      headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
      body: JSON.stringify(body)
    });
    if (!resp.ok && resp.status === 400 && body.TaskNoteLong !== undefined) {
      const { TaskNoteLong: _long, ...shortOnly } = body;
      resp = await this.ctx.spHttpClient.post(this.baseUrl, SPHttpClient.configurations.v1, {
        headers: { 'Content-Type': 'application/json;odata.metadata=minimal', Accept: 'application/json;odata.metadata=minimal' },
        body: JSON.stringify(shortOnly)
      });
    }
    if (!resp.ok) throw new Error(`ReminderService.create failed: ${resp.status}`);
    return mapToReminder(await resp.json());
  }

  async update(id: string, partial: Partial<Omit<TripReminder, 'id' | 'tripId'>>): Promise<void> {
    await this.ensureLongNoteColumn();
    const body = mapToSpItem(partial);
    const noteLen = partial.taskNote !== undefined ? (partial.taskNote || '').length : 0;
    const needsLong = noteLen > TASK_NOTE_TEXT_MAX;
    const patch = async (payload: Record<string, unknown>): Promise<SPHttpClientResponse> =>
      this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json;odata.metadata=minimal',
          Accept: 'application/json;odata.metadata=minimal',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body: JSON.stringify(payload)
      });

    let resp = await patch(body);
    if (!resp.ok && resp.status !== 204 && resp.status === 400 && body.TaskNoteLong !== undefined) {
      // Column may still be provisioning — re-ensure once, then retry full payload.
      this.ensuredLongNote = false;
      await this.ensureLongNoteColumn();
      resp = await patch(body);
    }
    if (!resp.ok && resp.status !== 204 && resp.status === 400 && body.TaskNoteLong !== undefined && !needsLong) {
      const { TaskNoteLong: _long, ...shortOnly } = body;
      resp = await patch(shortOnly);
    }
    if (!resp.ok && resp.status !== 204) {
      if (needsLong) {
        throw new Error(
          'ReminderService.update failed: TaskNoteLong column is required for idea Q&A. Wait a moment after first open and try again.'
        );
      }
      throw new Error(`ReminderService.update failed: ${resp.status}`);
    }
  }

  async delete(id: string): Promise<void> {
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.fetch(`${this.baseUrl}(${id})`, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`ReminderService.delete failed: ${resp.status}`);
  }

  /** Remove reminders whose EntryId matches any of the given itinerary entry ids (parent or sub-item rows). */
  async deleteByEntryIds(tripId: string, entryIds: Set<string> | string[]): Promise<void> {
    const asList = entryIds instanceof Set ? Array.from(entryIds) : entryIds;
    const want = new Set(asList.map((id) => id.trim()).filter(Boolean));
    if (want.size === 0) {
      return;
    }
    let rows: TripReminder[];
    try {
      rows = await this.getForTrip(tripId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ReminderService.deleteByEntryIds: getForTrip failed', err);
      throw err;
    }
    const toRemove = rows.filter((r) => want.has((r.entryId || '').trim()));
    for (const r of toRemove) {
      try {
        await this.delete(r.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('ReminderService.deleteByEntryIds: delete item failed', r.id, err);
      }
    }
  }
}
