import * as React from 'react';
import type { EntryDocument, EntryDocumentType, EntryLink } from '../models';
import { DocumentService } from '../services/DocumentService';
import { LinkService } from '../services/LinkService';
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
  }) => Promise<EntryDocument>;
  deleteDocument: (id: string) => Promise<void>;
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
        setDocuments(docs);
        setLinks(allLinks);
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

  const docsForEntry = React.useCallback(
    (entryId: string) => documents.filter((d) => d.entryId === entryId),
    [documents]
  );

  const linksForEntry = React.useCallback(
    (entryId: string) => links.filter((l) => l.entryId === entryId),
    [links]
  );

  const addDocument = React.useCallback(
    async (input: {
      file: File;
      dayId: string;
      entryId: string;
      documentType: EntryDocumentType;
      notes?: string;
    }): Promise<EntryDocument> => {
      if (!tripId) throw new Error('No trip loaded');
      const svc = new DocumentService(spContext);
      const created = await svc.uploadAndCreate(
        input.file,
        tripId,
        input.dayId,
        input.entryId,
        input.documentType,
        input.notes ?? '',
        webAbsoluteUrl,
        serverRelativeUrl
      );
      setDocuments((prev) => [...prev, created]);
      return created;
    },
    [spContext, tripId, webAbsoluteUrl, serverRelativeUrl]
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
      const created = await svc.create({
        title: input.linkTitle,
        tripId,
        dayId: input.dayId,
        entryId: input.entryId,
        linkType: input.linkType,
        url: input.url,
        linkTitle: input.linkTitle,
        notes: input.notes ?? ''
      });
      setLinks((prev) => [...prev, created]);
      return created;
    },
    [spContext, tripId]
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

  const value = React.useMemo(
    (): AttachmentsContextValue => ({
      documents,
      links,
      loading,
      error,
      docsForEntry,
      linksForEntry,
      addDocument,
      deleteDocument,
      addLink,
      updateLink,
      deleteLink,
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
      deleteDocument,
      addLink,
      updateLink,
      deleteLink,
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

