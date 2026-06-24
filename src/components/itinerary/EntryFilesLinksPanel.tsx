import * as React from 'react';
import type { EntryDocument, EntryDocumentType, EntryLink, EntryLinkType } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { EntryAttachmentsSortableList } from './EntryAttachmentsSortableList';
import linkSortStyles from './EntryLinksSortableList.module.css';
import styles from './EntryFilesLinksPanel.module.css';

export interface EntryFilesLinksPanelProps {
  entryId: string;
  docs: EntryDocument[];
  links: EntryLink[];
  /** Show add document / add link controls (day cards). */
  allowAdd?: boolean;
  toggleClassName?: string;
  onUploadDocument?: (file: File, documentType: EntryDocumentType, notes: string, title?: string) => Promise<void>;
  onAddLink?: (draft: { linkTitle: string; url: string; linkType: EntryLinkType; notes: string }) => Promise<void>;
}

export const EntryFilesLinksPanel: React.FC<EntryFilesLinksPanelProps> = ({
  entryId,
  docs,
  links,
  allowAdd = false,
  toggleClassName,
  onUploadDocument,
  onAddLink
}) => {
  const { updateDocument, deleteDocument, updateLink, deleteLink } = useAttachments();
  const [open, setOpen] = React.useState(() => docs.length + links.length > 0);
  const [editingDocId, setEditingDocId] = React.useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [docDraft, setDocDraft] = React.useState({ title: '', documentType: 'Other' as EntryDocumentType, notes: '' });
  const [linkDraft, setLinkDraft] = React.useState({
    linkTitle: '',
    url: '',
    linkType: 'Url' as EntryLinkType,
    notes: ''
  });
  const [attachAddMode, setAttachAddMode] = React.useState<'none' | 'document' | 'link'>('none');
  const [docType, setDocType] = React.useState<EntryDocumentType>('Other');
  const [docTitle, setDocTitle] = React.useState('');
  const [docNotes, setDocNotes] = React.useState('');
  const [docBusy, setDocBusy] = React.useState(false);
  const [linkBusy, setLinkBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const closeAddMode = React.useCallback(() => {
    setAttachAddMode('none');
    setDocTitle('');
    setDocNotes('');
    setLinkDraft({ linkTitle: '', url: '', linkType: 'Url', notes: '' });
  }, []);

  React.useEffect(() => {
    if (docs.length + links.length > 0) {
      setOpen(true);
    }
  }, [entryId, docs.length, links.length]);

  const total = docs.length + links.length;
  if (total === 0 && !allowAdd) {
    return null;
  }

  const toggleLabel = open
    ? 'Hide files & links ▴'
    : `Files & links (${total}) ▾`;

  return (
    <>
      <button type="button" className={toggleClassName ?? styles.attachToggle} onClick={() => setOpen((o) => !o)}>
        {total === 0 && allowAdd ? 'Files & links ▾' : toggleLabel}
      </button>
      {open ? (
        <div className={styles.quickLinks}>
          <EntryAttachmentsSortableList entryId={entryId} documents={docs} links={links} className={styles.quickLinks}>
            {(row, dragHandle) => {
              if (row.kind === 'doc') {
                const doc = row.item;
                return editingDocId === doc.id ? (
                  <div key={doc.id} className={styles.editRow}>
                    {dragHandle ? <span className={linkSortStyles.dragHandleSlot}>{dragHandle}</span> : null}
                    <input
                      className={styles.field}
                      value={docDraft.title}
                      onChange={(e) => setDocDraft((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <select
                      className={styles.field}
                      value={docDraft.documentType}
                      onChange={(e) => setDocDraft((prev) => ({ ...prev, documentType: e.target.value as EntryDocumentType }))}
                    >
                      <option value="Ticket">Ticket</option>
                      <option value="Confirmation">Confirmation</option>
                      <option value="Image">Image</option>
                      <option value="PDF">PDF</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      className={styles.field}
                      value={docDraft.notes}
                      onChange={(e) => setDocDraft((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                    />
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => {
                        updateDocument(doc.id, {
                          title: docDraft.title.trim(),
                          documentType: docDraft.documentType,
                          notes: docDraft.notes.trim()
                        })
                          .then(() => setEditingDocId(null))
                          .catch(console.error);
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className={styles.actionButtonMuted} onClick={() => setEditingDocId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span key={doc.id} className={styles.linkChip}>
                    {dragHandle}
                    <button
                      type="button"
                      className={styles.miniLink}
                      onClick={() => openDocumentUrl(doc.fileUrl)}
                      title={doc.title || doc.fileName}
                    >
                      {doc.title || doc.fileName || 'File'}
                    </button>
                    <button
                      type="button"
                      className={styles.linkChipAction}
                      aria-label="Edit document"
                      onClick={() => {
                        setEditingDocId(doc.id);
                        setEditingLinkId(null);
                        setDocDraft({
                          title: doc.title || doc.fileName || '',
                          documentType: doc.documentType,
                          notes: doc.notes || ''
                        });
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.linkChipAction}
                      aria-label="Delete document"
                      onClick={() => {
                        void (async () => {
                          if (!(await confirmUserAction('Remove this document?'))) return;
                          deleteDocument(doc.id).catch(console.error);
                        })();
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              }

              const link = row.item;
              return editingLinkId === link.id ? (
                <div key={link.id} className={styles.editRow}>
                  {dragHandle ? <span className={linkSortStyles.dragHandleSlot}>{dragHandle}</span> : null}
                  <input
                    className={styles.field}
                    value={linkDraft.linkTitle}
                    onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkTitle: e.target.value }))}
                    placeholder="Link title"
                  />
                  <input
                    className={styles.field}
                    value={linkDraft.url}
                    onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="URL"
                  />
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      updateLink(link.id, {
                        linkTitle: linkDraft.linkTitle.trim(),
                        url: linkDraft.url.trim()
                      })
                        .then(() => setEditingLinkId(null))
                        .catch(console.error);
                    }}
                  >
                    Save
                  </button>
                  <button type="button" className={styles.actionButtonMuted} onClick={() => setEditingLinkId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <span key={link.id} className={styles.linkChip}>
                  {dragHandle}
                  <button type="button" className={styles.miniLink} onClick={() => openDocumentUrl(link.url)} title={link.url}>
                    {link.linkTitle || link.url}
                  </button>
                  <button
                    type="button"
                    className={styles.linkChipAction}
                    aria-label="Edit link"
                    onClick={() => {
                      setEditingLinkId(link.id);
                      setEditingDocId(null);
                      setLinkDraft({ linkTitle: link.linkTitle, url: link.url, linkType: link.linkType, notes: link.notes || '' });
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={styles.linkChipAction}
                    aria-label="Delete link"
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmUserAction('Remove this link?'))) return;
                        deleteLink(link.id).catch(console.error);
                      })();
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            }}
          </EntryAttachmentsSortableList>
        </div>
      ) : null}
      {open && allowAdd ? (
        <>
          <div className={styles.addBar}>
            <button
              type="button"
              className={`${styles.addBtn} ${attachAddMode === 'document' ? styles.addBtnActive : ''}`}
              onClick={() => setAttachAddMode((m) => (m === 'document' ? 'none' : 'document'))}
            >
              Add document
            </button>
            <button
              type="button"
              className={`${styles.addBtn} ${attachAddMode === 'link' ? styles.addBtnActive : ''}`}
              onClick={() => setAttachAddMode((m) => (m === 'link' ? 'none' : 'link'))}
            >
              Add link
            </button>
          </div>
          {attachAddMode === 'document' && onUploadDocument ? (
            <div className={styles.addFormRow}>
              <input
                className={styles.fieldCompact}
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Title (optional)"
              />
              <select className={styles.fieldCompact} value={docType} onChange={(e) => setDocType(e.target.value as EntryDocumentType)}>
                <option value="Ticket">Ticket</option>
                <option value="Confirmation">Confirmation</option>
                <option value="Image">Image</option>
                <option value="PDF">PDF</option>
                <option value="Other">Other</option>
              </select>
              <input
                className={styles.fieldCompact}
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <button
                type="button"
                className={styles.actionButton}
                disabled={docBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {docBusy ? 'Uploading…' : 'Choose file'}
              </button>
              <button type="button" className={styles.actionButtonMuted} onClick={closeAddMode}>
                Cancel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileHidden}
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (!file || !onUploadDocument) return;
                  setDocBusy(true);
                  void onUploadDocument(file, docType, docNotes.trim(), docTitle.trim() || undefined)
                    .then(() => {
                      closeAddMode();
                    })
                    .catch(console.error)
                    .then(() => {
                      setDocBusy(false);
                      ev.target.value = '';
                    });
                }}
              />
            </div>
          ) : null}
          {attachAddMode === 'link' ? (
            <div className={styles.addFormRow}>
              <input
                className={styles.fieldCompact}
                placeholder="Link title"
                value={linkDraft.linkTitle}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkTitle: e.target.value }))}
              />
              <input
                className={styles.fieldCompact}
                placeholder="URL"
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
              />
              <button
                type="button"
                className={styles.actionButton}
                disabled={linkBusy || !linkDraft.url.trim() || (!onAddLink && allowAdd)}
                onClick={() => {
                  if (!onAddLink) return;
                  setLinkBusy(true);
                  void onAddLink({
                    linkTitle: linkDraft.linkTitle.trim() || linkDraft.url.trim(),
                    url: linkDraft.url.trim(),
                    linkType: linkDraft.linkType,
                    notes: linkDraft.notes.trim()
                  })
                    .then(() => {
                      closeAddMode();
                    })
                    .catch(console.error)
                    .then(() => setLinkBusy(false));
                }}
              >
                Save link
              </button>
              <button type="button" className={styles.actionButtonMuted} onClick={closeAddMode}>
                Cancel
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
};
