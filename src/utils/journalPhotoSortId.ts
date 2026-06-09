const PREFIX = 'photo-sort:';

export function toPhotoSortId(photoId: string): string {
  return `${PREFIX}${photoId}`;
}

export function fromPhotoSortId(sortableId: string): string {
  return sortableId.startsWith(PREFIX) ? sortableId.slice(PREFIX.length) : sortableId;
}

export function isPhotoSortId(id: string): boolean {
  return id.startsWith(PREFIX);
}

const ENTRY_DROP_PREFIX = 'journal-entry-photo-drop-';

export function toJournalEntryPhotoDropId(entryId: string): string {
  return `${ENTRY_DROP_PREFIX}${entryId}`;
}

export function fromJournalEntryPhotoDropId(dropId: string): string {
  return dropId.startsWith(ENTRY_DROP_PREFIX) ? dropId.slice(ENTRY_DROP_PREFIX.length) : dropId;
}

export function isJournalEntryPhotoDropId(id: string): boolean {
  return id.startsWith(ENTRY_DROP_PREFIX);
}
