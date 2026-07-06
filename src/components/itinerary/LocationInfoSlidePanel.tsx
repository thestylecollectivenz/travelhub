import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes } from '../../utils/locationInfoEntry';
import { usePlaces } from '../../context/PlacesContext';
import { LocationInfoPanelContent } from './LocationInfoPanelContent';
import { ItineraryCardEdit } from './ItineraryCardEdit';
import cardStyles from './ItineraryCard.module.css';
import styles from './LocationInfoSlidePanel.module.css';

export interface LocationInfoSlidePanelProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
}

export const LocationInfoSlidePanel: React.FC<LocationInfoSlidePanelProps> = ({ entry, calendarDate, onClose }) => {
  const { editingCardId, setEditingCardId, updateEntry } = useTripWorkspace();
  const { canEditItinerary } = useTripPermissions();
  const { placeById } = usePlaces();

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape' && editingCardId !== entry.id) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId]);

  if (!entry || typeof document === 'undefined') return null;

  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';
  const isEditing = canEditItinerary && editingCardId === entry.id;

  if (isEditing) {
    return ReactDOM.createPortal(
      <div className={cardStyles.portalEditRoot} role="presentation">
        <div className={cardStyles.portalEditInner}>
          <ItineraryCardEdit
            key={entry.id}
            entry={entry}
            calendarDate={calendarDate}
            onSave={(saved) => {
              updateEntry(saved);
              setEditingCardId(null);
            }}
            onCancel={() => setEditingCardId(null)}
            onDelete={() => {
              setEditingCardId(null);
              onClose();
            }}
          />
        </div>
      </div>,
      document.body
    );
  }

  const panel = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Location info — ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {canEditItinerary ? (
              <button type="button" className={styles.headerBtn} onClick={() => setEditingCardId(entry.id)}>
                Edit
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        <div className={styles.body}>
          <LocationInfoPanelContent entry={entry} readOnly={!canEditItinerary} />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
