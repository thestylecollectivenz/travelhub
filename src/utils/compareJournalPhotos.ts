import type { JournalPhoto } from '../models';

export function compareJournalPhotos(a: JournalPhoto, b: JournalPhoto): number {
  const ao = a.sortOrder ?? 0;
  const bo = b.sortOrder ?? 0;
  if (ao !== bo) return ao - bo;
  const ai = Number(a.id);
  const bi = Number(b.id);
  if (!Number.isNaN(ai) && !Number.isNaN(bi) && ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
}
