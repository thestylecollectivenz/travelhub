export interface AiChatStoredMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AiChatSessionRecord {
  messages: AiChatStoredMessage[];
  updatedAt: string;
}

interface AiChatArchiveRecord {
  tripId: string;
  archivedAt: string;
  messages: AiChatStoredMessage[];
}

const SESSION_KEY = 'travelhub-ai-chat-sessions';
const ARCHIVE_KEY = 'travelhub-ai-chat-archive';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function readSessions(): Record<string, AiChatSessionRecord> {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AiChatSessionRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, AiChatSessionRecord>): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

function readArchive(): AiChatArchiveRecord[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiChatArchiveRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchive(rows: AiChatArchiveRecord[]): void {
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function archiveSession(tripId: string, session: AiChatSessionRecord): void {
  if (!session.messages.length) return;
  const archive = readArchive();
  archive.push({
    tripId,
    archivedAt: new Date().toISOString(),
    messages: session.messages
  });
  writeArchive(archive.slice(-40));
}

/** Drop sessions older than 7 days (archived first). */
export function pruneAiChatHistory(): void {
  const sessions = readSessions();
  const now = Date.now();
  let changed = false;
  Object.keys(sessions).forEach((tripId) => {
    const session = sessions[tripId];
    const updated = Date.parse(session.updatedAt || '');
    if (!Number.isFinite(updated) || now - updated > RETENTION_MS) {
      archiveSession(tripId, session);
      delete sessions[tripId];
      changed = true;
    }
  });
  if (changed) writeSessions(sessions);

  const archive = readArchive();
  const pruned = archive.filter((row) => {
    const at = Date.parse(row.archivedAt || '');
    return Number.isFinite(at) && now - at <= RETENTION_MS;
  });
  if (pruned.length !== archive.length) writeArchive(pruned);
}

export function loadAiChatMessages(tripId: string): AiChatStoredMessage[] {
  if (!tripId) return [];
  pruneAiChatHistory();
  const session = readSessions()[tripId];
  return session?.messages ?? [];
}

export function saveAiChatMessages(tripId: string, messages: AiChatStoredMessage[]): void {
  if (!tripId) return;
  pruneAiChatHistory();
  const sessions = readSessions();
  if (!messages.length) {
    if (sessions[tripId]) {
      archiveSession(tripId, sessions[tripId]);
      delete sessions[tripId];
      writeSessions(sessions);
    }
    return;
  }
  sessions[tripId] = {
    messages,
    updatedAt: new Date().toISOString()
  };
  writeSessions(sessions);
}
