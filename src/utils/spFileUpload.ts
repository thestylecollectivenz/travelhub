/**
 * SharePoint REST helpers for folder creation and file uploads.
 * Used by hero image upload and journal photo uploads.
 */

import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export function pickServerRelativeUrlFromAddFileResponse(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const root = payload as Record<string, unknown>;
  const direct = root.ServerRelativeUrl ?? root.FileRef;
  if (typeof direct === 'string' && direct.trim() !== '') return direct;
  const d = root.d;
  if (d && typeof d === 'object') {
    const dd = d as Record<string, unknown>;
    const nested = dd.ServerRelativeUrl ?? dd.FileRef;
    if (typeof nested === 'string' && nested.trim() !== '') return nested;
  }
  const list = root.ListItemAllFields;
  if (list && typeof list === 'object') {
    const lf = list as Record<string, unknown>;
    const ref = lf.FileRef ?? lf.ServerRelativeUrl;
    if (typeof ref === 'string' && ref.trim() !== '') return ref;
  }
  return undefined;
}

/** POST .../folders/add('path') — treat 200 and 400/409 as OK (created or already exists). */
export async function addFolderLevel(ctx: WebPartContext, webAbsoluteUrl: string, serverRelativeFolderPath: string): Promise<void> {
  const base = webAbsoluteUrl.replace(/\/$/, '');
  const escaped = serverRelativeFolderPath.replace(/'/g, "''");
  const url = `${base}/_api/web/folders/add('${escaped}')`;
  const resp: SPHttpClientResponse = await ctx.spHttpClient.post(url, SPHttpClient.configurations.v1, {
    headers: {
      Accept: 'application/json;odata.metadata=minimal'
    }
  });
  if (resp.ok || resp.status === 400 || resp.status === 409) {
    return;
  }
  throw new Error(`Could not ensure folder (${resp.status})`);
}

export async function ensureFolderChain(ctx: WebPartContext, webAbsoluteUrl: string, folderPaths: string[]): Promise<void> {
  for (const p of folderPaths) {
    await addFolderLevel(ctx, webAbsoluteUrl, p);
  }
}

export async function uploadFileToFolder(
  ctx: WebPartContext,
  webAbsoluteUrl: string,
  folderServerRelativeUrl: string,
  file: File
): Promise<string> {
  const base = webAbsoluteUrl.replace(/\/$/, '');
  const safeFolder = folderServerRelativeUrl.replace(/'/g, "''");
  const encodedFileName = encodeURIComponent(file.name);
  const uploadUrl = `${base}/_api/web/getfolderbyserverrelativeurl('${safeFolder}')/files/add(url='${encodedFileName}',overwrite=true)`;
  const buffer = await file.arrayBuffer();
  const uploadResp = await ctx.spHttpClient.post(uploadUrl, SPHttpClient.configurations.v1, {
    headers: {
      Accept: 'application/json;odata.metadata=minimal'
    },
    body: buffer
  });
  if (!uploadResp.ok) {
    throw new Error(`Upload failed (${uploadResp.status})`);
  }
  const payload = await uploadResp.json();
  const serverRelativeUrl = pickServerRelativeUrlFromAddFileResponse(payload);
  if (!serverRelativeUrl) {
    throw new Error('Upload succeeded but no file URL returned');
  }
  const rel = serverRelativeUrl.startsWith('/') ? serverRelativeUrl : `/${serverRelativeUrl}`;
  return `${base}${rel}`;
}
