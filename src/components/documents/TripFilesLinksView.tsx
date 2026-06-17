import * as React from 'react';
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
  const { documents, links, deleteDocument, deleteLink } = useAttachments();
  const { tripDays, selectedDayId, setSelectedDayId, mainWorkspaceTab, localEntries } = useTripWorkspace();
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [dayFilter, setDayFilter] = React.useState('all');

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
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className={styles.row}>
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
              <span className={styles.meta}>{r.meta}</span>
              <span className={styles.meta}>{r.dayId ? dayLabel(r.dayId) : ''}</span>
              <span className={styles.meta}>{entryTitleFor(r.entryId)}</span>
              <button
                type="button"
                className={styles.button}
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
