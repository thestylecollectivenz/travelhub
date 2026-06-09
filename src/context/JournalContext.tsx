import * as React from 'react';
import type { JournalComment, JournalEntry, JournalPhoto } from '../models';
import { JournalService } from '../services/JournalService';
import { timestampBetween } from '../utils/journalEntryOrder';
import { compareJournalPhotos } from '../utils/compareJournalPhotos';
import { useSpContext } from './SpContext';
import { useTripWorkspace } from './TripWorkspaceContext';
import { useConfig } from './ConfigContext';

export interface JournalContextValue {
  allEntries: JournalEntry[];
  allTripPhotos: JournalPhoto[];
  entriesByDay: (dayId: string) => JournalEntry[];
  photosForEntry: (journalEntryId: string) => JournalPhoto[];
  commentCountForEntry: (journalEntryId: string) => number;
  commentsForEntry: (journalEntryId: string) => JournalComment[];
  loadCommentsForEntry: (journalEntryId: string) => Promise<void>;
  addEntry: (input: { dayId: string; entryText: string; location?: string }) => Promise<JournalEntry>;
  updateEntry: (id: string, partial: Partial<Pick<JournalEntry, 'entryText' | 'location'>>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  moveEntryToDay: (entryId: string, targetDayId: string, beforeEntryId?: string) => Promise<void>;
  reorderEntryBefore: (entryId: string, beforeEntryId: string) => Promise<void>;
  addPhoto: (input: { journalEntryId: string; dayId: string; file: File; caption?: string }) => Promise<JournalPhoto>;
  addAlbumPhoto: (dayId: string, file: File, caption?: string) => Promise<JournalPhoto>;
  assignPhotoToEntry: (photoId: string, dayId: string, journalEntryId: string) => Promise<void>;
  reorderPhotoBefore: (entryId: string, photoId: string, beforePhotoId: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  updatePhotoCaption: (photoId: string, caption: string) => Promise<void>;
  togglePhotoLike: (photoId: string) => Promise<void>;
  toggleLike: (entryId: string) => Promise<void>;
  addComment: (journalEntryId: string, text: string) => Promise<void>;
  deleteComment: (journalEntryId: string, commentId: string) => Promise<void>;
  ensureShareableLink: (entryId: string) => Promise<string>;
  reassignDayContent: (fromDayId: string, toDayId: string) => Promise<void>;
}

const JournalContext = React.createContext<JournalContextValue | undefined>(undefined);

export const JournalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const { journalAuthorName } = useConfig();
  const { trip } = useTripWorkspace();
  const tripId = trip?.id ?? '';

  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [photos, setPhotos] = React.useState<JournalPhoto[]>([]);
  const [commentsByEntry, setCommentsByEntry] = React.useState<Record<string, JournalComment[]>>({});
  const [commentCountByEntry, setCommentCountByEntry] = React.useState<Record<string, number>>({});
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
      setCommentCountByEntry({});
      loadedCommentsRef.current = new Set();
      return;
    }
    const svc = new JournalService(spContext);
    const [e, p, counts] = await Promise.all([
      svc.getAll(tripId),
      svc.getForTrip(tripId),
      svc.getCommentCountsByEntryForTrip(tripId)
    ]);
    setEntries(e);
    setPhotos(p);
    setCommentCountByEntry(counts);
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
    (journalEntryId: string) =>
      photos.filter((p) => p.journalEntryId === journalEntryId).sort(compareJournalPhotos),
    [photos]
  );

  const commentCountForEntry = React.useCallback(
    (journalEntryId: string) => commentCountByEntry[journalEntryId] ?? 0,
    [commentCountByEntry]
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
      setCommentCountByEntry((prev) => ({ ...prev, [journalEntryId]: rows.length }));
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
        authorName: journalAuthorName,
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
          location: input.location ?? '',
          authorName: journalAuthorName
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
    [spContext, tripId, journalAuthorName]
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

  const syncEntryPhotosDay = React.useCallback(
    async (entryId: string, targetDayId: string): Promise<void> => {
      const linked = photos.filter((p) => p.journalEntryId === entryId && p.dayId !== targetDayId);
      if (!linked.length) return;
      const svc = new JournalService(spContext);
      for (const photo of linked) {
        // eslint-disable-next-line no-await-in-loop
        await svc.updatePhoto(photo.id, { dayId: targetDayId });
      }
      setPhotos((prev) => prev.map((p) => (p.journalEntryId === entryId ? { ...p, dayId: targetDayId } : p)));
    },
    [photos, spContext]
  );

  const moveEntryToDay = React.useCallback(
    async (entryId: string, targetDayId: string, beforeEntryId?: string): Promise<void> => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry || !targetDayId) return;

      const sortedTarget = entries
        .filter((e) => e.dayId === targetDayId && e.id !== entryId)
        .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));

      let newTimestamp: string;
      if (beforeEntryId) {
        const beforeIdx = sortedTarget.findIndex((e) => e.id === beforeEntryId);
        const beforeNeighbor = beforeIdx > 0 ? sortedTarget[beforeIdx - 1] : null;
        const afterNeighbor = beforeIdx >= 0 ? sortedTarget[beforeIdx] : null;
        newTimestamp = timestampBetween(beforeNeighbor?.entryTimestamp, afterNeighbor?.entryTimestamp);
      } else {
        const last = sortedTarget[sortedTarget.length - 1];
        newTimestamp = timestampBetween(last?.entryTimestamp, null);
      }

      const prevEntry = entry;
      const nextEntry: JournalEntry = { ...entry, dayId: targetDayId, entryTimestamp: newTimestamp };
      setEntries((prev) => prev.map((e) => (e.id === entryId ? nextEntry : e)));

      try {
        const svc = new JournalService(spContext);
        await svc.update(entryId, { dayId: targetDayId, entryTimestamp: newTimestamp });
        await syncEntryPhotosDay(entryId, targetDayId);
      } catch (err) {
        setEntries((prev) => prev.map((e) => (e.id === entryId ? prevEntry : e)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.moveEntryToDay', err);
        throw err;
      }
    },
    [entries, spContext, syncEntryPhotosDay]
  );

  const reorderEntryBefore = React.useCallback(
    async (entryId: string, beforeEntryId: string): Promise<void> => {
      if (entryId === beforeEntryId) return;
      const entry = entries.find((e) => e.id === entryId);
      const beforeEntry = entries.find((e) => e.id === beforeEntryId);
      if (!entry || !beforeEntry) return;

      const targetDayId = beforeEntry.dayId;
      const sorted = entries
        .filter((e) => e.dayId === targetDayId && e.id !== entryId)
        .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
      const beforeIdx = sorted.findIndex((e) => e.id === beforeEntryId);
      const prevNeighbor = beforeIdx > 0 ? sorted[beforeIdx - 1] : null;
      const newTimestamp = timestampBetween(prevNeighbor?.entryTimestamp, beforeEntry.entryTimestamp);

      const prevEntry = entry;
      const nextEntry: JournalEntry = { ...entry, dayId: targetDayId, entryTimestamp: newTimestamp };
      setEntries((prev) => prev.map((e) => (e.id === entryId ? nextEntry : e)));

      try {
        const svc = new JournalService(spContext);
        await svc.update(entryId, { dayId: targetDayId, entryTimestamp: newTimestamp });
        if (targetDayId !== entry.dayId) {
          await syncEntryPhotosDay(entryId, targetDayId);
        }
      } catch (err) {
        setEntries((prev) => prev.map((e) => (e.id === entryId ? prevEntry : e)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.reorderEntryBefore', err);
        throw err;
      }
    },
    [entries, spContext, syncEntryPhotosDay]
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
      setCommentCountByEntry((prev) => {
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
      const siblings = photos.filter((p) => p.journalEntryId === input.journalEntryId);
      const nextSort = siblings.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), -1) + 1;
      const svc = new JournalService(spContext);
      const created = await svc.uploadPhoto(
        input.file,
        tripId,
        input.dayId,
        input.journalEntryId,
        webAbsoluteUrl,
        serverRelativeUrl,
        input.caption ?? '',
        nextSort
      );
      setPhotos((prev) => [...prev, created]);
      return created;
    },
    [photos, spContext, tripId, webAbsoluteUrl, serverRelativeUrl]
  );

  const addAlbumPhoto = React.useCallback(
    async (dayId: string, file: File, caption?: string): Promise<JournalPhoto> => {
      if (!tripId) throw new Error('No trip loaded');
      const svc = new JournalService(spContext);
      const created = await svc.uploadPhoto(
        file,
        tripId,
        dayId,
        undefined,
        webAbsoluteUrl,
        serverRelativeUrl,
        caption ?? ''
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

  const updatePhotoCaption = React.useCallback(
    async (photoId: string, caption: string): Promise<void> => {
      const prev = photos.find((p) => p.id === photoId);
      if (!prev) return;
      setPhotos((x) => x.map((p) => (p.id === photoId ? { ...p, caption } : p)));
      try {
        const svc = new JournalService(spContext);
        await svc.updatePhoto(photoId, { caption });
      } catch (err) {
        if (prev) setPhotos((x) => x.map((p) => (p.id === photoId ? prev : p)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.updatePhotoCaption', err);
        throw err;
      }
    },
    [photos, spContext]
  );

  const assignPhotoToEntry = React.useCallback(
    async (photoId: string, dayId: string, journalEntryId: string): Promise<void> => {
      const prev = photos.find((p) => p.id === photoId);
      if (!prev) return;
      const nextJournalEntryId = journalEntryId.trim();
      const targetSiblings = photos.filter((p) => p.journalEntryId === nextJournalEntryId && p.id !== photoId);
      const nextSort = targetSiblings.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), -1) + 1;
      setPhotos((x) =>
        x.map((p) =>
          p.id === photoId ? { ...p, dayId, journalEntryId: nextJournalEntryId, sortOrder: nextSort } : p
        )
      );
      try {
        const svc = new JournalService(spContext);
        await svc.updatePhoto(photoId, { dayId, journalEntryId: nextJournalEntryId, sortOrder: nextSort });
      } catch (err) {
        if (prev) setPhotos((x) => x.map((p) => (p.id === photoId ? prev : p)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.assignPhotoToEntry', err);
        throw err;
      }
    },
    [photos, spContext]
  );

  const reorderPhotoBefore = React.useCallback(
    async (entryId: string, photoId: string, beforePhotoId: string): Promise<void> => {
      const entryPhotos = photos
        .filter((p) => p.journalEntryId === entryId)
        .slice()
        .sort(compareJournalPhotos);
      const fromIdx = entryPhotos.findIndex((p) => p.id === photoId);
      const toIdx = entryPhotos.findIndex((p) => p.id === beforePhotoId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

      const reordered = [...entryPhotos];
      const [moved] = reordered.splice(fromIdx, 1);
      const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
      reordered.splice(insertAt, 0, moved);

      const updates = reordered.map((p, index) => ({ id: p.id, sortOrder: index }));
      const prevById = new Map(entryPhotos.map((p) => [p.id, p]));
      setPhotos((prev) =>
        prev.map((p) => {
          const hit = updates.find((u) => u.id === p.id);
          return hit ? { ...p, sortOrder: hit.sortOrder } : p;
        })
      );
      try {
        const svc = new JournalService(spContext);
        await Promise.all(updates.map((u) => svc.updatePhoto(u.id, { sortOrder: u.sortOrder })));
      } catch (err) {
        setPhotos((prev) =>
          prev.map((p) => {
            const snap = prevById.get(p.id);
            return snap ? { ...p, sortOrder: snap.sortOrder } : p;
          })
        );
        // eslint-disable-next-line no-console
        console.error('JournalProvider.reorderPhotoBefore', err);
        throw err;
      }
    },
    [photos, spContext]
  );

  const togglePhotoLike = React.useCallback(
    async (photoId: string): Promise<void> => {
      const snapshot = photos.find((p) => p.id === photoId);
      if (!snapshot) return;
      const users = (snapshot.likedByUsers ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = users.findIndex((u) => u.toLowerCase() === userLogin.toLowerCase());
      const optimisticUsers = idx >= 0 ? users.filter((_, i) => i !== idx) : [...users, userLogin];
      const optimisticCount = Math.max(0, idx >= 0 ? snapshot.likeCount - 1 : snapshot.likeCount + 1);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, likeCount: optimisticCount, likedByUsers: optimisticUsers.join(',') } : p))
      );
      try {
        const svc = new JournalService(spContext);
        const result = await svc.togglePhotoLike(photoId, snapshot.likeCount, snapshot.likedByUsers, userLogin);
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, likeCount: result.likeCount, likedByUsers: result.likedByUsers } : p))
        );
      } catch (err) {
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? snapshot : p)));
        // eslint-disable-next-line no-console
        console.error('JournalProvider.togglePhotoLike', err);
      }
    },
    [photos, spContext, userLogin]
  );

  const toggleLike = React.useCallback(
    async (entryId: string): Promise<void> => {
      const snapshot = entries.find((e) => e.id === entryId);
      if (!snapshot) return;

      const users = (snapshot.likedByUsers ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = users.findIndex((u) => u.toLowerCase() === userLogin.toLowerCase());
      const optimisticUsers = idx >= 0 ? users.filter((_, i) => i !== idx) : [...users, userLogin];
      const optimisticCount = Math.max(0, idx >= 0 ? snapshot.likeCount - 1 : snapshot.likeCount + 1);

      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, likeCount: optimisticCount, likedByUsers: optimisticUsers.join(',') } : e))
      );

      try {
        const svc = new JournalService(spContext);
        const result = await svc.toggleLike(entryId, snapshot.likeCount, snapshot.likedByUsers, userLogin);
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, likeCount: result.likeCount, likedByUsers: result.likedByUsers } : e))
        );
      } catch (err) {
        setEntries((prev) => prev.map((e) => (e.id === entryId ? snapshot : e)));
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
      setCommentCountByEntry((prev) => ({
        ...prev,
        [journalEntryId]: (prev[journalEntryId] ?? 0) + 1
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
        setCommentCountByEntry((prev) => ({
          ...prev,
          [journalEntryId]: Math.max(0, (prev[journalEntryId] ?? 1) - 1)
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
      let prevComment: JournalComment | undefined;
      setCommentsByEntry((prev) => {
        const list = prev[journalEntryId] ?? [];
        prevComment = list.find((c) => c.id === commentId);
        return {
          ...prev,
          [journalEntryId]: list.filter((c) => c.id !== commentId)
        };
      });
      setCommentCountByEntry((prev) => ({
        ...prev,
        [journalEntryId]: Math.max(0, (prev[journalEntryId] ?? 1) - 1)
      }));
      try {
        const svc = new JournalService(spContext);
        await svc.deleteComment(commentId);
      } catch (err) {
        const restored = prevComment;
        if (restored) {
          setCommentsByEntry((prev) => {
            const nextList = [...(prev[journalEntryId] ?? []), restored].sort((a, b) =>
              a.commentTimestamp.localeCompare(b.commentTimestamp)
            );
            return { ...prev, [journalEntryId]: nextList };
          });
          setCommentCountByEntry((prev) => ({
            ...prev,
            [journalEntryId]: (prev[journalEntryId] ?? 0) + 1
          }));
        }
        // eslint-disable-next-line no-console
        console.error('JournalProvider.deleteComment', err);
        throw err;
      }
    },
    [spContext]
  );

  const reassignDayContent = React.useCallback(
    async (fromDayId: string, toDayId: string): Promise<void> => {
      if (!fromDayId || !toDayId || fromDayId === toDayId) return;
      const moveEntries = entries.filter((e) => e.dayId === fromDayId);
      const movePhotos = photos.filter((p) => p.dayId === fromDayId);
      if (!moveEntries.length && !movePhotos.length) return;

      const svc = new JournalService(spContext);
      for (const entry of moveEntries) {
        // eslint-disable-next-line no-await-in-loop
        await svc.update(entry.id, { dayId: toDayId });
      }
      for (const photo of movePhotos) {
        // eslint-disable-next-line no-await-in-loop
        await svc.updatePhoto(photo.id, { dayId: toDayId });
      }

      setEntries((prev) => prev.map((e) => (e.dayId === fromDayId ? { ...e, dayId: toDayId } : e)));
      setPhotos((prev) => prev.map((p) => (p.dayId === fromDayId ? { ...p, dayId: toDayId } : p)));
    },
    [entries, photos, spContext]
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
      allEntries: entries,
      allTripPhotos: photos,
      entriesByDay,
      photosForEntry,
      commentCountForEntry,
      commentsForEntry,
      loadCommentsForEntry,
      addEntry,
      updateEntry,
      deleteEntry,
      moveEntryToDay,
      reorderEntryBefore,
      addPhoto,
      addAlbumPhoto,
      assignPhotoToEntry,
      reorderPhotoBefore,
      deletePhoto,
      updatePhotoCaption,
      togglePhotoLike,
      toggleLike,
      addComment,
      deleteComment,
      ensureShareableLink,
      reassignDayContent
    }),
    [
      entries,
      photos,
      entriesByDay,
      photosForEntry,
      commentCountForEntry,
      commentsForEntry,
      loadCommentsForEntry,
      addEntry,
      updateEntry,
      deleteEntry,
      moveEntryToDay,
      reorderEntryBefore,
      addPhoto,
      addAlbumPhoto,
      assignPhotoToEntry,
      reorderPhotoBefore,
      deletePhoto,
      updatePhotoCaption,
      togglePhotoLike,
      toggleLike,
      addComment,
      deleteComment,
      ensureShareableLink,
      reassignDayContent
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
