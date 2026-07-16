import type { LocationInfoQaEntry } from './locationInfoEntry';

/** Strip leaked system instructions that were accidentally saved into Q text. */
export function sanitizeDisplayedQaQuestion(question: string): string {
  return (question || '')
    .replace(/\s*Keep brand names in their official language\.?/gi, '')
    .replace(/\s*Never translate trade names into English\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function qaEntryTitle(item: Pick<LocationInfoQaEntry, 'question'>): string {
  return sanitizeDisplayedQaQuestion(item.question) || 'Question';
}
