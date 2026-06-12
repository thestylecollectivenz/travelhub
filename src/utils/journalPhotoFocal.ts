import type { JournalPhoto } from '../models';

export interface PhotoFocalPoint {
  x: number;
  y: number;
}

export const DEFAULT_PHOTO_FOCAL: PhotoFocalPoint = { x: 50, y: 50 };

function clampFocal(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Parse SharePoint FocalPoint field ("50,50") or legacy empty → centre. */
export function parsePhotoFocalPoint(raw: string | null | undefined): PhotoFocalPoint {
  if (!raw?.trim()) return { ...DEFAULT_PHOTO_FOCAL };
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) {
    return { ...DEFAULT_PHOTO_FOCAL };
  }
  return { x: clampFocal(parts[0]), y: clampFocal(parts[1]) };
}

export function formatPhotoFocalPoint(focal: PhotoFocalPoint): string {
  return `${clampFocal(focal.x)},${clampFocal(focal.y)}`;
}

export function photoFocalFromPhoto(photo: Pick<JournalPhoto, 'focalX' | 'focalY'>): PhotoFocalPoint {
  return {
    x: clampFocal(photo.focalX ?? DEFAULT_PHOTO_FOCAL.x),
    y: clampFocal(photo.focalY ?? DEFAULT_PHOTO_FOCAL.y)
  };
}

export function photoObjectPosition(photo: Pick<JournalPhoto, 'focalX' | 'focalY'>): string {
  const { x, y } = photoFocalFromPhoto(photo);
  return `${x}% ${y}%`;
}

export function photoObjectPositionStyle(photo: Pick<JournalPhoto, 'focalX' | 'focalY'>): { objectPosition: string } {
  return { objectPosition: photoObjectPosition(photo) };
}
