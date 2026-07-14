import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import { notifyExpandUnscheduled } from '../../utils/mobileItineraryUiEvents';
import { useSpContext } from '../../context/SpContext';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import { parseLocationInfoNotes, serializeLocationInfoNotes } from '../../utils/locationInfoEntry';
import { appendNearYouPlaceToLocationInfo } from '../../utils/nearYouLocationSave';
import { createItineraryEntryFromNearYouPlace } from '../../utils/addPlaceToItinerary';
import { usePlaces } from '../../context/PlacesContext';
import { findStayTileForDay } from '../../utils/mobileDayStay';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import { MobileLocationInfoContent } from './MobileLocationInfoContent';
import { MobileLocationHighlightsEdit } from './MobileLocationHighlightsEdit';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobileExplorePlacesView } from './MobileExplorePlacesView';
import { MobileSavedPlacesView } from './MobileSavedPlacesView';
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

type Panel = 'main' | 'explore' | 'saved' | 'near' | 'highlights';

export const MobileLocationInfoSheet: React.FC<MobileLocationInfoSheetProps> = ({
  entry,
  calendarDate,
  onClose
}) => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, editingCardId, setEditingCardId, updateEntry, deleteEntry, reloadItineraryEntries, localEntries } =
    useTripWorkspace();
  const { canEditItinerary, canUseAiHelpers } = useTripPermissions();
  const shellMode = useShellMode();
  const spContext = useSpContext();
  const { placeById } = usePlaces();
  const [panel, setPanel] = React.useState<Panel>('main');
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);
  const [exploreCategory, setExploreCategory] = React.useState<string | undefined>();
  const [savedCategory, setSavedCategory] = React.useState<string | undefined>();
  const [nearActionMsg, setNearActionMsg] = React.useState('');
  const [stayIndex, setStayIndex] = React.useState(0);

  const stayCandidates = React.useMemo(() => {
    const titles: string[] = [];
    const seen = new Set<string>();
    for (const e of localEntries) {
      if (e.category !== 'Accommodation' && e.category !== 'Cruise') continue;
      const t = (e.title || '').trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      titles.push(t);
    }
    const primary = findStayTileForDay(localEntries, calendarDate);
    const primaryTitle = primary?.entry.title?.trim();
    if (primaryTitle) {
      const rest = titles.filter((t) => t.toLowerCase() !== primaryTitle.toLowerCase());
      return [primaryTitle, ...rest];
    }
    return titles;
  }, [localEntries, calendarDate]);

  const startingPointLabel = stayCandidates[stayIndex % Math.max(stayCandidates.length, 1)] || undefined;

  const cycleStartingPoint = React.useCallback((): void => {
    if (stayCandidates.length < 2) return;
    setStayIndex((i) => (i + 1) % stayCandidates.length);
  }, [stayCandidates.length]);

  const saveNearPlace = React.useCallback(
    (place: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string; toolId?: string }): boolean => {
      const liveEntry = entry ? localEntries.find((e) => e.id === entry.id) ?? entry : null;
      const data = parseLocationInfoNotes(liveEntry?.notes);
      const toolId = (place.toolId as NearYouToolId | undefined) || nearToolId;
      if (!liveEntry || !data || !toolId) {
        setNearActionMsg('Could not save to this location.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      const toolKind = NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.kind;
      const countFor = (notes: typeof data): number =>
        toolId === 'dining' || toolId === 'cafes'
          ? (notes.diningSuggestions ?? []).length
          : toolKind
            ? (notes.nearestPlaces?.[toolKind] ?? []).length
            : 0;
      const before = countFor(data);
      const updated = appendNearYouPlaceToLocationInfo(data, toolId, place);
      const after = countFor(updated);
      if (after <= before) {
        setNearActionMsg(`${place.name} is already saved here.`);
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(updated) });
      setNearActionMsg(`Saved ${place.name}`);
      window.setTimeout(() => setNearActionMsg(''), 2500);
      return true;
    },
    [entry, localEntries, nearToolId, updateEntry]
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
        const created = await createItineraryEntryFromNearYouPlace(spContext, trip, day.id, place);
        await reloadItineraryEntries();
        setPanel('main');
        setNearToolId(null);
        setSelectedDayId(day.id);
        setEditingCardId(created.id);
        notifyExpandUnscheduled();
        setNearActionMsg(`Review “${place.name}” and save when ready`);
        window.setTimeout(() => setNearActionMsg(''), 2800);
      } catch (err) {
        setNearActionMsg(err instanceof Error ? err.message : 'Could not add to itinerary.');
        window.setTimeout(() => setNearActionMsg(''), 3200);
        throw err;
      }
    },
    [trip, tripDays, selectedDayId, spContext, reloadItineraryEntries, setEditingCardId, setSelectedDayId]
  );

  const closePanels = React.useCallback((): void => {
    setPanel('main');
    setNearToolId(null);
    setExploreCategory(undefined);
    setSavedCategory(undefined);
  }, []);

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        if (panel !== 'main' || nearToolId) closePanels();
        else if (editingCardId !== entry.id) onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId, panel, nearToolId, closePanels]);

  React.useEffect(() => {
    setStayIndex(0);
  }, [calendarDate, entry?.id]);

  if (!entry) return null;

  const isEditing = editingCardId === entry.id;
  const liveEntry = localEntries.find((e) => e.id === entry.id) ?? entry;
  const data = parseLocationInfoNotes(liveEntry.notes);
  const place = data ? placeById(data.placeId) : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';
  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

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
              void (async () => {
                if (!(await confirmUserAction('Delete this itinerary item?'))) return;
                deleteEntry(entry.id);
                setEditingCardId(null);
                onClose();
              })();
            }}
          />
        </div>
      </div>,
      document.body
    );
  }

  if (panel === 'highlights') {
    return (
      <MobileLocationHighlightsEdit
        entry={liveEntry}
        place={place}
        onBack={() => setPanel('main')}
      />
    );
  }

  if (panel === 'near' && nearToolId) {
    return ReactDOM.createPortal(
      <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
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
            onBack={closePanels}
            onSavePlace={canEditItinerary ? saveNearPlace : undefined}
            onAddToItinerary={canEditItinerary ? addNearToItinerary : undefined}
          />
          {nearActionMsg ? <p className={styles.nearFeedback}>{nearActionMsg}</p> : null}
        </div>
      </div>,
      document.body
    );
  }

  if (panel === 'explore') {
    return ReactDOM.createPortal(
      <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
        <div className={styles.nearOverlayInner}>
          <MobileExplorePlacesView
            place={place}
            locationEntryId={entry.id}
            locationLabel={title}
            startingPointLabel={startingPointLabel}
            initialCategory={exploreCategory}
            onBack={closePanels}
            onChangeStartingPoint={stayCandidates.length > 1 ? cycleStartingPoint : undefined}
            onSavePlace={canEditItinerary ? saveNearPlace : undefined}
          />
          {nearActionMsg ? <p className={styles.nearFeedback}>{nearActionMsg}</p> : null}
        </div>
      </div>,
      document.body
    );
  }

  if (panel === 'saved' && data) {
    return ReactDOM.createPortal(
      <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
        <div className={styles.nearOverlayInner}>
          <MobileSavedPlacesView
            place={place}
            locationLabel={title}
            data={data}
            initialCategory={savedCategory}
            startingPointLabel={startingPointLabel}
            onBack={closePanels}
            onChangeStartingPoint={stayCandidates.length > 1 ? cycleStartingPoint : undefined}
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
        data-shell={shellAttr}
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
            entry={liveEntry}
            place={place}
            readOnly={!canUseAiHelpers}
            canEditSavedPlaces={canEditItinerary}
            canEditHighlights={canEditItinerary}
            calendarDate={calendarDate}
            startingPointLabel={startingPointLabel}
            onChangeStartingPoint={stayCandidates.length > 1 ? cycleStartingPoint : undefined}
            onEditHighlights={() => setPanel('highlights')}
            onOpenNearTool={(toolId) => {
              setNearToolId(toolId);
              setPanel('near');
            }}
            onOpenExplore={(category) => {
              setExploreCategory(category);
              setPanel('explore');
            }}
            onOpenSavedPlaces={(category) => {
              setSavedCategory(category);
              setPanel('saved');
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
