import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes } from '../../utils/locationInfoEntry';
import { usePlaces } from '../../context/PlacesContext';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import { MobileLocationInfoContent } from './MobileLocationInfoContent';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobilePencilButton } from './MobilePencilButton';
import type { NearYouToolId } from '../../utils/nearYouTools';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import styles from './MobileLocationInfo.module.css';

export interface MobileLocationInfoSheetProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
}

export const MobileLocationInfoSheet: React.FC<MobileLocationInfoSheetProps> = ({
  entry,
  calendarDate,
  onClose
}) => {
  const { trip, editingCardId, setEditingCardId, updateEntry } = useTripWorkspace();
  const { canEditItinerary } = useTripPermissions();
  const { placeById } = usePlaces();
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        if (nearToolId) setNearToolId(null);
        else if (editingCardId !== entry.id) onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId, nearToolId]);

  if (!entry) return null;

  const isEditing = editingCardId === entry.id;
  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';

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

  if (nearToolId) {
    return ReactDOM.createPortal(
      <div className={styles.nearOverlay} role="presentation">
        <div className={styles.nearOverlayInner}>
          <MobileNearYouResults
            toolId={nearToolId}
            place={place}
            locationEntryId={entry.id}
            locationLabel={title}
            tripTitle={trip?.title}
            tripDateRange={
              trip?.dateStart && trip?.dateEnd
                ? `${trip.dateStart.slice(0, 10)} – ${trip.dateEnd.slice(0, 10)}`
                : undefined
            }
            onBack={() => setNearToolId(null)}
          />
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {canEditItinerary ? (
              <MobilePencilButton onClick={() => setEditingCardId(entry.id)} ariaLabel="Edit location info" />
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <MobileLocationInfoContent
            entry={entry}
            place={place}
            readOnly={!canEditItinerary}
            onOpenNearTool={(toolId) => setNearToolId(toolId)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
