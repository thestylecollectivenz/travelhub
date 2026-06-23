import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { EntryDocument, EntryDocumentType } from '../models';
import { ensureFolderChain, uploadFileToFolder } from '../utils/spFileUpload';
import { resolveSharePointMediaSrc } from '../utils/sharePointUrl';

const DOCUMENTS_LIST = 'TripDocuments';

const SELECT_WITH_SORT =
  'ID,Title,TripId,DayId,EntryId,DocumentType,FileUrl,FileName,Notes,SortOrder';
const SELECT_CORE = 'ID,Title,TripId,DayId,EntryId,DocumentType,FileUrl,FileName,Notes';

function odataEscapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function mapItem(item: Record<string, unknown>, webAbsoluteUrl: string, webServerRelativeUrl: string): EntryDocument {
  const raw = String(item.FileUrl ?? '');
  return {
    id: String(item.ID),
    title: String(item.Title ?? ''),
    tripId: String(item.TripId ?? ''),
    dayId: String(item.DayId ?? ''),
    entryId: String(item.EntryId ?? ''),
    documentType: (String(item.DocumentType ?? 'Other') as EntryDocumentType) || 'Other',
    fileUrl: resolveSharePointMediaSrc(raw, webAbsoluteUrl, webServerRelativeUrl) ?? raw,
    fileName: String(item.FileName ?? ''),
    notes: String(item.Notes ?? ''),
    sortOrder: typeof item.SortOrder === 'number' ? item.SortOrder : Number(item.SortOrder ?? 0) || 0
  };
}

export class DocumentService {
  private readonly ctx: WebPartContext;
  private readonly itemsUrl: string;

  constructor(context: WebPartContext) {
    this.ctx = context;
    const web = context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    this.itemsUrl = `${web}/_api/web/lists/getbytitle('${DOCUMENTS_LIST}')/items`;
  }

  private webPaths(): { web: string; sr: string } {
    return {
      web: this.ctx.pageContext.web.absoluteUrl.replace(/\/$/, ''),
      sr: this.ctx.pageContext.web.serverRelativeUrl.replace(/\/$/, '')
    };
  }

  private async fetchWithSelect(baseUrl: string, includeSortOrder: boolean): Promise<EntryDocument[]> {
    const select = `$select=${includeSortOrder ? SELECT_WITH_SORT : SELECT_CORE}`;
    const separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    const url = `${baseUrl}${separator}${select}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`DocumentService fetch failed: ${resp.status}`);
    const data = await resp.json();
    const { web, sr } = this.webPaths();
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item, web, sr));
  }

  private async fetchWithSelectFallback(baseUrl: string): Promise<EntryDocument[]> {
    try {
      return await this.fetchWithSelect(baseUrl, true);
    } catch (err) {
      if (String(err).indexOf('400') >= 0) {
        return this.fetchWithSelect(baseUrl, false);
      }
      throw err;
    }
  }

  async getAll(tripId: string): Promise<EntryDocument[]> {
    const safeTrip = odataEscapeString(tripId);
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const url = `${this.itemsUrl}?${filter}`;
    return this.fetchWithSelectFallback(url);
  }

  async getForEntry(entryId: string): Promise<EntryDocument[]> {
    const safeEntry = odataEscapeString(entryId);
    const filter = `$filter=EntryId eq '${safeEntry}'`;
    const url = `${this.itemsUrl}?${filter}`;
    return this.fetchWithSelectFallback(url);
  }

  async create(doc: Omit<EntryDocument, 'id'>): Promise<EntryDocument> {
    const bodyWithSort = JSON.stringify({
      Title: doc.fileName || doc.title || 'Document',
      TripId: doc.tripId,
      DayId: doc.dayId,
      EntryId: doc.entryId,
      DocumentType: doc.documentType,
      FileUrl: doc.fileUrl,
      FileName: doc.fileName,
      Notes: doc.notes ?? '',
      SortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : 0
    });
    const bodyWithoutSort = JSON.stringify({
      Title: doc.fileName || doc.title || 'Document',
      TripId: doc.tripId,
      DayId: doc.dayId,
      EntryId: doc.entryId,
      DocumentType: doc.documentType,
      FileUrl: doc.fileUrl,
      FileName: doc.fileName,
      Notes: doc.notes ?? ''
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
    if (!resp.ok) throw new Error(`DocumentService.create failed: ${resp.status}`);
    const created = await resp.json();
    const { web, sr } = this.webPaths();
    return mapItem(created, web, sr);
  }

  async update(id: string, partial: Partial<Omit<EntryDocument, 'id'>>): Promise<void> {
    const item: Record<string, unknown> = {};
    if (partial.title !== undefined) item.Title = partial.title;
    if (partial.tripId !== undefined) item.TripId = partial.tripId;
    if (partial.dayId !== undefined) item.DayId = partial.dayId;
    if (partial.entryId !== undefined) item.EntryId = partial.entryId;
    if (partial.documentType !== undefined) item.DocumentType = partial.documentType;
    if (partial.fileUrl !== undefined) item.FileUrl = partial.fileUrl;
    if (partial.fileName !== undefined) {
      item.FileName = partial.fileName;
      item.Title = partial.fileName;
    }
    if (partial.notes !== undefined) item.Notes = partial.notes;
    if (partial.sortOrder !== undefined) item.SortOrder = partial.sortOrder;

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
    if (!resp.ok && resp.status !== 204) throw new Error(`DocumentService.update failed: ${resp.status}`);
  }

  async delete(id: string): Promise<void> {
    const url = `${this.itemsUrl}(${id})`;
    const resp = await this.ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    });
    if (!resp.ok && resp.status !== 204) throw new Error(`DocumentService.delete failed: ${resp.status}`);
  }

  async uploadAndCreate(
    file: File,
    tripId: string,
    dayId: string,
    entryId: string,
    documentType: EntryDocumentType,
    notes: string,
    webAbsoluteUrl: string,
    serverRelativeUrl: string,
    sortOrder = 0,
    title?: string
  ): Promise<EntryDocument> {
    const webRoot = serverRelativeUrl.replace(/\/$/, '');
    const rootFolder = `${webRoot}/TravelHubAssets/documents`;
    const tripFolder = `${rootFolder}/${tripId}`;
    await ensureFolderChain(this.ctx, webAbsoluteUrl, [rootFolder, tripFolder]);
    const fileUrl = await uploadFileToFolder(this.ctx, webAbsoluteUrl, tripFolder, file);
    return this.create({
      title: title?.trim() || file.name,
      tripId,
      dayId,
      entryId,
      documentType,
      fileUrl,
      fileName: file.name,
      notes: notes ?? '',
      sortOrder
    });
  }
}
