import * as React from 'react';
import type { EntryDocumentType } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './TripDocumentsView.module.css';

type KindFilter = 'all' | 'documents' | 'links';
export interface TripFilesLinksViewProps {
  includeDocuments?: boolean;
}

export const TripFilesLinksView: React.FC<TripFilesLinksViewProps> = ({ includeDocuments = true }) => {
  const { documents, links, deleteDocument, deleteLink, updateDocument, updateLink } = useAttachments();
  const { tripDays, selectedDayId, setSelectedDayId, mainWorkspaceTab, localEntries } = useTripWorkspace();
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [dayFilter, setDayFilter] = React.useState('all');
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [docDraft, setDocDraft] = React.useState({ title: '', documentType: 'Other' as EntryDocumentType, notes: '' });
  const [linkDraft, setLinkDraft] = React.useState({ url: '', linkTitle: '' });

  React.useEffect(() => {
    if (mainWorkspaceTab === 'files' && selectedDayId) {
      setDayFilter(selectedDayId);
    }
  }, [mainWorkspaceTab, selectedDayId]);
  const [search, setSearch] = React.useState('');

  const dayLabel = React.useCallback((dayId: string): string => {
    const d = tripDays.find((x) => x.id === dayId);
    if (!d) return 'Unlinked';
    if (d.dayType === 'PreTrip') return 'Pre-trip';
    return `Day ${d.dayNumber} — ${d.displayTitle}`;
  }, [tripDays]);

  const entryTitleFor = React.useCallback((entryId: string): string => {
    if (!entryId) return '';
    for (const e of localEntries) {
      if (e.id === entryId) return e.title || '';
      const sub = (e.subItems ?? []).find((s) => s.id === entryId);
      if (sub) {
        const parentTitle = (e.title || '').trim();
        const subTitle = sub.title || 'Option';
        return parentTitle ? `${subTitle} (${parentTitle})` : subTitle;
      }
    }
    return '';
  }, [localEntries]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Array<{
      id: string;
      kind: 'document' | 'link';
      title: string;
      url: string;
      dayId: string;
      entryId: string;
      meta: string;
    }> = [];
    if (includeDocuments && (kind === 'all' || kind === 'documents')) {
      for (const d of documents) {
        out.push({
          id: d.id,
          kind: 'document',
          title: d.fileName || d.title,
          url: d.fileUrl,
          dayId: d.dayId,
          entryId: d.entryId,
          meta: d.documentType
        });
      }
    }
    if (kind === 'all' || kind === 'links') {
      for (const l of links) {
        out.push({
          id: l.id,
          kind: 'link',
          title: l.linkTitle,
          url: l.url,
          dayId: l.dayId,
          entryId: l.entryId,
          meta: l.linkType
        });
      }
    }
    return out.filter((r) => {
      if (dayFilter !== 'all' && r.dayId !== dayFilter) return false;
      if (!q) return true;
      return `${r.title} ${r.url} ${r.meta}`.toLowerCase().includes(q);
    });
  }, [documents, links, kind, dayFilter, search, includeDocuments]);

  const startEdit = React.useCallback(
    (row: (typeof rows)[number]) => {
      setEditingKey(`${row.kind}-${row.id}`);
      if (row.kind === 'document') {
        const doc = documents.find((d) => d.id === row.id);
        if (doc) {
          setDocDraft({
            title: doc.title || doc.fileName || '',
            documentType: doc.documentType,
            notes: doc.notes || ''
          });
        }
      } else {
        const link = links.find((l) => l.id === row.id);
        if (link) {
          setLinkDraft({ url: link.url, linkTitle: link.linkTitle });
        }
      }
    },
    [documents, links]
  );

  return (
    <section className={styles.root} aria-label="Files and links">
      <header className={styles.header}>
        <h2 className={styles.title}>Files & Links</h2>
      </header>
      <div className={styles.filters}>
        <input className={styles.input} placeholder="Search files and links" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
          <option value="all">All</option>
          {includeDocuments ? <option value="documents">Documents</option> : null}
          <option value="links">Links</option>
        </select>
        <select
          className={styles.select}
          value={dayFilter}
          onChange={(e) => {
            const v = e.target.value;
            setDayFilter(v);
            if (v === 'all') setSelectedDayId('');
            else setSelectedDayId(v);
          }}
        >
          <option value="all">All days (entire trip)</option>
          {tripDays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber} — ${d.displayTitle}`}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? <div className={styles.empty}>No files or links</div> : (
        <div className={styles.list}>
          {rows.map((r) => {
            const editKey = `${r.kind}-${r.id}`;
            const isEditing = editingKey === editKey;
            return (
              <div key={editKey} className={isEditing ? styles.rowEditing : styles.row}>
                {isEditing && r.kind === 'document' ? (
                  <>
                    <input className={styles.input} value={docDraft.title} onChange={(e) => setDocDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" />
                    <select className={styles.select} value={docDraft.documentType} onChange={(e) => setDocDraft((prev) => ({ ...prev, documentType: e.target.value as EntryDocumentType }))}>
                      <option value="Ticket">Ticket</option>
                      <option value="Confirmation">Confirmation</option>
                      <option value="Image">Image</option>
                      <option value="PDF">PDF</option>
                      <option value="Other">Other</option>
                    </select>
                    <input className={styles.input} value={docDraft.notes} onChange={(e) => setDocDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" />
                    <button
                      type="button"
                      className={styles.button}
                      disabled={saving}
                      onClick={() => {
                        setSaving(true);
                        updateDocument(r.id, {
                          title: docDraft.title.trim(),
                          documentType: docDraft.documentType,
                          notes: docDraft.notes.trim()
                        })
                          .then(() => {
                            setEditingKey(null);
                            setSaving(false);
                          })
                          .catch((err) => {
                            setSaving(false);
                            console.error(err);
                          });
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className={styles.button} onClick={() => setEditingKey(null)}>
                      Cancel
                    </button>
                  </>
                ) : isEditing && r.kind === 'link' ? (
                  <>
                    <input className={styles.input} value={linkDraft.url} onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))} placeholder="URL" />
                    <input className={styles.input} value={linkDraft.linkTitle} onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkTitle: e.target.value }))} placeholder="Title" />
                    <button
                      type="button"
                      className={styles.button}
                      disabled={saving || !linkDraft.url.trim()}
                      onClick={() => {
                        setSaving(true);
                        updateLink(r.id, {
                          url: linkDraft.url.trim(),
                          linkTitle: linkDraft.linkTitle.trim() || linkDraft.url.trim()
                        })
                          .then(() => {
                            setEditingKey(null);
                            setSaving(false);
                          })
                          .catch((err) => {
                            setSaving(false);
                            console.error(err);
                          });
                      }}
                    >
                      Save link
                    </button>
                    <button type="button" className={styles.button} onClick={() => setEditingKey(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.badge}>{r.kind === 'document' ? 'Document' : 'Link'}</span>
                    <button
                      type="button"
                      className={styles.name}
                      onClick={(ev) => {
                        ev.preventDefault();
                        openDocumentUrl(r.url);
                      }}
                    >
                      {r.title}
                    </button>
                    <span className={styles.metaLine}>
                      {[r.meta, r.dayId ? dayLabel(r.dayId) : '', entryTitleFor(r.entryId)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className={styles.rowActions}>
                      <button type="button" className={styles.inlineAction} onClick={() => startEdit(r)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.inlineActionMuted}
                        onClick={() => {
                          void (async () => {
                            const label = r.kind === 'document' ? 'document' : 'link';
                            if (!(await confirmUserAction(`Delete this ${label}?`))) return;
                            if (r.kind === 'document') deleteDocument(r.id).catch(console.error);
                            else deleteLink(r.id).catch(console.error);
                          })();
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
