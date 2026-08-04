/**
 * Durable offline queue for journal entry create/update (text only — no photos).
 * Stored in localStorage keyed by tripId; flushed when back online.
 */

import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { JournalEntry } from '../models/JournalEntry';
import { JournalService } from '../services/JournalService';

const PREFIX = 'travelhub-journal-offline-q:';

export type JournalOfflineCreateOp = {
  type: 'create';
  localId: string;
  dayId: string;
  entryText: string;
  location: string;
  authorName: string;
  entryTimestamp: string;
};

export type JournalOfflineUpdateOp = {
  type: 'update';
  entryId: string;
  entryText: string;
  location: string;
};

export type JournalOfflineOp = JournalOfflineCreateOp | JournalOfflineUpdateOp;

function storageKey(tripId: string): string {
  return `${PREFIX}${(tripId || '').trim()}`;
}

export function isOfflineJournalId(id: string): boolean {
  return (id || '').startsWith('offline-journal-');
}

export function newOfflineJournalId(): string {
  return `offline-journal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadJournalOfflineQueue(tripId: string): JournalOfflineOp[] {
  const id = (tripId || '').trim();
  if (!id || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((op): op is JournalOfflineOp => {
      if (!op || typeof op !== 'object') return false;
      const t = (op as JournalOfflineOp).type;
      return t === 'create' || t === 'update';
    });
  } catch {
    return [];
  }
}

function saveJournalOfflineQueue(tripId: string, ops: JournalOfflineOp[]): void {
  const id = (tripId || '').trim();
  if (!id || typeof window === 'undefined') return;
  try {
    if (!ops.length) {
      window.localStorage.removeItem(storageKey(id));
      return;
    }
    window.localStorage.setItem(storageKey(id), JSON.stringify(ops));
  } catch {
    /* quota / private mode */
  }
}

export function enqueueJournalOfflineCreate(tripId: string, op: Omit<JournalOfflineCreateOp, 'type'>): void {
  const ops = loadJournalOfflineQueue(tripId);
  ops.push({ type: 'create', ...op });
  saveJournalOfflineQueue(tripId, ops);
}

/** Coalesce: update merges into pending create, or replaces prior update for same id. */
export function enqueueJournalOfflineUpdate(
  tripId: string,
  entryId: string,
  fields: { entryText: string; location: string }
): void {
  const ops = loadJournalOfflineQueue(tripId);
  const createIdx = ops.findIndex((o) => o.type === 'create' && o.localId === entryId);
  if (createIdx >= 0) {
    const create = ops[createIdx] as JournalOfflineCreateOp;
    ops[createIdx] = {
      ...create,
      entryText: fields.entryText,
      location: fields.location
    };
    saveJournalOfflineQueue(tripId, ops);
    return;
  }
  const updateIdx = ops.findIndex((o) => o.type === 'update' && o.entryId === entryId);
  if (updateIdx >= 0) {
    ops[updateIdx] = { type: 'update', entryId, ...fields };
  } else {
    ops.push({ type: 'update', entryId, ...fields });
  }
  saveJournalOfflineQueue(tripId, ops);
}

export function journalOfflineQueueCount(tripId: string): number {
  return loadJournalOfflineQueue(tripId).length;
}

/**
 * Replay queued ops in order. Returns localId → server entry map for creates.
 * On failure, remaining ops stay queued (including the failed one).
 */
export async function flushJournalOfflineQueue(
  spContext: WebPartContext,
  tripId: string
): Promise<{ synced: number; idMap: Record<string, JournalEntry>; error?: string }> {
  const id = (tripId || '').trim();
  if (!id) return { synced: 0, idMap: {} };

  let ops = loadJournalOfflineQueue(id);
  if (!ops.length) return { synced: 0, idMap: {} };

  const svc = new JournalService(spContext);
  const idMap: Record<string, JournalEntry> = {};
  let synced = 0;

  while (ops.length) {
    const op = ops[0];
    try {
      if (op.type === 'create') {
        const created = await svc.create({
          tripId: id,
          dayId: op.dayId,
          entryText: op.entryText,
          location: op.location,
          authorName: op.authorName
        });
        // Preserve offline timestamp if SharePoint overwrote with "now".
        if (op.entryTimestamp && created.entryTimestamp !== op.entryTimestamp) {
          try {
            await svc.update(created.id, { entryTimestamp: op.entryTimestamp, title: op.entryTimestamp });
            // eslint-disable-next-line require-atomic-updates -- local object after await
            created.entryTimestamp = op.entryTimestamp;
            // eslint-disable-next-line require-atomic-updates -- local object after await
            created.title = op.entryTimestamp;
          } catch {
            /* non-fatal */
          }
        }
        idMap[op.localId] = created;
        // Remap any later updates that still reference the local id.
        ops = ops.slice(1).map((rest) =>
          rest.type === 'update' && rest.entryId === op.localId
            ? { ...rest, entryId: created.id }
            : rest
        );
      } else {
        let entryId = op.entryId;
        if (isOfflineJournalId(entryId) && idMap[entryId]) {
          entryId = idMap[entryId].id;
        }
        if (isOfflineJournalId(entryId)) {
          throw new Error('Cannot sync update for entry that was never created');
        }
        await svc.update(entryId, { entryText: op.entryText, location: op.location });
        ops = ops.slice(1);
      }
      synced += 1;
      saveJournalOfflineQueue(id, ops);
    } catch (err) {
      saveJournalOfflineQueue(id, ops);
      return {
        synced,
        idMap,
        error: err instanceof Error ? err.message : 'Journal sync failed'
      };
    }
  }

  return { synced, idMap };
}
