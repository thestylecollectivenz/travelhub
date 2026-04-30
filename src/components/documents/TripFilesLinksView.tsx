import * as React from 'react';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { resolveAbsoluteUrl } from '../../utils/resolveAbsoluteUrl';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import styles from './TripDocumentsView.module.css';

type KindFilter = 'all' | 'documents' | 'links';
export interface TripFilesLinksViewProps {
  includeDocuments?: boolean;
}

export const TripFilesLinksView: React.FC<TripFilesLinksViewProps> = ({ includeDocuments = true }) => {
  const { documents, links } = useAttachments();
  const { tripDays } = useTripWorkspace();
  const [kind, setKind] = React.useState<KindFilter>('all');
  const [dayFilter, setDayFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const dayLabel = React.useCallback((dayId: string): string => {
    const d = tripDays.find((x) => x.id === dayId);
    if (!d) return 'Unlinked';
    if (d.dayType === 'PreTrip') return 'Pre-trip';
    return `Day ${d.dayNumber} — ${d.displayTitle}`;
  }, [tripDays]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Array<{ id: string; kind: 'document' | 'link'; title: string; url: string; dayId: string; meta: string }> = [];
    if (includeDocuments && (kind === 'all' || kind === 'documents')) {
      for (const d of documents) {
        out.push({ id: d.id, kind: 'document', title: d.fileName || d.title, url: d.fileUrl, dayId: d.dayId, meta: d.documentType });
      }
    }
    if (kind === 'all' || kind === 'links') {
      for (const l of links) {
        out.push({ id: l.id, kind: 'link', title: l.linkTitle, url: l.url, dayId: l.dayId, meta: l.linkType });
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
        <select className={styles.select} value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="all">All days</option>
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
              <a
                className={styles.name}
                href={resolveAbsoluteUrl(r.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => {
                  ev.preventDefault();
                  openDocumentUrl(r.url);
                }}
              >
                {r.title}
              </a>
              <span className={styles.meta}>{r.meta}</span>
              <span className={styles.meta}>{r.dayId ? dayLabel(r.dayId) : 'No day'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
