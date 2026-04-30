import { resolveAbsoluteUrl } from './resolveAbsoluteUrl';

/** Open a document or web URL in a new browser tab (SharePoint-safe). */
export function openDocumentUrl(url: string): void {
  const abs = resolveAbsoluteUrl(url);
  window.open(abs, '_blank', 'noopener,noreferrer');
}
