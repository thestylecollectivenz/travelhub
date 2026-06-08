export type JournalPhotoTileSize = 'small' | 'medium' | 'large' | 'tall';

/** Instagram-board-style tile sizing from index (deterministic layout). */
export function journalPhotoTileSizeAt(index: number): JournalPhotoTileSize {
  const m = index % 10;
  if (m === 0 || m === 7) return 'large';
  if (m === 3 || m === 6) return 'tall';
  if (m === 2 || m === 8) return 'medium';
  return 'small';
}
