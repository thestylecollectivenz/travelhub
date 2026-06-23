import * as React from 'react';
import type { EntryDocument, EntryDocumentType, EntryLink } from '../models';
import { DocumentService } from '../services/DocumentService';
import { LinkService } from '../services/LinkService';
import { sortEntryDocuments } from '../utils/entryDocumentSort';
import { migrateLegacyDocumentOrder } from '../utils/documentEntryOrder';
import { migrateMixedAttachmentOrder, writeAttachmentOrder } from '../utils/entryAttachmentOrder';
import { sortEntryLinks } from '../utils/entryLinkSort';
import { migrateLegacyLinkOrder } from '../utils/linkEntryOrder';
import { useSpContext } from './SpContext';
import { useTripWorkspace } from './TripWorkspaceContext';

export interface AttachmentsContextValue {
  documents: EntryDocument[];
  links: EntryLink[];
  loading: boolean;
  error: string | null;
  docsForEntry: (entryId: string) => EntryDocument[];
  linksForEntry: (entryId: string) => EntryLink[];
  addDocument: (input: {
    file: File;
    dayId: string;
    entryId: string;
    documentType: EntryDocumentType;
    notes?: string;
    title?: string;
  }) => Promise<EntryDocument>;
  updateDocument: (id: string, partial: Partial<Omit<EntryDocument, 'id'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  reorderEntryDocuments: (entryId: string, orderedDocumentIds: string[]) => void;
  reorderEntryAttachments: (
    entryId: string,
    ordered: Array<{ kind: 'doc'; id: string } | { kind: 'link'; id: string }>
  ) => void;
  addLink: (input: {
    dayId: string;
    entryId: string;
    linkType: EntryLink['linkType'];
    url: string;
    linkTitle: string;
    notes?: string;
  }) => Promise<EntryLink>;
  updateLink: (id: string, partial: Partial<Omit<EntryLink, 'id'>>) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  reorderEntryLinks: (entryId: string, orderedLinkIds: string[]) => void;
  highlightedDocumentId: string | null;
  setHighlightedDocumentId: (id: string | null) => void;
  highlightedLinkId: string | null;
  setHighlightedLinkId: (id: string | null) => void;
}

const AttachmentsContext = React.createContext<AttachmentsContextValue | undefined>(undefined);

export const AttachmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const tripId = trip?.id ?? '';
  const webAbsoluteUrl = spContext.pageContext.web.absoluteUrl.replace(/\/$/, '');
  const serverRelativeUrl = spContext.pageContext.web.serverRelativeUrl.replace(/\/$/, '');

  const [documents, setDocuments] = React.useState<EntryDocument[]>([]);
  const [links, setLinks] = React.useState<EntryLink[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [highlightedDocumentId, setHighlightedDocumentId] = React.useState<string | null>(null);
  const [highlightedLinkId, setHighlightedLinkId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tripId) {
      setDocuments([]);
      setLinks([]);
      return;
    }
    setLoading(true);
    setError(null);
    const docSvc = new DocumentService(spContext);
    const linkSvc = new LinkService(spContext);
    Promise.all([docSvc.getAll(tripId), linkSvc.getAll(tripId)])
      .then(([docs, allLinks]) => {
        const migratedLinks = migrateLegacyLinkOrder(tripId, allLinks);
        if (migratedLinks.persist.length) {
          migratedLinks.persist.forEach(({ id, sortOrder }) => {
            linkSvc.update(id, { sortOrder }).catch(console.error);
          });
        }
        const migratedDocs = migrateLegacyDocumentOrder(tripId, docs);
        if (migratedDocs.persist.length) {
          migratedDocs.persist.forEach(({ id, sortOrder }) => {
            docSvc.update(id, { sortOrder }).catch(console.error);
          });
        }
        const mixed = migrateMixedAttachmentOrder(tripId, migratedDocs.documents, migratedLinks.links);
        if (mixed.persist.length) {
          mixed.persist.forEach(({ kind, id, sortOrder }) => {
            if (kind === 'doc') docSvc.update(id, { sortOrder }).catch(console.error);
            else linkSvc.update(id, { sortOrder }).catch(console.error);
          });
        }
        setDocuments(mixed.documents);
        setLinks(mixed.links);
        setLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('AttachmentsProvider.load', err);
        setError(err instanceof Error ? err.message : 'Could not load attachments.');
        setLoading(false);
      })
    ;
  }, [spContext, tripId]);

  React.useEffect(() => {
    const onEntryDuplicated = (evt: Event): void => {
      const custom = evt as CustomEvent<{
        sourceEntryId?: string;
        sourceDayId?: string;
        targetEntryId?: string;
        targetDayId?: string;
        tripId?: string;
      }>;
      const sourceEntryId = custom.detail?.sourceEntryId?.trim();
      const targetEntryId = custom.detail?.targetEntryId?.trim();
      const sourceDayId = custom.detail?.sourceDayId?.trim();
      const targetDayId = custom.detail?.targetDayId?.trim();
      const eventTripId = custom.detail?.tripId?.trim();
      if (!sourceEntryId || !targetEntryId || !sourceDayId || !targetDayId || !eventTripId) return;
      if (!tripId || eventTripId !== tripId) return;
      if (sourceEntryId === targetEntryId) return;

      const sourceLinks = links.filter((l) => l.entryId === sourceEntryId);
      const sourceDocs = documents.filter((d) => d.entryId === sourceEntryId);
      if (!sourceLinks.length && !sourceDocs.length) return;

      const linkSvc = new LinkService(spContext);
      const docSvc = new DocumentService(spContext);

      void (async () => {
        try {
          const clonedLinks = await Promise.all(
            sourceLinks
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((link, index) =>
                linkSvc.create({
                  title: link.linkTitle || link.title || 'Link',
                  tripId,
                  dayId: targetDayId,
                  entryId: targetEntryId,
                  linkType: link.linkType,
                  url: link.url,
                  linkTitle: link.linkTitle,
                  notes: link.notes,
                  sortOrder: index
                })
              )
          );
          const clonedDocs = await Promise.all(
            sourceDocs
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((doc, index) =>
                docSvc.create({
                  title: doc.fileName || doc.title || 'Document',
                  tripId,
                  dayId: targetDayId,
                  entryId: targetEntryId,
                  documentType: doc.documentType,
                  fileUrl: doc.fileUrl,
                  fileName: doc.fileName,
                  notes: doc.notes,
                  sortOrder: index
                })
              )
          );
          if (clonedLinks.length) {
            setLinks((prev) => [...prev, ...clonedLinks]);
          }
          if (clonedDocs.length) {
            setDocuments((prev) => [...prev, ...clonedDocs]);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('AttachmentsProvider: clone attachments after duplicate failed', err);
        }
      })();
    };

    window.addEventListener('trip-entry-duplicated', onEntryDuplicated as EventListener);
    return () => {
      window.removeEventListener('trip-entry-duplicated', onEntryDuplicated as EventListener);
    };
  }, [tripId, links, documents, spContext]);

  const docsForEntry = React.useCallback(
    (entryId: string) => sortEntryDocuments(documents.filter((d) => d.entryId === entryId)),
    [documents]
  );

  const linksForEntry = React.useCallback(
    (entryId: string) => sortEntryLinks(links.filter((l) => l.entryId === entryId)),
    [links]
  );

  const addDocument = React.useCallback(
    async (input: {
      file: File;
      dayId: string;
      entryId: string;
      documentType: EntryDocumentType;
      notes?: string;
      title?: string;
    }): Promise<EntryDocument> => {
      if (!tripId) throw new Error('No trip loaded');
      const svc = new DocumentService(spContext);
      const entryDocs = documents.filter((d) => d.entryId === input.entryId);
      const nextSort = entryDocs.reduce((max, d) => Math.max(max, d.sortOrder ?? 0), -1) + 1;
      const created = await svc.uploadAndCreate(
        input.file,
        tripId,
        input.dayId,
        input.entryId,
        input.documentType,
        input.notes ?? '',
        webAbsoluteUrl,
        serverRelativeUrl,
        nextSort,
        input.title
      );
      setDocuments((prev) => [...prev, created]);
      return created;
    },
    [spContext, tripId, webAbsoluteUrl, serverRelativeUrl, documents]
  );

  const deleteDocument = React.useCallback(
    async (id: string): Promise<void> => {
      const existing = documents.find((d) => d.id === id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      try {
        const svc = new DocumentService(spContext);
        await svc.delete(id);
      } catch (err) {
        if (existing) setDocuments((prev) => [...prev, existing]);
        throw err;
      }
    },
    [documents, spContext]
  );

  const updateDocument = React.useCallback(
    async (id: string, partial: Partial<Omit<EntryDocument, 'id'>>): Promise<void> => {
      const snapshot = documents.find((d) => d.id === id);
      if (!snapshot) return;
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...partial } : d)));
      try {
        const svc = new DocumentService(spContext);
        await svc.update(id, partial);
      } catch (err) {
        setDocuments((prev) => prev.map((d) => (d.id === id ? snapshot : d)));
        throw err;
      }
    },
    [documents, spContext]
  );

  const addLink = React.useCallback(
    async (input: {
      dayId: string;
      entryId: string;
      linkType: EntryLink['linkType'];
      url: string;
      linkTitle: string;
      notes?: string;
    }): Promise<EntryLink> => {
      if (!tripId) throw new Error('No trip loaded');
      const svc = new LinkService(spContext);
      const entryLinks = links.filter((l) => l.entryId === input.entryId);
      const nextSort = entryLinks.reduce((max, l) => Math.max(max, l.sortOrder ?? 0), -1) + 1;
      const created = await svc.create({
        title: input.linkTitle,
        tripId,
        dayId: input.dayId,
        entryId: input.entryId,
        linkType: input.linkType,
        url: input.url,
        linkTitle: input.linkTitle,
        notes: input.notes ?? '',
        sortOrder: nextSort
      });
      setLinks((prev) => [...prev, created]);
      return created;
    },
    [spContext, tripId, links]
  );

  const updateLink = React.useCallback(
    async (id: string, partial: Partial<Omit<EntryLink, 'id'>>): Promise<void> => {
      const snapshot = links.find((l) => l.id === id);
      if (!snapshot) return;
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...partial } : l)));
      try {
        const svc = new LinkService(spContext);
        await svc.update(id, partial);
      } catch (err) {
        setLinks((prev) => prev.map((l) => (l.id === id ? snapshot : l)));
        throw err;
      }
    },
    [links, spContext]
  );

  const deleteLink = React.useCallback(
    async (id: string): Promise<void> => {
      const existing = links.find((l) => l.id === id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      try {
        const svc = new LinkService(spContext);
        await svc.delete(id);
      } catch (err) {
        if (existing) setLinks((prev) => [...prev, existing]);
        throw err;
      }
    },
    [links, spContext]
  );

  const reorderEntryLinks = React.useCallback(
    (entryId: string, orderedLinkIds: string[]): void => {
      setLinks((prev) =>
        prev.map((link) => {
          if (link.entryId !== entryId) return link;
          const nextOrder = orderedLinkIds.indexOf(link.id);
          if (nextOrder < 0) return link;
          return { ...link, sortOrder: nextOrder };
        })
      );
      const svc = new LinkService(spContext);
      orderedLinkIds.forEach((id, index) => {
        svc.update(id, { sortOrder: index }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('reorderEntryLinks: SP persist failed', err);
        });
      });
    },
    [spContext]
  );

  const reorderEntryDocuments = React.useCallback(
    (entryId: string, orderedDocumentIds: string[]): void => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.entryId !== entryId) return doc;
          const nextOrder = orderedDocumentIds.indexOf(doc.id);
          if (nextOrder < 0) return doc;
          return { ...doc, sortOrder: nextOrder };
        })
      );
      const svc = new DocumentService(spContext);
      orderedDocumentIds.forEach((id, index) => {
        svc.update(id, { sortOrder: index }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('reorderEntryDocuments: SP persist failed', err);
        });
      });
    },
    [spContext]
  );

  const reorderEntryAttachments = React.useCallback(
    (
      entryId: string,
      ordered: Array<{ kind: 'doc'; id: string } | { kind: 'link'; id: string }>
    ): void => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.entryId !== entryId) return doc;
          const nextOrder = ordered.findIndex((item) => item.kind === 'doc' && item.id === doc.id);
          if (nextOrder < 0) return doc;
          return { ...doc, sortOrder: nextOrder };
        })
      );
      setLinks((prev) =>
        prev.map((link) => {
          if (link.entryId !== entryId) return link;
          const nextOrder = ordered.findIndex((item) => item.kind === 'link' && item.id === link.id);
          if (nextOrder < 0) return link;
          return { ...link, sortOrder: nextOrder };
        })
      );
      const docSvc = new DocumentService(spContext);
      const linkSvc = new LinkService(spContext);
      ordered.forEach((item, index) => {
        if (item.kind === 'doc') {
          docSvc.update(item.id, { sortOrder: index }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('reorderEntryAttachments: doc persist failed', err);
          });
        } else {
          linkSvc.update(item.id, { sortOrder: index }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('reorderEntryAttachments: link persist failed', err);
          });
        }
      });
      if (tripId) {
        writeAttachmentOrder(tripId, entryId, ordered);
      }
    },
    [spContext, tripId]
  );

  const value = React.useMemo(
    (): AttachmentsContextValue => ({
      documents,
      links,
      loading,
      error,
      docsForEntry,
      linksForEntry,
      addDocument,
      updateDocument,
      deleteDocument,
      reorderEntryDocuments,
      reorderEntryAttachments,
      addLink,
      updateLink,
      deleteLink,
      reorderEntryLinks,
      highlightedDocumentId,
      setHighlightedDocumentId,
      highlightedLinkId,
      setHighlightedLinkId
    }),
    [
      documents,
      links,
      loading,
      error,
      docsForEntry,
      linksForEntry,
      addDocument,
      updateDocument,
      deleteDocument,
      reorderEntryDocuments,
      reorderEntryAttachments,
      addLink,
      updateLink,
      deleteLink,
      reorderEntryLinks,
      highlightedDocumentId,
      highlightedLinkId
    ]
  );

  return <AttachmentsContext.Provider value={value}>{children}</AttachmentsContext.Provider>;
};

export function useAttachments(): AttachmentsContextValue {
  const ctx = React.useContext(AttachmentsContext);
  if (!ctx) throw new Error('useAttachments must be used within AttachmentsProvider');
  return ctx;
}

