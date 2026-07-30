import type { LocationInfoQaEntry } from './locationInfoEntry';

/**
 * Persist itinerary-item Ask AI threads inside Notes without a new SharePoint column.
 * Display/edit paths strip this sentinel; saves re-attach the thread.
 */
const SENTINEL = '<!--TH_QA_V1:';
const SENTINEL_END = '-->';

export type EntryQaEntry = LocationInfoQaEntry;

export function splitNotesAndQa(raw: string | undefined): { notes: string; thread: EntryQaEntry[] } {
  const text = raw || '';
  const start = text.indexOf(SENTINEL);
  if (start < 0) return { notes: text, thread: [] };
  const jsonStart = start + SENTINEL.length;
  const end = text.indexOf(SENTINEL_END, jsonStart);
  if (end < 0) return { notes: text, thread: [] };
  const notes = text.slice(0, start).replace(/\s+$/, '');
  const payload = text.slice(jsonStart, end).trim();
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!Array.isArray(parsed)) return { notes, thread: [] };
    const thread: EntryQaEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : '';
      const question = typeof o.question === 'string' ? o.question : '';
      const answer = typeof o.answer === 'string' ? o.answer : '';
      if (!id || !question) continue;
      const replies = Array.isArray(o.replies) ? (o.replies as EntryQaEntry[]) : undefined;
      thread.push({
        id,
        question,
        answer,
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
        replies
      });
    }
    return { notes, thread };
  } catch {
    return { notes, thread: [] };
  }
}

export function joinNotesAndQa(notes: string, thread: EntryQaEntry[]): string {
  const body = (notes || '').replace(/\s+$/, '');
  if (!thread.length) return body;
  return `${body}${body ? '\n' : ''}${SENTINEL}${JSON.stringify(thread)}${SENTINEL_END}`;
}
