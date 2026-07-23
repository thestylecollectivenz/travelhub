import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { confirmUserAction } from '../../utils/confirmAction';
import { notifyExpandUnscheduled } from '../../utils/mobileItineraryUiEvents';
import { useSpContext } from '../../context/SpContext';
import { compactPlaceLabel } from '../../utils/placeDisplayLabel';
import {
  createSavedTravelTip,
  parseLocationInfoNotes,
  serializeLocationInfoNotes,
  locationInfoPlaceId,
  normalizeLocationInfoNotes,
  type LocationInfoQaEntry
} from '../../utils/locationInfoEntry';
import { buildCanonicalLocationInfoByPlaceId } from '../../utils/locationInfoDayResolve';
import { appendNearYouPlaceToLocationInfo } from '../../utils/nearYouLocationSave';
import { createItineraryEntryFromNearYouPlace } from '../../utils/addPlaceToItinerary';
import { datesWherePlaceAppears } from '../../utils/placeForecastDates';
import { isPreTripDayRow } from '../../utils/itineraryDayEntries';
import { richTextToPlainText } from '../../utils/journalRichText';
import { qaEntryTitle } from '../../utils/qaDisplayText';
import { rememberTripTaskCategory } from '../../utils/tripTaskCategories';
import { ReminderService } from '../../services/ReminderService';
import { usePlaces } from '../../context/PlacesContext';
import { findStayTileForDay } from '../../utils/mobileDayStay';
import { cruisePortEntryForDay } from '../../utils/cruisePlannerUtils';
import { ItineraryCardEdit } from '../itinerary/ItineraryCardEdit';
import { MobileLocationInfoContent } from './MobileLocationInfoContent';
import { MobileLocationHighlightsEdit } from './MobileLocationHighlightsEdit';
import { MobileLocationNotesEdit } from './MobileLocationNotesEdit';
import { MobileLocationOverviewEdit } from './MobileLocationOverviewEdit';
import { MobileNearYouResults } from './MobileNearYouResults';
import { MobileExplorePlacesView } from './MobileExplorePlacesView';
import { MobileSavedPlacesView } from './MobileSavedPlacesView';
import {
  loadPersistedMobileNav,
  parseNavHash,
  persistMobileNav,
  shouldRestoreMobileNav
} from '../../utils/mobileNavPersistence';
import { MobileStartPointPicker, type StartPointSelection } from './MobileStartPointPicker';
import { MobileDayPickActions, type DayPickOption } from './MobileDayPickActions';
import { MobileTipItemEdit, MobileTipListChooser, type TipListTarget } from './MobileTipListChooser';
import { PackingService } from '../../services/PackingService';
import { ShoppingListService } from '../../services/ShoppingListService';
import { getCurrentUserEmail } from '../../utils/currentUserEmail';
import { rememberTripShoppingCategory } from '../../utils/tripShoppingCategories';
import { MobilePencilButton } from './MobilePencilButton';
import type { NearYouToolId } from '../../utils/nearYouTools';
import { NEAR_YOU_TOOLS } from '../../utils/nearYouTools';
import { useShellMode } from '../../hooks/useShellMode';
import {
  loadLocationStartPoint,
  loadLocationStartPointList,
  rememberLocationStartPoint,
  removeLocationStartPoint,
  saveLocationStartPoint,
  startPointKey,
  type StoredStartPoint
} from '../../utils/locationStartPointStorage';
import {
  mergeSharedAndLocalStarts,
  promoteAttachedLocalStarts,
  removeSharedStartingPoint,
  startPointHasSavedPlaces,
  upsertSharedStartingPoint
} from '../../utils/locationSharedStartPoints';
import { formatStartLabelWithAddress, reverseGeocodeAddress } from '../../utils/googlePlacePhoto';
import { geocodeStayFromHotelRecord, geocodeStayQuery } from '../../utils/stayGeocode';
import cardStyles from '../itinerary/ItineraryCard.module.css';
import styles from './MobileLocationInfo.module.css';

export interface MobileLocationInfoSheetProps {
  entry: ItineraryEntry | null;
  calendarDate: string;
  onClose: () => void;
  /** Render as an in-flow page (BrandHeader owns title/back) instead of a bottom sheet. */
  asPage?: boolean;
  /** Open scrolled to the location Q&A Ask AI section. */
  initialFocusAskAi?: boolean;
}

type Panel = 'main' | 'explore' | 'saved' | 'near' | 'highlights' | 'notes' | 'overview';

type DayPickState = {
  mode: 'task' | 'itinerary';
  title: string;
  note: string;
  mapsUrl?: string;
};

type TipSaveState =
  | { stage: 'list'; tip: string }
  | { stage: 'edit'; tip: string; kind: TipListTarget; title: string; notes: string }
  | null;

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function shortDayLabel(calendarDate: string | undefined, displayTitle: string, dayNumber: number): string {
  const ymd = (calendarDate || '').slice(0, 10);
  const short = ymd
    ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
    : '';
  const title = (displayTitle || '').trim();
  return [short, title].filter(Boolean).join(' · ') || `Day ${dayNumber}`;
}

export const MobileLocationInfoSheet: React.FC<MobileLocationInfoSheetProps> = ({
  entry,
  calendarDate,
  onClose,
  asPage = false,
  initialFocusAskAi = false
}) => {
  const { trip, tripDays, selectedDayId, setSelectedDayId, editingCardId, setEditingCardId, updateEntry, deleteEntry, reloadItineraryEntries, localEntries } =
    useTripWorkspace();
  const { canEditItinerary, canUseAiHelpers } = useTripPermissions();
  const shellMode = useShellMode();
  const spContext = useSpContext();
  const { placeById } = usePlaces();
  const [panel, setPanel] = React.useState<Panel>(() => {
    // The URL route decides which sub-page reopens on a restore (deep-screen
    // reload or external-site return); otherwise open at the main page.
    const route = parseNavHash();
    if (route) {
      return route.locationEntryId === entry?.id && route.locationPanel ? (route.locationPanel as Panel) : 'main';
    }
    if (!shouldRestoreMobileNav()) return 'main';
    const nav = loadPersistedMobileNav();
    if (nav.locationEntryId === entry?.id && (nav.locationPanel === 'explore' || nav.locationPanel === 'saved')) {
      return nav.locationPanel as Panel;
    }
    return 'main';
  });
  const [nearToolId, setNearToolId] = React.useState<NearYouToolId | null>(null);
  const [exploreCategory, setExploreCategory] = React.useState<string | undefined>(() => {
    const route = parseNavHash();
    if (route) {
      return route.locationEntryId === entry?.id && route.locationPanel === 'explore' ? route.panelCategory : undefined;
    }
    if (!shouldRestoreMobileNav()) return undefined;
    const nav = loadPersistedMobileNav();
    return nav.locationEntryId === entry?.id ? nav.exploreCategory : undefined;
  });
  const [savedCategory, setSavedCategory] = React.useState<string | undefined>(() => {
    const route = parseNavHash();
    if (route && route.locationEntryId === entry?.id && route.locationPanel === 'saved') {
      return route.panelCategory;
    }
    return undefined;
  });
  const [nearActionMsg, setNearActionMsg] = React.useState('');
  const [dayPick, setDayPick] = React.useState<DayPickState | null>(null);
  const [tipSave, setTipSave] = React.useState<TipSaveState>(null);
  const [tipSaveBusy, setTipSaveBusy] = React.useState(false);
  const [startingPoint, setStartingPoint] = React.useState<StartPointSelection | null>(null);
  const [startHistory, setStartHistory] = React.useState<Array<StartPointSelection | null>>([]);
  const [startPickerOpen, setStartPickerOpen] = React.useState(false);
  const [stayCentre, setStayCentre] = React.useState<StartPointSelection | null>(null);
  const [savedStarts, setSavedStarts] = React.useState<StoredStartPoint[]>([]);

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

  const liveEntry = React.useMemo(() => {
    if (!entry) return null;
    const byId = localEntries.find((e) => e.id === entry.id) ?? entry;
    const placeId = locationInfoPlaceId(byId);
    if (!placeId || !trip?.id) return byId;
    const canonical = buildCanonicalLocationInfoByPlaceId(localEntries, trip.id, placeById).get(placeId);
    return canonical ?? byId;
  }, [entry, localEntries, trip?.id, placeById]);
  const startPointStorageId = React.useMemo(() => {
    const placeId = liveEntry ? locationInfoPlaceId(liveEntry) : '';
    if (placeId) return `place:${placeId}`;
    return entry?.id || '';
  }, [liveEntry, entry?.id]);
  const data = liveEntry ? parseLocationInfoNotes(liveEntry.notes) : null;
  const place = data ? placeById(data.placeId) : undefined;

  const locationDayOptions = React.useMemo((): DayPickOption[] => {
    const placeId = liveEntry ? locationInfoPlaceId(liveEntry) : '';
    if (!placeId) return [];
    const dateSet = new Set(datesWherePlaceAppears(tripDays, placeId));
    let days = tripDays.filter(
      (d) => !isPreTripDayRow(d) && dateSet.has((d.calendarDate || '').slice(0, 10))
    );
    if (!days.length) {
      const entryDayIds = new Set(
        localEntries
          .filter((e) => locationInfoPlaceId(e) === placeId)
          .map((e) => e.dayId)
          .filter(Boolean)
      );
      days = tripDays.filter((d) => !isPreTripDayRow(d) && entryDayIds.has(d.id));
    }
    return days.map((d) => ({
      dayId: d.id,
      label: shortDayLabel(d.calendarDate, d.displayTitle, d.dayNumber)
    }));
  }, [liveEntry, tripDays, localEntries]);

  const placeCentre = React.useMemo((): StartPointSelection | null => {
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!isValidLatLng(lat, lng)) return null;
    return {
      lat,
      lng,
      label: compactPlaceLabel(place?.title || '', place?.country) || 'City centre'
    };
  }, [place]);

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
    let cancelled = false;

    // Cruise days: Explore/near searches use the port card for this day, not the ship name.
    const port =
      stayPrimary?.mode === 'cruise'
        ? cruisePortEntryForDay(localEntries, tripDays, calendarDate)
        : undefined;
    const geoPromise = port
      ? geocodeStayQuery(
          [port.location || port.title, port.streetAddress].filter(Boolean).join(', '),
          (port.location || port.title || '').trim() || 'Port'
        )
      : geocodeStayFromHotelRecord({
          title: stay.title,
          streetAddress: stay.streetAddress,
          location: stay.location
        });

    void geoPromise.then((geo) => {
      if (cancelled || !geo) return;
      setStayCentre(geo);
    });
    return () => {
      cancelled = true;
    };
  }, [stayPrimary, localEntries, tripDays, calendarDate]);

  const promotedStartsRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!entry?.id) return;
    const stored = loadLocationStartPoint(startPointStorageId);
    if (stored) rememberLocationStartPoint(startPointStorageId, stored);
    setStartingPoint(stored);
    const local = loadLocationStartPointList(startPointStorageId);
    const notes = parseLocationInfoNotes(liveEntry?.notes);
    setSavedStarts(mergeSharedAndLocalStarts(notes?.savedStartingPoints, local));
    setStartHistory([]);
    setStartPickerOpen(false);

    // One-time promote per entry: local starts that already have saved places → SharePoint.
    if (notes && liveEntry && canEditItinerary && local.length && promotedStartsRef.current !== startPointStorageId) {
      const promoted = promoteAttachedLocalStarts(notes, local);
      const before = JSON.stringify(notes.savedStartingPoints || []);
      const after = JSON.stringify(promoted.savedStartingPoints || []);
      promotedStartsRef.current = startPointStorageId;
      if (before !== after) {
        updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(promoted)) });
      }
    }
  }, [calendarDate, entry?.id, startPointStorageId, liveEntry, canEditItinerary, updateEntry]);

  // When SharePoint notes change (another save), refresh the merged start list.
  React.useEffect(() => {
    if (!startPointStorageId) return;
    const local = loadLocationStartPointList(startPointStorageId);
    const notes = parseLocationInfoNotes(liveEntry?.notes);
    setSavedStarts(mergeSharedAndLocalStarts(notes?.savedStartingPoints, local));
  }, [startPointStorageId, liveEntry?.notes]);

  const refreshSavedStarts = React.useCallback((): void => {
    if (!startPointStorageId) return;
    const local = loadLocationStartPointList(startPointStorageId);
    const notes = parseLocationInfoNotes(liveEntry?.notes);
    setSavedStarts(mergeSharedAndLocalStarts(notes?.savedStartingPoints, local));
  }, [startPointStorageId, liveEntry?.notes]);

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
      if (startPointStorageId) {
        saveLocationStartPoint(startPointStorageId, next);
        refreshSavedStarts();
      }
      if (next && startPointStorageId) {
        const storageId = startPointStorageId;
        const base = { lat: next.lat, lng: next.lng, label: next.label };
        void reverseGeocodeAddress(base.lat, base.lng).then((addr) => {
          if (!addr) return;
          const label = formatStartLabelWithAddress(base.label, addr);
          if (label === base.label) return;
          const enriched: StoredStartPoint = { lat: base.lat, lng: base.lng, label };
          setStartingPoint((cur) =>
            cur && startPointKey(cur) === startPointKey(enriched) ? enriched : cur
          );
          saveLocationStartPoint(storageId, enriched);
          refreshSavedStarts();
        });
      }
    },
    [startingPoint, startPointStorageId, refreshSavedStarts]
  );

  const undoStartingPoint = React.useCallback((): void => {
    setStartHistory((prev) => {
      if (!prev.length) return prev;
      const prior = prev[prev.length - 1];
      setStartingPoint(prior);
      if (startPointStorageId) {
        saveLocationStartPoint(startPointStorageId, prior);
        refreshSavedStarts();
      }
      return prev.slice(0, -1);
    });
  }, [startPointStorageId, refreshSavedStarts]);

  const resetToAccommodation = React.useCallback((): void => {
    if (startingPoint === null) return;
    pushStartingPoint(null);
  }, [startingPoint, pushStartingPoint]);

  const selectSavedStart = React.useCallback(
    (point: StoredStartPoint): void => {
      pushStartingPoint(point);
    },
    [pushStartingPoint]
  );

  const removeSavedStart = React.useCallback(
    (point: StoredStartPoint): void => {
      if (!entry?.id) return;
      const notes = parseLocationInfoNotes(liveEntry?.notes);
      if (notes && startPointHasSavedPlaces(notes, point)) {
        setNearActionMsg('This starting point has saved places — remove those first.');
        window.setTimeout(() => setNearActionMsg(''), 2800);
        return;
      }
      removeLocationStartPoint(startPointStorageId, point);
      if (notes && liveEntry && canEditItinerary) {
        const next = removeSharedStartingPoint(notes, point);
        updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(next)) });
      }
      refreshSavedStarts();
      setStartingPoint(loadLocationStartPoint(startPointStorageId));
    },
    [startPointStorageId, liveEntry, canEditItinerary, updateEntry, refreshSavedStarts]
  );

  const saveTravelTip = React.useCallback(
    (tipText: string): void => {
      const notes = parseLocationInfoNotes(liveEntry?.notes);
      if (!liveEntry || !notes || !canEditItinerary) return;
      const tip = tipText.trim();
      if (!tip) return;
      const existing = notes.savedTravelTips || [];
      if (existing.some((t) => t.text.trim().toLowerCase() === tip.toLowerCase())) return;
      const next = normalizeLocationInfoNotes({
        ...notes,
        savedTravelTips: [...existing, createSavedTravelTip(tip)]
      });
      updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(next) });
    },
    [liveEntry, canEditItinerary, updateEntry]
  );

  const deleteTravelTip = React.useCallback(
    (tipId: string): void => {
      const notes = parseLocationInfoNotes(liveEntry?.notes);
      if (!liveEntry || !notes || !canEditItinerary) return;
      const id = tipId.trim();
      if (!id) return;
      const next = normalizeLocationInfoNotes({
        ...notes,
        savedTravelTips: (notes.savedTravelTips || []).filter((t) => t.id !== id)
      });
      updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(next) });
    },
    [liveEntry, canEditItinerary, updateEntry]
  );

  const saveNearPlace = React.useCallback(
    (placeRow: {
      name: string;
      note?: string;
      mapsUrl?: string;
      websiteUrl?: string;
      tripadvisorUrl?: string;
      photoUrl?: string;
      toolId?: string;
      address?: string;
      why?: string;
      bestFor?: string;
      rating?: number;
      priceLevel?: string;
      servicesSummary?: string;
    }): boolean => {
      const notes = parseLocationInfoNotes(liveEntry?.notes);
      const toolId = (placeRow.toolId as NearYouToolId | undefined) || nearToolId;
      if (!liveEntry || !notes || !toolId) {
        setNearActionMsg('Could not save to this location.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      const toolKind = NEAR_YOU_TOOLS.find((t) => t.id === toolId)?.kind;
      const countFor = (n: NonNullable<typeof notes>): number =>
        toolId === 'dining' || toolId === 'cafes'
          ? (n.diningSuggestions ?? []).length
          : toolKind
            ? (n.nearestPlaces?.[toolKind] ?? []).length
            : 0;
      const before = countFor(notes);
      let updated = appendNearYouPlaceToLocationInfo(notes, toolId, placeRow, startingPointLabel);
      const after = countFor(updated);
      if (after <= before) {
        setNearActionMsg(`${placeRow.name} is already saved here.`);
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return false;
      }
      // Persist the active start to SharePoint when a place is saved against it.
      if (startingPoint) {
        updated = upsertSharedStartingPoint(updated, startingPoint);
      } else if (stayCentre && startingPointLabel) {
        updated = upsertSharedStartingPoint(updated, {
          lat: stayCentre.lat,
          lng: stayCentre.lng,
          label: startingPointLabel
        });
      }
      updateEntry({ ...liveEntry, notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(updated)) });
      refreshSavedStarts();
      setNearActionMsg(`Saved ${placeRow.name}`);
      window.setTimeout(() => setNearActionMsg(''), 2500);
      return true;
    },
    [liveEntry, nearToolId, updateEntry, startingPointLabel, startingPoint, stayCentre, refreshSavedStarts]
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

  const createTask = React.useCallback(
    async (title: string, note: string, dayId?: string): Promise<void> => {
      if (!trip?.id) {
        setNearActionMsg('No trip open.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return;
      }
      try {
        const day = dayId ? tripDays.find((d) => d.id === dayId) : undefined;
        const svc = new ReminderService(spContext);
        const trimmedTitle = title.trim() || 'Task';
        await svc.create({
          tripId: trip.id,
          title: trimmedTitle,
          reminderText: note.trim(),
          taskNote: note.trim() || undefined,
          reminderType: 'Manual',
          taskCategory: 'Itinerary updates',
          dayId: dayId || '',
          dueDate: day?.calendarDate?.slice(0, 10),
          isComplete: false
        });
        rememberTripTaskCategory(trip.id, 'Itinerary updates');
        setDayPick(null);
        setNearActionMsg(`Task created: ${trimmedTitle}`);
        window.setTimeout(() => setNearActionMsg(''), 2800);
      } catch (err) {
        setNearActionMsg(err instanceof Error ? err.message : 'Could not create task.');
        window.setTimeout(() => setNearActionMsg(''), 3200);
      }
    },
    [trip?.id, tripDays, spContext]
  );

  const addItinerary = React.useCallback(
    async (title: string, note: string, dayId: string, mapsUrl?: string): Promise<void> => {
      if (!trip) {
        setNearActionMsg('No trip open.');
        window.setTimeout(() => setNearActionMsg(''), 2500);
        return;
      }
      try {
        const created = await createItineraryEntryFromNearYouPlace(spContext, trip, dayId, {
          name: title.trim() || 'Place',
          note: note.trim() || undefined,
          mapsUrl
        });
        await reloadItineraryEntries();
        setDayPick(null);
        setPanel('main');
        setNearToolId(null);
        setSelectedDayId(dayId);
        setEditingCardId(created.id);
        notifyExpandUnscheduled();
        setNearActionMsg(`Review “${created.title}” and save when ready`);
        window.setTimeout(() => setNearActionMsg(''), 2800);
      } catch (err) {
        setNearActionMsg(err instanceof Error ? err.message : 'Could not add to itinerary.');
        window.setTimeout(() => setNearActionMsg(''), 3200);
      }
    },
    [trip, spContext, reloadItineraryEntries, setEditingCardId, setSelectedDayId]
  );

  const resolveDayId = React.useCallback(
    (pending: DayPickState): void => {
      if (locationDayOptions.length <= 1) {
        const dayId = locationDayOptions[0]?.dayId || selectedDayId;
        if (pending.mode === 'task') {
          void createTask(pending.title, pending.note, dayId || undefined);
          return;
        }
        if (!dayId) {
          setNearActionMsg('This trip has no days yet.');
          window.setTimeout(() => setNearActionMsg(''), 2500);
          return;
        }
        void addItinerary(pending.title, pending.note, dayId, pending.mapsUrl);
        return;
      }
      setDayPick(pending);
    },
    [locationDayOptions, selectedDayId, createTask, addItinerary]
  );

  const onCreateTaskFromTip = React.useCallback((tipText: string): void => {
    const tip = tipText.trim();
    if (!tip) return;
    setTipSave({ stage: 'list', tip });
  }, []);

  const saveTipListItem = React.useCallback(async (): Promise<void> => {
    if (!tipSave || tipSave.stage !== 'edit' || !trip?.id) return;
    const title = tipSave.title.trim();
    if (!title) return;
    setTipSaveBusy(true);
    try {
      const ownerEmail = getCurrentUserEmail(spContext) || '';
      if (tipSave.kind === 'todo') {
        await createTask(title, tipSave.notes, selectedDayId || undefined);
      } else if (tipSave.kind === 'packing') {
        const svc = new PackingService(spContext);
        await svc.create({
          tripId: trip.id,
          category: 'Other',
          itemName: title,
          quantity: 1,
          isPacked: false,
          isTemplate: false,
          traveller: '',
          ownerEmail,
          itemNotes: tipSave.notes.trim() || undefined
        });
        setNearActionMsg(`Added to packing: ${title}`);
      } else {
        const svc = new ShoppingListService(spContext);
        await svc.create({
          tripId: trip.id,
          category: 'Other',
          itemName: title,
          traveller: '',
          budgetAmount: 0,
          actualAmount: 0,
          currency: 'NZD',
          purchaseMonth: '',
          websiteUrl: '',
          notes: tipSave.notes.trim() || '',
          isPurchased: false,
          ownerEmail
        });
        rememberTripShoppingCategory(trip.id, 'Other');
        setNearActionMsg(`Added to shopping: ${title}`);
      }
      setTipSave(null);
      window.setTimeout(() => setNearActionMsg(''), 2800);
    } catch (err) {
      setNearActionMsg(err instanceof Error ? err.message : 'Could not save.');
      window.setTimeout(() => setNearActionMsg(''), 3200);
    } finally {
      setTipSaveBusy(false);
    }
  }, [tipSave, trip?.id, spContext, createTask, selectedDayId]);

  const onAddTipToItinerary = React.useCallback(
    (tipText: string): void => {
      const tip = tipText.trim();
      if (!tip) return;
      resolveDayId({ mode: 'itinerary', title: tip.slice(0, 80) || 'Travel tip', note: tip });
    },
    [resolveDayId]
  );

  const onCreateTaskFromQa = React.useCallback(
    (item: LocationInfoQaEntry): void => {
      resolveDayId({
        mode: 'task',
        title: qaEntryTitle(item),
        note: richTextToPlainText(item.answer)
      });
    },
    [resolveDayId]
  );

  const onAddQaToItinerary = React.useCallback(
    (item: LocationInfoQaEntry): void => {
      resolveDayId({
        mode: 'itinerary',
        title: qaEntryTitle(item),
        note: richTextToPlainText(item.answer)
      });
    },
    [resolveDayId]
  );

  const onCreateTaskFromSavedPlace = React.useCallback(
    (placeRow: { name: string; note?: string; mapsUrl?: string }): void => {
      resolveDayId({
        mode: 'task',
        title: placeRow.name,
        note: placeRow.note || '',
        mapsUrl: placeRow.mapsUrl
      });
    },
    [resolveDayId]
  );

  const onAddSavedPlaceToItinerary = React.useCallback(
    (placeRow: { name: string; note?: string; mapsUrl?: string }): void => {
      resolveDayId({
        mode: 'itinerary',
        title: placeRow.name,
        note: placeRow.note || '',
        mapsUrl: placeRow.mapsUrl
      });
    },
    [resolveDayId]
  );

  const closePanels = React.useCallback((): void => {
    setPanel('main');
    setNearToolId(null);
    setExploreCategory(undefined);
    setSavedCategory(undefined);
    setDayPick(null);
    persistMobileNav({
      locationPanel: undefined,
      locationEntryId: undefined,
      exploreCategory: undefined
    });
  }, []);

  // Persist the open location page into the URL hash so it behaves like a real
  // page across remounts / external-site returns. Cleared only via closePanels
  // or MobileDayView.closeLocation — never on unmount (SharePoint remounts
  // briefly and that was wiping the route mid-return).
  React.useEffect(() => {
    if (!entry?.id || !trip?.id) return;
    persistMobileNav({
      view: 'singleTrip',
      tripId: trip.id,
      locationEntryId: entry.id,
      locationPanel: panel === 'explore' || panel === 'saved' ? panel : undefined,
      exploreCategory:
        panel === 'explore' ? exploreCategory : panel === 'saved' ? savedCategory : undefined
    });
  }, [panel, exploreCategory, savedCategory, entry?.id, trip?.id]);

  React.useEffect(() => {
    if (!entry) return undefined;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        if (dayPick) {
          setDayPick(null);
          return;
        }
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
  }, [entry, onClose, editingCardId, panel, nearToolId, closePanels, startPickerOpen, dayPick]);

  if (!entry || !liveEntry) return null;

  const isEditing = editingCardId === entry.id;
  const portForDay =
    stayPrimary?.mode === 'cruise'
      ? cruisePortEntryForDay(localEntries, tripDays, calendarDate)
      : undefined;
  const title = place
    ? compactPlaceLabel(place.title, place.country)
    : (entry.title || entry.location || 'Location').trim() || 'Location';
  const exploreLocationLabel =
    (portForDay?.location || portForDay?.title || '').trim() || title;
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
              updateEntry(saved, { persistPending: true });
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
    accommodationLabel: stayCandidates[0] || undefined,
    accommodationStart: stayCentre
      ? {
          lat: stayCentre.lat,
          lng: stayCentre.lng,
          label: stayCentre.label || stayCandidates[0] || 'Accommodation'
        }
      : null,
    savedStarts,
    onSelectSavedStart: selectSavedStart,
    onRemoveSavedStart: removeSavedStart,
    activeStart: startingPoint
  };

  const dayPickUi =
    dayPick || tipSave || nearActionMsg ? (
      <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.65rem' }}>
        {tipSave?.stage === 'list' ? (
          <MobileTipListChooser
            open
            tipPreview={tipSave.tip}
            onPick={(kind) => {
              setTipSave({
                stage: 'edit',
                tip: tipSave.tip,
                kind,
                title: tipSave.tip.slice(0, 80),
                notes: tipSave.tip
              });
            }}
            onCancel={() => setTipSave(null)}
          />
        ) : null}
        {tipSave?.stage === 'edit' ? (
          <MobileTipItemEdit
            open
            kind={tipSave.kind === 'todo' ? 'todo' : tipSave.kind}
            title={tipSave.title}
            notes={tipSave.notes}
            onChangeTitle={(v) => setTipSave({ ...tipSave, title: v })}
            onChangeNotes={(v) => setTipSave({ ...tipSave, notes: v })}
            onSave={() => void saveTipListItem()}
            onCancel={() => setTipSave(null)}
            busy={tipSaveBusy}
          />
        ) : null}
        {dayPick ? (
          <MobileDayPickActions
            open
            title={dayPick.mode === 'task' ? 'Create task for which day?' : 'Add to which day?'}
            days={locationDayOptions}
            onPick={(dayId) => {
              const pending = dayPick;
              if (!pending) return;
              if (pending.mode === 'task') {
                void createTask(pending.title, pending.note, dayId);
              } else {
                void addItinerary(pending.title, pending.note, dayId, pending.mapsUrl);
              }
            }}
            onCancel={() => setDayPick(null)}
          />
        ) : null}
        {nearActionMsg ? <p className={styles.nearFeedback}>{nearActionMsg}</p> : null}
      </div>
    ) : null;

  if (panel === 'near' && nearToolId) {
    return (
      <>
        {ReactDOM.createPortal(
          <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
            <div className={styles.nearOverlayInner}>
              {dayPickUi}
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
              {dayPickUi}
              <MobileExplorePlacesView
                place={place}
                locationEntryId={entry.id}
                locationLabel={exploreLocationLabel}
                initialCategory={exploreCategory}
                onCategoryChange={setExploreCategory}
                practicalTipsHtml={data?.practicalTips}
                onBack={closePanels}
                onSavePlace={canEditItinerary ? saveNearPlace : undefined}
                onSaveTip={canEditItinerary ? saveTravelTip : undefined}
                savedTips={data?.savedTravelTips || []}
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

  if (panel === 'saved' && data) {
    return (
      <>
        {ReactDOM.createPortal(
          <div className={styles.nearOverlay} role="presentation" data-shell={shellAttr}>
            <div className={styles.nearOverlayInner}>
              {dayPickUi}
              <MobileSavedPlacesView
                place={place}
                locationLabel={title}
                data={data}
                entry={liveEntry}
                initialCategory={savedCategory}
                onCategoryChange={setSavedCategory}
                startingPointLabel={startingPointLabel}
                overrideCoords={overrideCoords}
                onBack={closePanels}
                onSaveTip={canEditItinerary ? saveTravelTip : undefined}
                savedTips={data.savedTravelTips || []}
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
    <>
      {dayPickUi}
      <MobileLocationInfoContent
        entry={liveEntry}
        place={place}
        readOnly={!canUseAiHelpers}
        canEditSavedPlaces={canEditItinerary}
        canEditHighlights={canEditItinerary}
        initialFocusAskAi={initialFocusAskAi}
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
        onDeleteTip={canEditItinerary ? deleteTravelTip : undefined}
        onCreateTaskFromTip={canEditItinerary ? onCreateTaskFromTip : undefined}
        onAddTipToItinerary={canEditItinerary ? onAddTipToItinerary : undefined}
        onCreateTaskFromQa={canEditItinerary ? onCreateTaskFromQa : undefined}
        onAddQaToItinerary={canEditItinerary ? onAddQaToItinerary : undefined}
        onCreateTaskFromSavedPlace={canEditItinerary ? onCreateTaskFromSavedPlace : undefined}
        onAddSavedPlaceToItinerary={canEditItinerary ? onAddSavedPlaceToItinerary : undefined}
        {...startPointHandlers}
      />
    </>
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
