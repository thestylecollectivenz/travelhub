import * as React from 'react';
import { TripWorkspaceProvider, useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalProvider } from '../../context/JournalContext';
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
    setSharedPreview
  } = useTripWorkspace();
  const [configOpen, setConfigOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
        <TripWorkspaceLayout {...props} />
      </JournalProvider>
    </TripWorkspaceProvider>
  );
};
