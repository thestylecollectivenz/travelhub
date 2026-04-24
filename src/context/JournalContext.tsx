import * as React from 'react';
import type { JournalComment, JournalEntry, JournalPhoto } from '../models';
import { JournalService } from '../services/JournalService';
import { useSpContext } from './SpContext';
import { useTripWorkspace } from './TripWorkspaceContext';

export interface JournalContextValue {
  entriesByDay: (dayId: string) => JournalEntry[];
  photosForEntry: (journalEntryId: string) => JournalPhoto[];
  commentsForEntry: (journalEntryId: string) => JournalComment[];
  loadCommentsForEntry: (journalEntryId: string) => Promise<void>;
  addEntry: (input: { dayId: string; entryText: string; location?: string }) => Promise<JournalEntry>;
  updateEntry: (id: string, partial: Partial<Pick<JournalEntry, 'entryText' | 'location'>>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addPhoto: (input: { journalEntryId: string; dayId: string; file: File; caption?: string }) => Promise<JournalPhoto>;
  deletePhoto: (id: string) => Promise<void>;
  toggleLike: (entryId: string) => Promise<void>;
  addComment: (journalEntryId: string, text: string) => Promise<void>;
  deleteComment: (journalEntryId: string, commentId: string) => Promise<void>;
  ensureShareableLink: (entryId: string) => Promise<string>;
}

const JournalContext = React.createContext<JournalContextValue | undefined>(undefined);

export const JournalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const tripId = trip?.id ?? '';

  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [photos, setPhotos] = React.useState<JournalPhoto[]>([]);
  const [commentsByEntry, setCommentsByEntry] = React.useState<Record<string, JournalComment[]>>({});
  const loadedCommentsRef = React.useRef<Set<string>>(new Set());

  const webAbsoluteUrl = React.useMemo(
    () => spContext.pageContext.web.absoluteUrl.replace(/\/$/, ''),
    [spContext.pageContext.web.absoluteUrl]
  );
  const serverRelativeUrl = React.useMemo(
    () => spContext.pageContext.web.serverRelativeUrl.replace(/\/$/, ''),
    [spContext.pageContext.web.serverRelativeUrl]
  );

  const userLogin = spContext.pageContext.user.loginName ?? '';
  const userDisplayName = spContext.pageContext.user.displayName ?? '';

  const reloadAll = React.useCallback(async (): Promise<void> => {
    if (!tripId) {
      setEntries([]);
      setPhotos([]);
      setCommentsByEntry({});
      loadedCommentsRef.current = new Set();
      return;
    }
    const svc = new JournalService(spContext);
    const [e, p] = await Promise.all([svc.getAll(tripId), svc.getForTrip(tripId)]);
    setEntries(e);
    setPhotos(p);
    setCommentsByEntry({});
    loadedCommentsRef.current = new Set();
  }, [spContext, tripId]);

  React.useEffect(() => {
    reloadAll().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('JournalProvider.load', err);
    });
  }, [reloadAll]);

  const entriesByDay = React.useCallback(
    (dayId: string) => entries.filter((x) => x.dayId === dayId).sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp)),
    [entries]
  );

  const photosForEntry = React.useCallback(
    (journalEntryId: string) => photos.filter((p) => p.journalEntryId === journalEntryId),
    [photos]
  );

  const commentsForEntry = React.useCallback(
    (journalEntryId: string) => commentsByEntry[journalEntryId] ?? [],
    [commentsByEntry]
  );

  const loadCommentsForEntry = React.useCallback(
    async (journalEntryId: string): Promise<void> => {
      if (!journalEntryId) return;
      if (loadedCommentsRef.current.has(journalEntryId)) return;
      const svc = new JournalService(spContext);
      const rows = await svc.getCommentsForEntry(journalEntryId);
      loadedCommentsRef.current.add(journalEntryId);
      setCommentsByEntry((prev) => ({ ...prev, [journalEntryId]: rows }));
    },
    [spContext]
  );

  const addEntry = React.useCallback(
    async (input: { dayId: string; entryText: string; location?: string }): Promise<JournalEntry> => {
      if (!tripId) throw new Error('No trip loaded');
      const optimistic: JournalEntry = {
        id: `temp-${Date.now()}`,
        title: new Date().toISOString(),
        tripId,
        dayId: input.dayId,
        authorName: userDisplayName,
        entryText: input.entryText,
        location: input.location ?? '',
        entryTimestamp: new Date().toISOString(),
        likeCount: 0,
        likedByUsers: '',
        shareableLink: ''
      };
      setEntries((prev) => [...prev, optimistic]);
      try {
        const svc = new JournalService(spContext);
        const created = await svc.create({
          tripId,
          dayId: input.dayId,
          entryText: input.entryText,
          location: input.location ?? ''
        });
        setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? created : e)));
        return created;
      } catch (err) {
        setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.addEntry', err);
        throw err;
      }
    },
    [spContext, tripId, userDisplayName]
  );

  const updateEntry = React.useCallback(
    async (id: string, partial: Partial<Pick<JournalEntry, 'entryText' | 'location'>>): Promise<void> => {
      const prevEntry = entries.find((e) => e.id === id);
      if (!prevEntry) return;
      const next: JournalEntry = { ...prevEntry, ...partial };
      setEntries((prev) => prev.map((e) => (e.id === id ? next : e)));
      try {
        const svc = new JournalService(spContext);
        await svc.update(id, { entryText: next.entryText, location: next.location });
      } catch (err) {
        setEntries((prev) => prev.map((e) => (e.id === id ? prevEntry : e)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.updateEntry', err);
        throw err;
      }
    },
    [entries, spContext]
  );

  const deleteEntry = React.useCallback(
    async (id: string): Promise<void> => {
      const prevEntry = entries.find((e) => e.id === id);
      const prevPhotos = photos.filter((p) => p.journalEntryId === id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setPhotos((prev) => prev.filter((p) => p.journalEntryId !== id));
      setCommentsByEntry((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadedCommentsRef.current.delete(id);
      try {
        const svc = new JournalService(spContext);
        await Promise.all(prevPhotos.map((p) => svc.deletePhoto(p.id)));
        await svc.delete(id);
      } catch (err) {
        if (prevEntry) {
          setEntries((prev) => [...prev, prevEntry]);
        }
        if (prevPhotos.length) {
          setPhotos((prev) => [...prev, ...prevPhotos]);
        }
        // eslint-disable-next-line no-console
        console.error('JournalProvider.deleteEntry', err);
        throw err;
      }
    },
    [entries, photos, spContext]
  );

  const addPhoto = React.useCallback(
    async (input: { journalEntryId: string; dayId: string; file: File; caption?: string }): Promise<JournalPhoto> => {
      if (!tripId) throw new Error('No trip loaded');
      const svc = new JournalService(spContext);
      const created = await svc.uploadPhoto(
        input.file,
        tripId,
        input.dayId,
        input.journalEntryId,
        webAbsoluteUrl,
        serverRelativeUrl,
        input.caption ?? ''
      );
      setPhotos((prev) => [...prev, created]);
      return created;
    },
    [spContext, tripId, webAbsoluteUrl, serverRelativeUrl]
  );

  const deletePhoto = React.useCallback(
    async (id: string): Promise<void> => {
      const prev = photos.find((p) => p.id === id);
      setPhotos((x) => x.filter((p) => p.id !== id));
      try {
        const svc = new JournalService(spContext);
        await svc.deletePhoto(id);
      } catch (err) {
        if (prev) setPhotos((x) => [...x, prev]);
        // eslint-disable-next-line no-console
        console.error('JournalProvider.deletePhoto', err);
        throw err;
      }
    },
    [photos, spContext]
  );

  const toggleLike = React.useCallback(
    async (entryId: string): Promise<void> => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const svc = new JournalService(spContext);
      const users = (entry.likedByUsers ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = users.findIndex((u) => u.toLowerCase() === userLogin.toLowerCase());
      const optimisticUsers = idx >= 0 ? users.filter((_, i) => i !== idx) : [...users, userLogin];
      const optimisticCount = Math.max(0, idx >= 0 ? entry.likeCount - 1 : entry.likeCount + 1);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, likeCount: optimisticCount, likedByUsers: optimisticUsers.join(',') } : e))
      );
      try {
        const result = await svc.toggleLike(entryId, entry.likeCount, entry.likedByUsers, userLogin);
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, likeCount: result.likeCount, likedByUsers: result.likedByUsers } : e))
        );
      } catch (err) {
        setEntries((prev) => prev.map((e) => (e.id === entryId ? entry : e)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.toggleLike', err);
      }
    },
    [entries, spContext, userLogin]
  );

  const addComment = React.useCallback(
    async (journalEntryId: string, text: string): Promise<void> => {
      if (!tripId) throw new Error('No trip loaded');
      const optimistic: JournalComment = {
        id: `temp-${Date.now()}`,
        title: journalEntryId,
        journalEntryId,
        tripId,
        authorName: userDisplayName,
        commentText: text,
        commentTimestamp: new Date().toISOString()
      };
      setCommentsByEntry((prev) => ({
        ...prev,
        [journalEntryId]: [...(prev[journalEntryId] ?? []), optimistic]
      }));
      try {
        const svc = new JournalService(spContext);
        const created = await svc.createComment(journalEntryId, tripId, text);
        setCommentsByEntry((prev) => ({
          ...prev,
          [journalEntryId]: (prev[journalEntryId] ?? []).map((c) => (c.id === optimistic.id ? created : c))
        }));
      } catch (err) {
        setCommentsByEntry((prev) => ({
          ...prev,
          [journalEntryId]: (prev[journalEntryId] ?? []).filter((c) => c.id !== optimistic.id)
        }));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.addComment', err);
        throw err;
      }
    },
    [spContext, tripId, userDisplayName]
  );

  const deleteComment = React.useCallback(
    async (journalEntryId: string, commentId: string): Promise<void> => {
      const list = commentsByEntry[journalEntryId] ?? [];
      const prevComment = list.find((c) => c.id === commentId);
      setCommentsByEntry((prev) => ({
        ...prev,
        [journalEntryId]: (prev[journalEntryId] ?? []).filter((c) => c.id !== commentId)
      }));
      try {
        const svc = new JournalService(spContext);
        await svc.deleteComment(commentId);
      } catch (err) {
        if (prevComment) {
          setCommentsByEntry((prev) => ({
            ...prev,
            [journalEntryId]: [...(prev[journalEntryId] ?? []), prevComment].sort((a, b) =>
              a.commentTimestamp.localeCompare(b.commentTimestamp)
            )
          }));
        }
        // eslint-disable-next-line no-console
        console.error('JournalProvider.deleteComment', err);
        throw err;
      }
    },
    [commentsByEntry, spContext]
  );

  const ensureShareableLink = React.useCallback(
    async (entryId: string): Promise<string> => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return '';
      if (entry.shareableLink && entry.shareableLink.trim() !== '') return entry.shareableLink;
      const svc = new JournalService(spContext);
      const url = await svc.generateShareableLink(entryId, webAbsoluteUrl);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, shareableLink: url } : e)));
      return url;
    },
    [entries, spContext, webAbsoluteUrl]
  );

  const value = React.useMemo(
    (): JournalContextValue => ({
      entriesByDay,
      photosForEntry,
      commentsForEntry,
      loadCommentsForEntry,
      addEntry,
      updateEntry,
      deleteEntry,
      addPhoto,
      deletePhoto,
      toggleLike,
      addComment,
      deleteComment,
      ensureShareableLink
    }),
    [
      entriesByDay,
      photosForEntry,
      commentsForEntry,
      loadCommentsForEntry,
      addEntry,
      updateEntry,
      deleteEntry,
      addPhoto,
      deletePhoto,
      toggleLike,
      addComment,
      deleteComment,
      ensureShareableLink
    ]
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
};

export function useJournal(): JournalContextValue {
  const ctx = React.useContext(JournalContext);
  if (!ctx) {
    throw new Error('useJournal must be used within JournalProvider');
  }
  return ctx;
}
