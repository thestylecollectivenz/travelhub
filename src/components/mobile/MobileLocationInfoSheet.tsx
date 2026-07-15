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
import { MobileLocationNotesEdit } from './MobileLocationNotesEdit';
import { MobileLocationOverviewEdit } from './MobileLocationOverviewEdit';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobileExplorePlacesView } from './MobileExplorePlacesView';
import { MobileSavedPlacesView } from './MobileSavedPlacesView';
import { MobileStartPointPicker, type StartPointSelection } from './MobileStartPointPicker';
import { MobilePencilButton } from './MobilePencilButton';
import type { NearYouToolId } from '../../utils/nearYouTools';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import { useShellMode } from '../../hooks/useShellMode';
import { loadLocationStartPoint, saveLocationStartPoint } from '../../utils/locationStartPointStorage';
import { geocodeStayQuery } from '../../utils/stayGeocode';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import styles from './MobileLocationInfo.module.css';

export interface MobileLocationInfoSheetProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
  /** Render as an in-flow page (BrandHeader owns title/back) instead of a bottom sheet. */
  asPage?: boolean;
}

type Panel = 'main' | 'explore' | 'saved' | 'near' | 'highlights' | 'notes' | 'overview';

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export const MobileLocationInfoSheet: React.FC<MobileLocationInfoSheetProps> = ({
  entry,
  calendarDate,
  onClose,
  asPage = false
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
  const [startingPoint, setStartingPoint] = React.useState<StartPointSelection | null>(null);
  const [startHistory, setStartHistory] = React.useState<Array<StartPointSelection | null>>([]);
  const [startPickerOpen, setStartPickerOpen] = React.useState(false);
  const [stayCentre, setStayCentre] = React.useState<StartPointSelection | null>(null);

  const stayPrimary = React.useMemo(
    () => findStayTileForDay(localEntries, calendarDate),
    [localEntries, calendarDate]
  );

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
    const primaryTitle = stayPrimary?.entry.title?.trim();
    if (primaryTitle) {
      const rest = titles.filter((t) => t.toLowerCase() !== primaryTitle.toLowerCase());
      return [primaryTitle, ...rest];
    }
    return titles;
  }, [localEntries, stayPrimary]);

  const liveEntry = entry ? localEntries.find((e) => e.id === entry.id) ?? entry : null;
  const data = liveEntry ? parseLocationInfoNotes(liveEntry.notes) : null;
  const place = data ? placeById(data.placeId) : undefined;

  const placeCentre = React.useMemo((): StartPointSelection | null => {
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!isValidLatLng(lat, lng)) return null;
    return {
      lat,
      lng,
      label: stayCandidates[0] || compactPlaceLabel(place?.title || '', place?.country) || 'Selected point'
    };
  }, [place, stayCandidates]);

  /** Preferred default pin: geocoded stay when available, else city Place. */
  const defaultCentre = React.useMemo((): StartPointSelection => {
    if (stayCentre) return stayCentre;
    if (placeCentre) return placeCentre;
    return {
      lat: -41.2865,
      lng: 174.7762,
      label: stayCandidates[0] || 'Selected point'
    };
  }, [stayCentre, placeCentre, stayCandidates]);

  React.useEffect(() => {
    const stay = stayPrimary?.entry;
    if (!stay) {
      setStayCentre(null);
      return undefined;
    }
    const label = (stay.title || '').trim() || stayCandidates[0] || 'Accommodation';
    const queryParts = [
      (stay.streetAddress || '').trim(),
      (stay.location || '').trim(),
      label,
      place?.title,
      place?.country
    ].filter(Boolean);
    const query = queryParts.join(', ');
    let cancelled = false;
    void geocodeStayQuery(query, label).then((geo) => {
      if (cancelled || !geo) return;
      setStayCentre(geo);
    });
    return () => {
      cancelled = true;
    };
  }, [stayPrimary, stayCandidates, place?.title, place?.country]);

  React.useEffect(() => {
    if (!entry?.id) return;
    const stored = loadLocationStartPoint(entry.id);
    setStartingPoint(stored);
    setStartHistory([]);
    setStartPickerOpen(false);
  }, [calendarDate, entry?.id]);

  const startingPointLabel =
    startingPoint?.label || stayCentre?.label || stayCandidates[0] || placeCentre?.label || undefined;

  const effectiveStart = startingPoint || stayCentre || placeCentre;

  const overrideLat = effectiveStart?.lat;
  const overrideLng = effectiveStart?.lng;
  const overrideCoords = React.useMemo(() => {
    if (
      overrideLat == null ||
      overrideLng == null ||
      !isValidLatLng(overrideLat, overrideLng)
    ) {
      return undefined;
    }
    return { lat: overrideLat, lng: overrideLng };
  }, [overrideLat, overrideLng]);

  const pushStartingPoint = React.useCallback(
    (next: StartPointSelection | null): void => {
      setStartHistory((prev) => [...prev, startingPoint]);
      setStartingPoint(next);
      if (entry?.id) saveLocationStartPoint(entry.id, next);
    },
    [startingPoint, entry?.id]
  );

  const undoStartingPoint = React.useCallback((): void => {
    setStartHistory((prev) => {
      if (!prev.length) return prev;
      const prior = prev[prev.length - 1];
      setStartingPoint(prior);
      if (entry?.id) saveLocationStartPoint(entry.id, prior);
      return prev.slice(0, -1);
    });
  }, [entry?.id]);

  const resetToAccommodation = React.useCallback((): void => {
    if (startingPoint === null) return;
    pushStartingPoint(null);
  }, [startingPoint, pushStartingPoint]);

  const saveNearPlace = React.useCallback(
    (placeRow: {
      name: string;
      note?: string;
      mapsUrl?: string;
      websiteUrl?: string;
      toolId?: string;
      address?: string;
      why?: string;
      bestFor?: string;
      rating?: number;
      priceLevel?: string;
      servicesSummary?: string;
    }): boolean => {
      const current = entry ? localEntries.find((e) => e.id === entry.id) ?? entry : null;
      const notes = parseLocationInfoNotes(current?.notes);
      const toolId = (placeRow.toolId as NearYouToolId | undefined) || nearToolId;
      if (!current || !notes || !toolId) {
        setNearActionMsg('Could not save to this location.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      const toolKind = NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.kind;
      const countFor = (n: typeof notes): number =>
        toolId === 'dining' || toolId === 'cafes'
          ? (n.diningSuggestions ?? []).length
          : toolKind
            ? (n.nearestPlaces?.[toolKind] ?? []).length
            : 0;
      const before = countFor(notes);
      const updated = appendNearYouPlaceToLocationInfo(notes, toolId, placeRow, startingPointLabel);
      const after = countFor(updated);
      if (after <= before) {
        setNearActionMsg(`${placeRow.name} is already saved here.`);
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      updateEntry({ ...current, notes: serializeLocationInfoNotes(updated) });
      setNearActionMsg(`Saved ${placeRow.name}`);
      window.setTimeout(() => setNearActionMsg(''), 2500);
      return true;
    },
    [entry, localEntries, nearToolId, updateEntry, startingPointLabel]
  );

  const addNearToItinerary = React.useCallback(
    async (placeRow: { name: string; note?: string; mapsUrl?: string; websiteUrl?: string }): Promise<void> => {
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
        const created = await createItineraryEntryFromNearYouPlace(spContext, trip, day.id, placeRow);
        await reloadItineraryEntries();
        setPanel('main');
        setNearToolId(null);
        setSelectedDayId(day.id);
        setEditingCardId(created.id);
        notifyExpandUnscheduled();
        setNearActionMsg(`Review “${placeRow.name}” and save when ready`);
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
        if (startPickerOpen) {
          setStartPickerOpen(false);
          return;
        }
        if (panel !== 'main' || nearToolId) closePanels();
        else if (editingCardId !== entry.id) onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose, editingCardId, panel, nearToolId, closePanels, startPickerOpen]);

  if (!entry || !liveEntry) return null;

  const isEditing = editingCardId === entry.id;
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

  if (panel === 'overview') {
    return <MobileLocationOverviewEdit entry={liveEntry} onBack={() => setPanel('main')} />;
  }

  if (panel === 'notes') {
    return <MobileLocationNotesEdit entry={liveEntry} onBack={() => setPanel('main')} />;
  }

  const picker =
    startPickerOpen ? (
      <MobileStartPointPicker
        initialLat={effectiveStart?.lat ?? defaultCentre.lat}
        initialLng={effectiveStart?.lng ?? defaultCentre.lng}
        initialLabel={effectiveStart?.label ?? startingPointLabel}
        onCancel={() => setStartPickerOpen(false)}
        onConfirm={(point) => {
          pushStartingPoint(point);
          setStartPickerOpen(false);
        }}
      />
    ) : null;

  const startPointHandlers = {
    onChangeStartingPoint: () => setStartPickerOpen(true),
    onResetStartingPoint: resetToAccommodation,
    onUndoStartingPoint: undoStartingPoint,
    canUndoStartingPoint: startHistory.length > 0,
    isCustomStartingPoint: startingPoint !== null,
    accommodationLabel: stayCandidates[0] || undefined
  };

  if (panel === 'near' && nearToolId) {
    return (
      <>
        {ReactDOM.createPortal(
          <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
            <div className={styles.nearOverlayInner}>
              <MobileNearYouResults
                toolId={nearToolId}
                place={place}
                locationEntryId={entry.id}
                locationLabel={title}
                overrideCoords={overrideCoords}
                searchAnchorLabel={startingPointLabel}
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
        )}
        {picker}
      </>
    );
  }

  if (panel === 'explore') {
    return (
      <>
        {ReactDOM.createPortal(
          <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
            <div className={styles.nearOverlayInner}>
              <MobileExplorePlacesView
                place={place}
                locationEntryId={entry.id}
                locationLabel={title}
                startingPointLabel={startingPointLabel}
                overrideCoords={overrideCoords}
                searchAnchorLabel={startingPointLabel}
                initialCategory={exploreCategory}
                onBack={closePanels}
                onSavePlace={canEditItinerary ? saveNearPlace : undefined}
                {...startPointHandlers}
              />
              {nearActionMsg ? <p className={styles.nearFeedback}>{nearActionMsg}</p> : null}
            </div>
          </div>,
          document.body
        )}
        {picker}
      </>
    );
  }

  if (panel === 'saved' && data) {
    return (
      <>
        {ReactDOM.createPortal(
          <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
            <div className={styles.nearOverlayInner}>
              <MobileSavedPlacesView
                place={place}
                locationLabel={title}
                data={data}
                entry={liveEntry}
                initialCategory={savedCategory}
                startingPointLabel={startingPointLabel}
                onBack={closePanels}
                {...startPointHandlers}
              />
            </div>
          </div>,
          document.body
        )}
        {picker}
      </>
    );
  }

  const content = (
    <MobileLocationInfoContent
      entry={liveEntry}
      place={place}
      readOnly={!canUseAiHelpers}
      canEditSavedPlaces={canEditItinerary}
      canEditHighlights={canEditItinerary}
      calendarDate={calendarDate}
      startingPointLabel={startingPointLabel}
      onEditOverview={() => setPanel('overview')}
      onEditHighlights={() => setPanel('highlights')}
      onEditNotes={() => setPanel('notes')}
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
      {...startPointHandlers}
    />
  );

  if (asPage) {
    return (
      <>
        <div className={styles.pageRoot} data-shell={shellAttr}>
          <div className={styles.pageBody}>{content}</div>
        </div>
        {picker}
      </>
    );
  }

  return (
    <>
      {ReactDOM.createPortal(
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
            <div className={styles.body}>{content}</div>
          </div>
        </div>,
        document.body
      )}
      {picker}
    </>
  );
};
