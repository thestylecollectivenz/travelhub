import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { ensureFolderChain, uploadFileToFolder } from '../utils/spFileUpload';

export async function uploadTripMemberAvatar(
  ctx: WebPartContext,
  tripId: string,
  memberId: string,
  file: File
): Promise<string> {
  const webAbsoluteUrl = ctx.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const webRoot = (ctx.pageContext.web.serverRelativeUrl || '').replace(/\/$/, '');
  const folder = `${webRoot}/TravelHubAssets/member-avatars/${tripId}`;
  await ensureFolderChain(ctx, webAbsoluteUrl, [`${webRoot}/TravelHubAssets`, `${webRoot}/TravelHubAssets/member-avatars`, folder]);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeName = `member-${memberId}.${ext}`;
  const renamed = new File([file], safeName, { type: file.type });
  const serverUrl = await uploadFileToFolder(ctx, webAbsoluteUrl, folder, renamed);
  if (serverUrl.startsWith('http')) return serverUrl;
  const origin = new URL(webAbsoluteUrl).origin;
  return `${origin}${serverUrl.startsWith('/') ? '' : '/'}${serverUrl}`;
}
