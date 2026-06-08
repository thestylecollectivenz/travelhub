export const JOURNAL_PHOTO_DRAG_MIME = 'application/x-travelhub-journal-photo';

export function setJournalPhotoDragData(dataTransfer: DataTransfer, photoId: string): void {
  dataTransfer.setData(JOURNAL_PHOTO_DRAG_MIME, photoId);
  dataTransfer.effectAllowed = 'move';
}

export function readJournalPhotoDragData(dataTransfer: DataTransfer): string {
  return dataTransfer.getData(JOURNAL_PHOTO_DRAG_MIME).trim();
}
