import * as React from 'react';
import { TripWorkspaceProvider, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalProvider } from '../../context/JournalContext';
import { AttachmentsProvider } from '../../context/AttachmentsContext';
import { PlacesProvider } from '../../context/PlacesContext';
import { useJournal } from '../../context/JournalContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { TripHero } from './TripHero';
import { RouteStrip } from '../maps/RouteStrip';
import { TripStatsStrip } from './TripStatsStrip';
import { TripContent } from './TripContent';
import { SharedTripView } from './SharedTripView';
import { ConfigPanel } from './ConfigPanel';
import { EditTripPanel } from './EditTripPanel';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import * as XLSX from 'xlsx';
import { formatCurrency, sumByCategory, sumByPaymentStatus } from '../../utils/financialUtils';
import { useConfig } from '../../context/ConfigContext';
import { JournalPdfExport } from '../export/JournalPdfExport';
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
    convertToHomeCurrency,
    setSelectedDayId,
    setMainWorkspaceTab
  } = useTripWorkspace();
  const { config } = useConfig();
  const { allEntries: journalEntries, allTripPhotos, commentsForEntry } = useJournal();
  const { documents, links, setHighlightedDocumentId, setHighlightedLinkId } = useAttachments();
  const [configOpen, setConfigOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
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

  React.useEffect(() => {
    const onOpenJournalExport = (): void => {
      setExportOpen(true);
      setMainWorkspaceTab('journal');
    };
    window.addEventListener('open-journal-export', onOpenJournalExport);
    return () => window.removeEventListener('open-journal-export', onOpenJournalExport);
  }, [setMainWorkspaceTab]);

  const sharedPreviewWasOnRef = React.useRef(false);
  React.useEffect(() => {
    if (sharedPreview && !sharedPreviewWasOnRef.current) {
      setMainWorkspaceTab('itinerary');
    }
    sharedPreviewWasOnRef.current = sharedPreview;
  }, [sharedPreview, setMainWorkspaceTab]);

  type SearchResult = {
    id: string;
    kind: 'itinerary' | 'journal' | 'photo' | 'document' | 'link';
    dayId: string;
    title: string;
    subtitle: string;
    url?: string;
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
      const hay = `${d.fileName} ${d.title} ${d.notes}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: d.id,
          kind: 'document',
          dayId: d.dayId,
          title: d.fileName || d.title,
          subtitle: `${d.documentType}${d.dayId ? ` · ${dayLabel(d.dayId)}` : ''}`,
          url: d.fileUrl
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
          subtitle: l.url,
          url: l.url
        });
      }
    }
    for (const p of allTripPhotos) {
      const hay = `${p.caption} ${p.fileUrl}`.toLowerCase();
      if (hay.includes(searchQuery)) {
        out.push({
          id: p.id,
          kind: 'photo',
          dayId: p.dayId,
          title: p.caption?.trim() || 'Photo',
          subtitle: `Day: ${dayLabel(p.dayId)}`
        });
      }
    }
    return out;
  }, [searchQuery, localEntries, journalEntries, documents, links, allTripPhotos, dayLabel]);

  const groupedResults = React.useMemo(() => {
    return {
      itinerary: searchResults.filter((x) => x.kind === 'itinerary'),
      journal: searchResults.filter((x) => x.kind === 'journal'),
      photo: searchResults.filter((x) => x.kind === 'photo'),
      document: searchResults.filter((x) => x.kind === 'document'),
      link: searchResults.filter((x) => x.kind === 'link')
    };
  }, [searchResults]);

  const exportTripToExcel = React.useCallback((): void => {
    if (!trip) return;
    const orderedDays = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
    const workbook = XLSX.utils.book_new();

    const totalBudget = sumByPaymentStatus(localEntries, 'all', convertToHomeCurrency);
    const spent = sumByPaymentStatus(localEntries, 'paid', convertToHomeCurrency);
    const remaining = sumByPaymentStatus(localEntries, 'unpaid', convertToHomeCurrency);
    const byCategory = sumByCategory(localEntries, convertToHomeCurrency);
    const summaryRows: Array<Record<string, string | number>> = [
      { Field: 'Trip title', Value: trip.title },
      { Field: 'Date range', Value: `${trip.dateStart} to ${trip.dateEnd}` },
      { Field: 'Total budget', Value: formatCurrency(totalBudget, config.homeCurrency) },
      { Field: 'Spent so far', Value: formatCurrency(spent, config.homeCurrency) },
      { Field: 'Remaining', Value: formatCurrency(remaining, config.homeCurrency) }
    ];
    Object.keys(byCategory).forEach((key) => summaryRows.push({ Field: `Category: ${key}`, Value: formatCurrency(byCategory[key] || 0, config.homeCurrency) }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    for (const day of orderedDays) {
      const perDayPortion = (entry: typeof localEntries[number]): number => {
        if (entry.category === 'Accommodation' && entry.dateStart && entry.dateEnd) {
          const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
          const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
          const current = new Date(`${day.calendarDate}T00:00:00.000Z`);
          const nights = Math.floor((end.getTime() - start.getTime()) / 86400000);
          if (nights > 0 && current.getTime() >= start.getTime() && current.getTime() < end.getTime()) return entry.amount / nights;
        }
        if (entry.category === 'Cruise' && entry.embarksDate && entry.disembarksDate) {
          const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
          const end = new Date(`${entry.disembarksDate}T00:00:00.000Z`);
          const current = new Date(`${day.calendarDate}T00:00:00.000Z`);
          const cruiseDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
          if (cruiseDays > 0 && current.getTime() >= start.getTime() && current.getTime() <= end.getTime()) return entry.amount / cruiseDays;
        }
        return entry.amount;
      };
      const rows = localEntries
        .filter((e) => {
          if (e.dayId === day.id) return true;
          if (e.category === 'Accommodation' && e.dateStart && e.dateEnd) return day.calendarDate >= e.dateStart && day.calendarDate < e.dateEnd;
          if (e.category === 'Cruise' && e.embarksDate && e.disembarksDate) return day.calendarDate >= e.embarksDate && day.calendarDate <= e.disembarksDate;
          return false;
        })
        .map((e) => ({
          Time: e.timeStart,
          Title: e.title,
          Category: e.category,
          Supplier: e.supplier,
          Location: e.location || '',
          DecisionStatus: e.decisionStatus,
          BookingStatus: e.bookingStatus,
          PaymentStatus: e.paymentStatus,
          'Amount (original)': formatCurrency(perDayPortion(e), e.currency || 'NZD'),
          [`Amount (${config.homeCurrency})`]: formatCurrency(convertToHomeCurrency(perDayPortion(e), e.currency || 'NZD'), config.homeCurrency),
          Notes: e.notes
        }));
      const safeTitle = `Day ${day.dayNumber} - ${day.displayTitle}`.slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), safeTitle || `Day ${day.dayNumber}`);
    }

    XLSX.writeFile(workbook, `${trip.title.replace(/[^\w-]+/g, '_') || 'trip'}-itinerary.xlsx`);
  }, [trip, tripDays, localEntries, convertToHomeCurrency, config.homeCurrency]);

  const scrollToResult = React.useCallback((selector: string): void => {
    let attempts = 0;
    const run = (): void => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add(styles.searchFlash);
        window.setTimeout(() => el.classList.remove(styles.searchFlash), 1500);
        return;
      }
      attempts += 1;
      if (attempts < 8) {
        window.setTimeout(run, 120);
      }
    };
    run();
  }, []);

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
                <svg viewBox="0 0 16 16" width={12} height={12} fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Search
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
                className={styles.settingsButton}
                onClick={() => setExportOpen((v) => !v)}
                disabled={deletingTrip}
              >
                Export
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
              {(['itinerary', 'journal', 'photo', 'document', 'link'] as const).map((group) => {
                const rows = groupedResults[group];
                if (!rows.length) return null;
                return (
                  <div key={group} className={styles.searchGroup}>
                    <div className={styles.searchGroupTitle}>
                      {group === 'itinerary' ? 'Itinerary' : group === 'journal' ? 'Journal' : group === 'photo' ? 'Photos' : group === 'document' ? 'Documents' : 'Links'}
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
                            window.setTimeout(() => {
                              scrollToResult(r.kind === 'itinerary' ? `[data-entry-id="${r.id}"]` : `[data-journal-id="${r.id}"]`);
                            }, 80);
                          } else if (r.kind === 'photo') {
                            if (r.dayId) setSelectedDayId(r.dayId);
                            setMainWorkspaceTab('photos');
                            window.setTimeout(() => {
                              scrollToResult(`[data-photo-id="${r.id}"]`);
                            }, 80);
                          } else if (r.kind === 'document') {
                            if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
                            setHighlightedDocumentId(null);
                          } else {
                            if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
                            setHighlightedLinkId(null);
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
      <div className={styles.workspaceBody} data-th-workspace-body>
        <TripHero trip={trip} onEdit={() => setEditOpen(true)} showEditButton={!sharedPreview} />
        {sharedPreview ? null : <TripStatsStrip />}
        <RouteStrip />
        {sharedPreview ? (
          <ErrorBoundary fallbackTitle="Something went wrong in shared view">
            <SharedTripView />
          </ErrorBoundary>
        ) : (
          <TripContent />
        )}
      </div>
      {exportOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExportOpen(false);
          }}
        >
          <div className={styles.modalDialog} role="dialog" aria-modal="true" aria-label="Export trip">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <div className={styles.searchRow}>
                <button type="button" className={styles.settingsButton} onClick={exportTripToExcel}>
                  Export itinerary to Excel
                </button>
                <button type="button" className={styles.settingsButton} onClick={() => setExportOpen(false)}>
                  Close
                </button>
              </div>
              <JournalPdfExport
                trip={trip}
                tripDays={tripDays}
                entries={journalEntries}
                photos={allTripPhotos}
                commentsForEntry={commentsForEntry}
              />
            </div>
          </div>
        </div>
      ) : null}
      <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
      <EditTripPanel trip={trip} isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={updateTrip} />
    </div>
  );
};

export const TripWorkspace: React.FC<ITripWorkspaceProps> = (props) => {
  return (
    <TripWorkspaceProvider tripId={props.tripId} onBack={props.onBack}>
      <JournalProvider>
        <PlacesProvider>
          <AttachmentsProvider>
            <TripWorkspaceLayout {...props} />
          </AttachmentsProvider>
        </PlacesProvider>
      </JournalProvider>
    </TripWorkspaceProvider>
  );
};
