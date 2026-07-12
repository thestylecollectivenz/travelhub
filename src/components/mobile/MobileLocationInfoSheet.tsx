import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { useSpContext } from '../../context/SpContext';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes, serializeLocationInfoNotes } from '../../utils/locationInfoEntry';
import { appendNearYouPlaceToLocationInfo } from '../../utils/nearYouLocationSave';
import { usePlaces } from '../../context/PlacesContext';
import { ItineraryService } from '../../services/ItineraryService';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import { MobileLocationInfoContent } from './MobileLocationInfoContent';
import { MobileLocationHighlightsEdit } from './MobileLocationHighlightsEdit';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobilePencilButton } from './MobilePencilButton';
import type { NearYouToolId } from '../../utils/nearYouTools';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import { useShellMode } from '../../hooks/useShellMode';
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
  const { trip, tripDays, selectedDayId, editingCardId, setEditingCardId, updateEntry, reloadItineraryEntries } =
    useTripWorkspace();
  const { canEditItinerary, canUseAiHelpers } = useTripPermissions();
  const shellMode = useShellMode();
  const spContext = useSpContext();
  const { placeById } = usePlaces();
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);
  const [highlightsEditOpen, setHighlightsEditOpen] = React.useState(false);
  const [nearActionMsg, setNearActionMsg] = React.useState('');

  const saveNearPlace = React.useCallback(
    (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): boolean => {
      const data = parseLocationInfoNotes(entry?.notes);
      if (!entry || !data || !nearToolId) {
        setNearActionMsg('Could not save to this location.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      const toolKind = NEAR_YOU_TOOLS.find((t) => t.id === nearToolId)?.kind;
      const countFor = (notes: typeof data): number =>
        nearToolId === 'dining'
          ? (notes.diningSuggestions ?? []).length
          : toolKind
            ? (notes.nearestPlaces?.[toolKind] ?? []).length
            : 0;
      const before = countFor(data);
      const updated = appendNearYouPlaceToLocationInfo(data, nearToolId, place);
      const after = countFor(updated);
      if (after <= before) {
        setNearActionMsg(`${place.name} is already saved here.`);
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      updateEntry({ ...entry, notes: serializeLocationInfoNotes(updated) });
      setNearActionMsg(`Saved ${place.name}`);
      window.setTimeout(() => setNearActionMsg(''), 2500);
      return true;
    },
    [entry, nearToolId, updateEntry]
  );

  const addNearToItinerary = React.useCallback(
    async (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
      if (!trip) {
        setNearActionMsg('No trip open.');
        return;
      }
      try {
        const day = tripDays.find((d) => d.id === selectedDayId) ?? tripDays[0];
        if (!day) {
          setNearActionMsg('This trip has no days yet.');
          return;
        }
        const itin = new ItineraryService(spContext);
        await itin.create({
          tripId: trip.id,
          dayId: day.id,
          title: place.name,
          category: 'Activities',
          location: place.note || '',
          timeStart: '',
          duration: '',
          supplier: '',
          notes: place.mapsUrl ? `Maps: ${place.mapsUrl}` : '',
          decisionStatus: 'Idea',
          bookingRequired: false,
          bookingStatus: 'Not booked',
          paymentStatus: 'Not paid',
          amount: 0,
          currency: 'NZD',
          sortOrder: 999
        });
        await reloadItineraryEntries();
        setNearActionMsg(`Added “${place.name}” to itinerary`);
        window.setTimeout(() => setNearActionMsg(''), 2800);
      } catch (err) {
        setNearActionMsg(err instanceof Error ? err.message : 'Could not add to itinerary.');
        window.setTimeout(() => setNearActionMsg(''), 3200);
      }
    },
    [trip, tripDays, selectedDayId, spContext, reloadItineraryEntries]
  );

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        if (nearToolId) setNearToolId(null);
        else if (highlightsEditOpen) setHighlightsEditOpen(false);
        else if (editingCardId !== entry.id) onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId, nearToolId, highlightsEditOpen]);

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

  if (highlightsEditOpen) {
    return (
      <MobileLocationHighlightsEdit
        entry={entry}
        place={place}
        onBack={() => setHighlightsEditOpen(false)}
      />
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
            onSavePlace={canUseAiHelpers ? saveNearPlace : undefined}
            onAddToItinerary={canEditItinerary ? addNearToItinerary : undefined}
          />
          {nearActionMsg ? <p className={styles.nearFeedback}>{nearActionMsg}</p> : null}
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
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
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
            readOnly={!canUseAiHelpers}
            canEditHighlights={canEditItinerary}
            onEditHighlights={() => setHighlightsEditOpen(true)}
            onOpenNearTool={(toolId) => setNearToolId(toolId)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
