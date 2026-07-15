/** Stay tiles should use resolveStayHeroImageUrl (Wikipedia/Commons) — no AI images. */
export function stayTileAiImageUrl(
  _entryId: string,
  _title: string,
  _location: string,
  _mode: 'accommodation' | 'cruise'
): string {
  return '';
}
