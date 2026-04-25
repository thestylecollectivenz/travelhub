import * as React from 'react';
import type { EntryDocumentType } from '../../models';
import { useAttachments } from '../../context/AttachmentsContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import styles from './TripDocumentsView.module.css';

function DocumentTypeIcon({ type }: { type: EntryDocumentType }): React.ReactElement {
  if (type === 'PDF') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (type === 'Image') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="6" cy="6" r="1.1" fill="currentColor" />
        <path d="M3.8 11l2.4-2.4 2.2 1.8 2.1-2.3L12.2 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'Ticket') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 5.2h12v2a1.4 1.4 0 0 0 0 2.8v2H2v-2a1.4 1.4 0 1 0 0-2.8v-2Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5.2v6.8" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.2 1.2" />
      </svg>
    );
  }
  if (type === 'Confirmation') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 5.2l5.5 3.8 5.5-3.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M6.3 10.6l1.1 1.1 2.3-2.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export const TripDocumentsView: React.FC = () => {
  const { documents, addDocument, deleteDocument, highlightedDocumentId } = useAttachments();
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | EntryDocumentType>('all');
  const [dayFilter, setDayFilter] = React.useState<string>('all');
  const [docType, setDocType] = React.useState<EntryDocumentType>('Other');
  const [docNotes, setDocNotes] = React.useState('');
  const [docDayId, setDocDayId] = React.useState('');
  const [docEntryId, setDocEntryId] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  const dayLabel = React.useCallback(
    (dayId: string): string => days.find((d) => d.id === dayId)?.displayTitle ?? 'Unlinked',
    [days]
  );
  const entryLabel = React.useCallback(
    (entryId: string): string => localEntries.find((e) => e.id === entryId)?.title ?? 'Unlinked',
    [localEntries]
  );

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeFilter !== 'all' && d.documentType !== typeFilter) return false;
      if (dayFilter !== 'all' && d.dayId !== dayFilter) return false;
      if (!q) return true;
      return (d.fileName || d.title).toLowerCase().includes(q) || (d.notes || '').toLowerCase().includes(q);
    });
  }, [documents, typeFilter, dayFilter, search]);

  return (
    <section className={styles.root} aria-label="Trip documents">
      <header className={styles.header}>
        <h2 className={styles.title}>Documents</h2>
        <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
      </header>

      <div className={styles.filters}>
        <input className={styles.input} placeholder="Search file name or notes" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | EntryDocumentType)}>
          <option value="all">All document types</option>
          <option value="Ticket">Ticket</option>
          <option value="Confirmation">Confirmation</option>
          <option value="Image">Image</option>
          <option value="PDF">PDF</option>
          <option value="Other">Other</option>
        </select>
        <select className={styles.select} value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="all">All days</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber} — {d.displayTitle}
            </option>
          ))}
        </select>
        <select className={styles.select} value={docType} onChange={(e) => setDocType(e.target.value as EntryDocumentType)}>
          <option value="Ticket">Ticket</option>
          <option value="Confirmation">Confirmation</option>
          <option value="Image">Image</option>
          <option value="PDF">PDF</option>
          <option value="Other">Other</option>
        </select>
        <select className={styles.select} value={docDayId} onChange={(e) => setDocDayId(e.target.value)}>
          <option value="">No day linked</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber} — {d.displayTitle}
            </option>
          ))}
        </select>
        <select className={styles.select} value={docEntryId} onChange={(e) => setDocEntryId(e.target.value)}>
          <option value="">No entry linked</option>
          {localEntries
            .filter((e) => !docDayId || e.dayId === docDayId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title || 'Untitled'}
              </option>
            ))}
        </select>
        <input className={styles.input} placeholder="Upload notes (optional)" value={docNotes} onChange={(e) => setDocNotes(e.target.value)} />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !trip) return;
            setUploading(true);
            addDocument({
              file,
              dayId: docDayId,
              entryId: docEntryId,
              documentType: docType,
              notes: docNotes.trim()
            })
              .then(() => {
                setDocNotes('');
                e.target.value = '';
                setUploading(false);
              })
              .catch((err) => {
                setUploading(false);
                // eslint-disable-next-line no-console
                console.error(err);
              });
          }}
        />
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>No documents yet</div>
      ) : (
        <div className={styles.list}>
          {visible.map((d) => (
            <div
              key={d.id}
              className={styles.row}
              style={highlightedDocumentId === d.id ? { outline: '2px solid var(--color-primary)' } : undefined}
            >
              <span aria-hidden><DocumentTypeIcon type={d.documentType} /></span>
              <a className={styles.name} href={d.fileUrl} target="_blank" rel="noreferrer">
                {d.fileName || d.title}
              </a>
              <span className={styles.badge}>{d.documentType}</span>
              <span className={styles.meta}>{d.dayId ? dayLabel(d.dayId) : 'No day'}</span>
              <span className={styles.meta}>{d.entryId ? entryLabel(d.entryId) : 'No entry'}</span>
              <button type="button" className={styles.button} onClick={() => window.open(d.fileUrl, '_blank', 'noopener,noreferrer')}>
                Open
              </button>
              <button type="button" className={styles.button} onClick={() => deleteDocument(d.id).catch(console.error)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

