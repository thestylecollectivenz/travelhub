import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import type { EntryDocument, EntryDocumentType } from '../models';
import { ensureFolderChain, uploadFileToFolder } from '../utils/spFileUpload';
import { resolveSharePointMediaSrc } from '../utils/sharePointUrl';

const DOCUMENTS_LIST = 'TripDocuments';

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
    notes: String(item.Notes ?? '')
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

  async getAll(tripId: string): Promise<EntryDocument[]> {
    const safeTrip = odataEscapeString(tripId);
    const select = '$select=ID,Title,TripId,DayId,EntryId,DocumentType,FileUrl,FileName,Notes';
    const filter = `$filter=TripId eq '${safeTrip}'`;
    const url = `${this.itemsUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`DocumentService.getAll failed: ${resp.status}`);
    const data = await resp.json();
    const web = this.ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const sr = this.ctx.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item, web, sr));
  }

  async getForEntry(entryId: string): Promise<EntryDocument[]> {
    const safeEntry = odataEscapeString(entryId);
    const select = '$select=ID,Title,TripId,DayId,EntryId,DocumentType,FileUrl,FileName,Notes';
    const filter = `$filter=EntryId eq '${safeEntry}'`;
    const url = `${this.itemsUrl}?${select}&${filter}`;
    const resp = await this.ctx.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) throw new Error(`DocumentService.getForEntry failed: ${resp.status}`);
    const data = await resp.json();
    const web = this.ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const sr = this.ctx.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
    return (data.value ?? []).map((item: Record<string, unknown>) => mapItem(item, web, sr));
  }

  async create(doc: Omit<EntryDocument, 'id'>): Promise<EntryDocument> {
    const body = JSON.stringify({
      Title: doc.fileName || doc.title || 'Document',
      TripId: doc.tripId,
      DayId: doc.dayId,
      EntryId: doc.entryId,
      DocumentType: doc.documentType,
      FileUrl: doc.fileUrl,
      FileName: doc.fileName,
      Notes: doc.notes ?? ''
    });
    const resp: SPHttpClientResponse = await this.ctx.spHttpClient.post(this.itemsUrl, SPHttpClient.configurations.v1, {
      headers: {
        'Content-Type': 'application/json;odata.metadata=minimal',
        Accept: 'application/json;odata.metadata=minimal'
      },
      body
    });
    if (!resp.ok) throw new Error(`DocumentService.create failed: ${resp.status}`);
    const created = await resp.json();
    const web = this.ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const sr = this.ctx.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
    return mapItem(created, web, sr);
  }

  async update(id: string, partial: Partial<Omit<EntryDocument, 'id'>>): Promise<void> {
    const url = `${this.itemsUrl}(${id})`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: Record<string, any> = {};
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
    serverRelativeUrl: string
  ): Promise<EntryDocument> {
    const webRoot = serverRelativeUrl.replace(/\/$/, '');
    const rootFolder = `${webRoot}/TravelHubAssets/documents`;
    const tripFolder = `${rootFolder}/${tripId}`;
    await ensureFolderChain(this.ctx, webAbsoluteUrl, [rootFolder, tripFolder]);
    const fileUrl = await uploadFileToFolder(this.ctx, webAbsoluteUrl, tripFolder, file);
    return this.create({
      title: file.name,
      tripId,
      dayId,
      entryId,
      documentType,
      fileUrl,
      fileName: file.name,
      notes: notes ?? ''
    });
  }
}

