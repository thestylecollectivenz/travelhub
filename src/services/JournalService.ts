import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import type { JournalComment, JournalEntry, JournalPhoto } from '../models';
import { ensureFolderChain, uploadFileToFolder } from '../utils/spFileUpload';

const ENTRIES_LIST = 'JournalEntries';
const PHOTOS_LIST = 'JournalPhotos';
const COMMENTS_LIST = 'JournalComments';

function odataEscapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function parseCsvLoginNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function serializeCsvLoginNames(users: string[]): string {
  return users.join(',');
}

function mapJournalEntry(item: Record<string, unknown>): JournalEntry {
  return {
    id: String(item.ID),
    title: String(item.Title ?? ''),
    tripId: String(item.TripId ?? ''),
    dayId: String(item.DayId ?? ''),
    authorName: String(item.AuthorName ?? ''),
    entryText: String(item.EntryText ?? ''),
    location: String(item.Location ?? ''),
    entryTimestamp: typeof item.EntryTimestamp === 'string' ? item.EntryTimestamp : new Date().toISOString(),
    likeCount: typeof item.LikeCount === 'number' ? item.LikeCount : Number(item.LikeCount ?? 0) || 0,
    likedByUsers: String(item.LikedByUsers ?? ''),
    shareableLink: String(item.ShareableLink ?? '')
  };
}

function mapJournalPhoto(item: Record<string, unknown>): JournalPhoto {
  return {
    id: String(item.ID),
    title: String(item.Title ?? ''),
    journalEntryId: String(item.JournalEntryId ?? ''),
    tripId: String(item.TripId ?? ''),
    dayId: String(item.DayId ?? ''),
    fileUrl: String(item.FileUrl ?? ''),
    caption: String(item.Caption ?? '')
  };
}

function mapJournalComment(item: Record<string, unknown>): JournalComment {
  return {
    id: String(item.ID),
    title: String(item.Title ?? ''),
    journalEntryId: String(item.JournalEntryId ?? ''),
    tripId: String(item.TripId ?? ''),
    authorName: String(item.AuthorName ?? ''),
    commentText: String(item.CommentText ?? ''),
    commentTimestamp: typeof item.CommentTimestamp === 'string' ? item.CommentTimestamp : new Date().toISOString()
  };
}

export class JournalService {
  private ctx: WebPartContext;
  private entriesUrl: string;
  private photosUrl: string;
  private commentsUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    const web = context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    this.entriesUrl = `${web}/_api/web/lists/getbytitle('${ENTRIES_LIST}')/items`;
    this.photosUrl = `${web}/_api/web/lists/getbytitle('${PHOTOS_LIST}')/items`;
    this.commentsUrl = `${web}/_api/web/lists/getbytitle('${COMMENTS_LIST}')/items`;
  }

  // --- JournalEntries ---
  async getAll(tripId: string): Promise<JournalEntry[]> {
    const safeTrip = odataEscapeString(tripId);
    const select =
      '$select=ID,Title,TripId,DayId,AuthorName,EntryText,Location,EntryTimestamp,LikeCount,LikedByUsers,ShareableLink';
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const order = '$orderby=EntryTimestamp asc';
    const url = `${this.entriesUrl}?${select}&${filter}&${order}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getAll failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalEntry(item));
  }

  async getForDay(tripId: string, dayId: string): Promise<JournalEntry[]> {
    const safeTrip = odataEscapeString(tripId);
    const safeDay = odataEscapeString(dayId);
    const select =
      '$select=ID,Title,TripId,DayId,AuthorName,EntryText,Location,EntryTimestamp,LikeCount,LikedByUsers,ShareableLink';
    const filter = `$filter=TripId eq '${safeTrip}' and DayId eq '${safeDay}'`;
    const order = '$orderby=EntryTimestamp asc';
    const url = `${this.entriesUrl}?${select}&${filter}&${order}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getForDay failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalEntry(item));
  }

  async create(entry: Pick<JournalEntry, 'tripId' | 'dayId' | 'entryText' | 'location'> & Partial<Pick<JournalEntry, 'shareableLink'>>): Promise<JournalEntry> {
    const nowIso = new Date().toISOString();
    const titleIso = nowIso;
    const authorName = this.ctx.pageContext.user.displayName ?? '';
    const body = JSON.stringify({
      Title: titleIso,
      TripId: entry.tripId,
      DayId: entry.dayId,
      AuthorName: authorName,
      EntryText: entry.entryText,
      Location: entry.location ?? '',
      EntryTimestamp: nowIso,
      LikeCount: 0,
      LikedByUsers: '',
      ShareableLink: entry.shareableLink ?? ''
    });
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.entriesUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`JournalService.create entry failed: ${resp.status}`);
    const created = await resp.json();
    return mapJournalEntry(created);
  }

  async update(id: string, partial: Partial<JournalEntry>): Promise<void> {
    const url = `${this.entriesUrl}(${id})`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: Record<string, any> = {};
    if (partial.title !== undefined) item.Title = partial.title;
    if (partial.tripId !== undefined) item.TripId = partial.tripId;
    if (partial.dayId !== undefined) item.DayId = partial.dayId;
    if (partial.authorName !== undefined) item.AuthorName = partial.authorName;
    if (partial.entryText !== undefined) item.EntryText = partial.entryText;
    if (partial.location !== undefined) item.Location = partial.location;
    if (partial.entryTimestamp !== undefined) item.EntryTimestamp = partial.entryTimestamp;
    if (partial.likeCount !== undefined) item.LikeCount = partial.likeCount;
    if (partial.likedByUsers !== undefined) item.LikedByUsers = partial.likedByUsers;
    if (partial.shareableLink !== undefined) item.ShareableLink = partial.shareableLink;

    const body = JSON.stringify(item);
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`JournalService.update entry failed: ${resp.status}`);
  }

  async deleteEntry(id: string): Promise<void> {
    const url = `${this.entriesUrl}(${id})`;
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`JournalService.delete entry failed: ${resp.status}`);
  }

  /** Alias for spec wording — entries list only. */
  async delete(id: string): Promise<void> {
    return this.deleteEntry(id);
  }

  async toggleLike(
    id: string,
    currentLikeCount: number,
    likedByUsers: string,
    userId: string
  ): Promise<{ likeCount: number; likedByUsers: string }> {
    const users = parseCsvLoginNames(likedByUsers);
    const normalizedTarget = userId.trim();
    const idx = users.findIndex((u) => u.toLowerCase() === normalizedTarget.toLowerCase());

    let nextUsers: string[];
    let nextCount: number;
    if (idx >= 0) {
      nextUsers = users.filter((_, i) => i !== idx);
      nextCount = Math.max(0, currentLikeCount - 1);
    } else {
      nextUsers = [...users, normalizedTarget];
      nextCount = currentLikeCount + 1;
    }

    await this.update(id, { likeCount: nextCount, likedByUsers: serializeCsvLoginNames(nextUsers) });
    return { likeCount: nextCount, likedByUsers: serializeCsvLoginNames(nextUsers) };
  }

  async generateShareableLink(id: string, webAbsoluteUrl: string): Promise<string> {
    const base = webAbsoluteUrl.replace(/\/$/, '');
    const link = `${base}/SitePages/Travel-Hub.aspx?journalEntry=${encodeURIComponent(id)}`;
    await this.update(id, { shareableLink: link });
    return link;
  }

  // --- JournalPhotos ---
  async getForEntry(journalEntryId: string): Promise<JournalPhoto[]> {
    const safe = odataEscapeString(journalEntryId);
    const select = '$select=ID,Title,JournalEntryId,TripId,DayId,FileUrl,Caption';
    const filter = `$filter=JournalEntryId eq '${safe}'`;
    const url = `${this.photosUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getForEntry photos failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalPhoto(item));
  }

  async getForTrip(tripId: string): Promise<JournalPhoto[]> {
    const safeTrip = odataEscapeString(tripId);
    const select = '$select=ID,Title,JournalEntryId,TripId,DayId,FileUrl,Caption';
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const url = `${this.photosUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getForTrip photos failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalPhoto(item));
  }

  /** Photos list — cannot overload `getForDay` with journal entries in TypeScript. */
  async getPhotosForDay(dayId: string): Promise<JournalPhoto[]> {
    const safeDay = odataEscapeString(dayId);
    const select = '$select=ID,Title,JournalEntryId,TripId,DayId,FileUrl,Caption';
    const filter = `$filter=DayId eq '${safeDay}'`;
    const url = `${this.photosUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getForDay photos failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalPhoto(item));
  }

  async createPhoto(photo: Omit<JournalPhoto, 'id'>): Promise<JournalPhoto> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: Record<string, any> = {
      Title: photo.title,
      TripId: photo.tripId,
      DayId: photo.dayId,
      FileUrl: photo.fileUrl,
      Caption: photo.caption ?? ''
    };
    if (photo.journalEntryId && photo.journalEntryId.trim() !== '') {
      item.JournalEntryId = photo.journalEntryId;
    }

    const body = JSON.stringify(item);
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.photosUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`JournalService.createPhoto failed: ${resp.status}`);
    const created = await resp.json();
    return mapJournalPhoto(created);
  }

  async deletePhoto(id: string): Promise<void> {
    const url = `${this.photosUrl}(${id})`;
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`JournalService.deletePhoto failed: ${resp.status}`);
  }

  async uploadPhoto(
    file: File,
    tripId: string,
    dayId: string,
    journalEntryId: string | undefined,
    webAbsoluteUrl: string,
    serverRelativeUrl: string,
    caption: string
  ): Promise<JournalPhoto> {
    const webRoot = serverRelativeUrl.replace(/\/$/, '');
    const rootFolder = `${webRoot}/TravelHubAssets/journal-photos`;
    const tripFolder = `${rootFolder}/${tripId}`;
    const dayFolder = `${tripFolder}/${dayId}`;
    await ensureFolderChain(this.ctx, webAbsoluteUrl, [rootFolder, tripFolder, dayFolder]);

    const fileUrl = await uploadFileToFolder(this.ctx, webAbsoluteUrl, dayFolder, file);
    return this.createPhoto({
      title: file.name,
      journalEntryId: journalEntryId?.trim() ? journalEntryId.trim() : '',
      tripId,
      dayId,
      fileUrl,
      caption: caption ?? ''
    });
  }

  // --- JournalComments ---
  async getCommentsForEntry(journalEntryId: string): Promise<JournalComment[]> {
    const safe = odataEscapeString(journalEntryId);
    const select = '$select=ID,Title,JournalEntryId,TripId,AuthorName,CommentText,CommentTimestamp';
    const filter = `$filter=JournalEntryId eq '${safe}'`;
    const order = '$orderby=CommentTimestamp asc';
    const url = `${this.commentsUrl}?${select}&${filter}&${order}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`JournalService.getCommentsForEntry failed: ${resp.status}`);
    const data = await resp.json();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapJournalComment(item));
  }

  async createComment(journalEntryId: string, tripId: string, text: string): Promise<JournalComment> {
    const nowIso = new Date().toISOString();
    const authorName = this.ctx.pageContext.user.displayName ?? '';
    const body = JSON.stringify({
      Title: journalEntryId,
      JournalEntryId: journalEntryId,
      TripId: tripId,
      AuthorName: authorName,
      CommentText: text,
      CommentTimestamp: nowIso
    });
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.commentsUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`JournalService.createComment failed: ${resp.status}`);
    const created = await resp.json();
    return mapJournalComment(created);
  }

  async deleteComment(id: string): Promise<void> {
    const url = `${this.commentsUrl}(${id})`;
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`JournalService.deleteComment failed: ${resp.status}`);
  }

  /**
   * Returns comment counts per journal entry for a trip (JournalEntryId only — no comment bodies).
   * Paginates through all matching rows.
   */
  async getCommentCountsByEntryForTrip(tripId: string): Promise<Record<string, number>> {
    const web = this.ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const safeTrip = odataEscapeString(tripId);
    const select = '$select=ID,JournalEntryId';
    const filter = `$filter=TripId eq '${safeTrip}'`;
    let nextUrl: string | null = `${this.commentsUrl}?${select}&${filter}&$top=200`;
    const counts: Record<string, number> = {};

    const resolveNext = (raw: string): string => {
      if (raw.startsWith('http')) return raw;
      return raw.startsWith('/') ? `${web}${raw}` : `${web}/${raw}`;
    };

    while (nextUrl) {
      const resp = await this.ctx.spHttpClient.get(nextUrl, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`JournalService.getCommentCountsByEntryForTrip failed: ${resp.status}`);
      const data = (await resp.json()) as {
        value?: Record<string, unknown>[];
        '@odata.nextLink'?: string;
        'odata.nextLink'?: string;
      };
      for (const item of data.value ?? []) {
        const jid = String(item.JournalEntryId ?? '');
        if (!jid) continue;
        counts[jid] = (counts[jid] ?? 0) + 1;
      }
      const nl = data['@odata.nextLink'] ?? data['odata.nextLink'];
      nextUrl = typeof nl === 'string' && nl.length > 0 ? resolveNext(nl) : null;
    }
    return counts;
  }
}
