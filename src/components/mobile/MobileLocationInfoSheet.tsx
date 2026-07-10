import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes } from '../../utils/locationInfoEntry';
import { usePlaces } from '../../context/PlacesContext';
import { LocationInfoPanelContent } from '../itinerary/LocationInfoPanelContent';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import styles from './MobileLocationInfo.module.css';

export interface MobileLocationInfoSheetProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
}

const JUMP_ITEMS: Array<{ id: string; label: string; tone: string }> = [
  { id: 'highlights', label: 'Sights', tone: styles.toneSights },
  { id: 'food', label: 'Food', tone: styles.toneFood },
  { id: 'medical', label: 'Medical', tone: styles.toneMedical },
  { id: 'grocery', label: 'Shop', tone: styles.toneShop },
  { id: 'transport', label: 'Transit', tone: styles.toneTransit },
  { id: 'notes', label: 'Notes', tone: styles.toneNotes },
  { id: 'ask', label: 'Ask AI', tone: styles.toneAsk }
];

export const MobileLocationInfoSheet: React.FC<MobileLocationInfoSheetProps> = ({
  entry,
  calendarDate,
  onClose
}) => {
  const { editingCardId, setEditingCardId, updateEntry } = useTripWorkspace();
  const { canEditItinerary } = useTripPermissions();
  const { placeById } = usePlaces();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape' && editingCardId !== entry.id) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId]);

  if (!entry) return null;

  const isEditing = editingCardId === entry.id;
  const data = parseLocationInfoNotes(entry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';

  const jumpTo = (sectionId: string): void => {
    const root = scrollRef.current;
    if (!root) return;
    const target = root.querySelector(`[data-li-section="${sectionId}"]`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setEditingCardId(entry.id)}
                aria-label="Edit location info"
              >
                Edit
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        <nav className={styles.jumpRow} aria-label="Jump to section">
          {JUMP_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.jumpItem} ${item.tone}`}
              onClick={() => jumpTo(item.id)}
            >
              <span className={styles.jumpDot} aria-hidden>
                {item.label.slice(0, 1)}
              </span>
              <span className={styles.jumpLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.body} ref={scrollRef}>
          <LocationInfoPanelContent entry={entry} readOnly={!canEditItinerary} enableSectionAnchors />
        </div>
      </div>
    </div>,
    document.body
  );
};
