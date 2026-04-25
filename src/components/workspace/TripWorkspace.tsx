import * as React from 'react';
import { TripWorkspaceProvider, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalProvider } from '../../context/JournalContext';
import { AttachmentsProvider } from '../../context/AttachmentsContext';
import { useJournal } from '../../context/JournalContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { TripHero } from './TripHero';
import { TripStatsStrip } from './TripStatsStrip';
import { TripContent } from './TripContent';
import { SharedTripView } from './SharedTripView';
import { ConfigPanel } from './ConfigPanel';
import { EditTripPanel } from './EditTripPanel';
import styles from './TripWorkspace.module.css';

export interface ITripWorkspaceProps {
  tripId: string;
  onBack: () => void;
}

const TripWorkspaceLayout: React.FC<ITripWorkspaceProps> = ({ tripId, onBack }) => {
  const {
    trip,
    loading,
    error,
    retryLoad,
    updateTrip,
    deleteTrip,
    deletingTrip,
    deleteTripError,
    clearDeleteTripError,
    sharedPreview,
    setSharedPreview,
    tripDays,
    localEntries,
    setSelectedDayId,
    setMainWorkspaceTab
  } = useTripWorkspace();
  const { allEntries: journalEntries } = useJournal();
  const { documents, links, setHighlightedDocumentId, setHighlightedLinkId } = useAttachments();
  const [configOpen, setConfigOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    if (!searchOpen) {
      setSearchInput('');
      setSearchQuery('');
      setHighlightedDocumentId(null);
      setHighlightedLinkId(null);
    }
  }, [searchOpen, setHighlightedDocumentId, setHighlightedLinkId]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  type SearchResult = {
    id: string;
    kind: 'itinerary' | 'journal' | 'document' | 'link';
    dayId: string;
    title: string;
    subtitle: string;
  };

  const dayLabel = React.useCallback(
    (dayId: string): string => tripDays.find((d) => d.id === dayId)?.displayTitle ?? '',
    [tripDays]
  );

  const searchResults = React.useMemo((): SearchResult[] => {
    if (!searchQuery) return [];
    const out: SearchResult[] = [];
    for (const e of localEntries) {
      const hay = `${e.title} ${e.supplier} ${e.notes} ${e.location ?? ''}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: e.id,
          kind: 'itinerary',
          dayId: e.dayId,
          title: e.title || 'Untitled itinerary entry',
          subtitle: `Day: ${dayLabel(e.dayId)}`
        });
      }
    }
    for (const j of journalEntries) {
      const hay = `${j.entryText} ${j.location}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: j.id,
          kind: 'journal',
          dayId: j.dayId,
          title: (j.entryText || '').replace(/<[^>]+>/g, '').slice(0, 80) || 'Journal entry',
          subtitle: `Day: ${dayLabel(j.dayId)}`
        });
      }
    }
    for (const d of documents) {
      const hay = `${d.fileName} ${d.notes}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: d.id,
          kind: 'document',
          dayId: d.dayId,
          title: d.fileName || d.title,
          subtitle: `${d.documentType}${d.dayId ? ` · ${dayLabel(d.dayId)}` : ''}`
        });
      }
    }
    for (const l of links) {
      const hay = `${l.linkTitle} ${l.url} ${l.notes}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: l.id,
          kind: 'link',
          dayId: l.dayId,
          title: l.linkTitle,
          subtitle: l.url
        });
      }
    }
    return out;
  }, [searchQuery, localEntries, journalEntries, documents, links, dayLabel]);

  const groupedResults = React.useMemo(() => {
    return {
      itinerary: searchResults.filter((x) => x.kind === 'itinerary'),
      journal: searchResults.filter((x) => x.kind === 'journal'),
      document: searchResults.filter((x) => x.kind === 'document'),
      link: searchResults.filter((x) => x.kind === 'link')
    };
  }, [searchResults]);

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-sand-600)',
    fontSize: 'var(--font-size-sm)'
  };

  const errorStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-4)',
    minHeight: '60vh',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-warning)',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'center',
    padding: 'var(--space-6)'
  };

  const retryButtonStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-5)',
    background: 'transparent',
    color: 'var(--color-primary)',
    border: 'var(--border-emphasis)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer'
  };

  if (loading) {
    return <div style={loadingStyle}>Loading trip…</div>;
  }

  if (error || !trip) {
    return (
      <div style={errorStyle}>
        <p>{error ?? 'Trip could not be loaded.'}</p>
        <button type="button" style={retryButtonStyle} onClick={retryLoad}>
          Retry
        </button>
        <button type="button" style={retryButtonStyle} onClick={onBack}>
          ← All Trips
        </button>
      </div>
    );
  }

  return (
    <div className={styles.workspace} data-trip-id={tripId}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.backButton} onClick={onBack} disabled={deletingTrip}>
          ← All Trips
        </button>
        <div className={styles.toolbarActions}>
          {sharedPreview ? (
            <button type="button" className={styles.settingsButton} onClick={() => setSharedPreview(false)}>
              Exit preview
            </button>
          ) : confirmDelete ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deletePrompt}>{deletingTrip ? 'Deleting…' : 'Delete this trip?'}</span>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                disabled={deletingTrip}
                onClick={() => {
                  deleteTrip().catch(console.error);
                }}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className={styles.deleteCancelButton}
                disabled={deletingTrip}
                onClick={() => {
                  setConfirmDelete(false);
                  clearDeleteTripError();
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button type="button" className={styles.settingsButton} onClick={() => setSharedPreview(true)}>
                Preview shared view
              </button>
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search trip content"
                disabled={deletingTrip}
              >
                <span aria-hidden>🔎</span> Search
              </button>
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => setConfigOpen(true)}
                aria-label="Open settings"
                disabled={deletingTrip}
              >
                <span aria-hidden>⚙</span> Settings
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                disabled={deletingTrip}
                onClick={() => {
                  setConfirmDelete(true);
                  clearDeleteTripError();
                }}
              >
                <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
                  <path d="M3 4.5h10M6 4.5v-1h4v1M5.5 6v6m5-6v6M4.5 4.5l.5 8a1 1 0 0 0 1 .9h3.9a1 1 0 0 0 1-.9l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete trip
              </button>
            </>
          )}
        </div>
      </div>
      {searchOpen ? (
        <div className={styles.searchPanel}>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              placeholder="Search itinerary, journal, documents, links..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            <button type="button" className={styles.settingsButton} onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </div>
          {searchQuery ? (
            <div className={styles.searchResults}>
              {(['itinerary', 'journal', 'document', 'link'] as const).map((group) => {
                const rows = groupedResults[group];
                if (!rows.length) return null;
                return (
                  <div key={group} className={styles.searchGroup}>
                    <div className={styles.searchGroupTitle}>
                      {group === 'itinerary' ? 'Itinerary' : group === 'journal' ? 'Journal' : group === 'document' ? 'Documents' : 'Links'}
                    </div>
                    {rows.map((r) => (
                      <button
                        key={`${r.kind}-${r.id}`}
                        type="button"
                        className={styles.searchResultBtn}
                        onClick={() => {
                          if (r.kind === 'itinerary' || r.kind === 'journal') {
                            if (r.dayId) setSelectedDayId(r.dayId);
                            setMainWorkspaceTab(r.kind === 'itinerary' ? 'itinerary' : 'journal');
                          } else if (r.kind === 'document') {
                            setMainWorkspaceTab('documents');
                            setHighlightedDocumentId(r.id);
                          } else {
                            setMainWorkspaceTab('links');
                            setHighlightedLinkId(r.id);
                          }
                          setSearchOpen(false);
                        }}
                      >
                        <span className={styles.searchResultTitle}>{r.title}</span>
                        <span className={styles.searchResultMeta}>{r.subtitle}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {deleteTripError ? <div className={styles.deleteError}>{deleteTripError}</div> : null}
      <TripHero trip={trip} onEdit={() => setEditOpen(true)} showEditButton={!sharedPreview} />
      {sharedPreview ? null : <TripStatsStrip />}
      {sharedPreview ? <SharedTripView /> : <TripContent />}
      <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
      <EditTripPanel trip={trip} isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={updateTrip} />
    </div>
  );
};

export const TripWorkspace: React.FC<ITripWorkspaceProps> = (props) => {
  return (
    <TripWorkspaceProvider tripId={props.tripId} onBack={props.onBack}>
      <JournalProvider>
        <AttachmentsProvider>
          <TripWorkspaceLayout {...props} />
        </AttachmentsProvider>
      </JournalProvider>
    </TripWorkspaceProvider>
  );
};
