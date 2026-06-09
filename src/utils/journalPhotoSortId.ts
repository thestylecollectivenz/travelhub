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
