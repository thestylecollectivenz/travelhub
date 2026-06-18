import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { CATEGORY_LIST, OPTION_CATEGORY_LIST } from '../../utils/categoryUtils';
import { combineDayAndTime, formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { flightPlaceOptionsForDay } from '../../utils/flightPlaceOptions';
import { buildDayLocationOptions } from '../../utils/dayLocationOptions';
import { durationFromDateTimes, arrivalTimeFromDuration } from '../../utils/durationFromTimes';
import { useConfig } from '../../context/ConfigContext';
import { CurrencySelect } from '../shared/CurrencySelect';
import { useAttachments } from '../../context/AttachmentsContext';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { confirmUserAction } from '../../utils/confirmAction';
import { rememberTripBookingMechanism } from '../../utils/tripBookingMechanisms';
import { AccommodationEditLayout, FlightEditLayout, LocationInfoEditLayout } from './ItineraryCardEditCategoryLayouts';
import { EntryLinksSortableList } from './EntryLinksSortableList';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { isPendingItineraryEntryId, isPendingSubItemId } from '../../utils/itineraryEntryIds';
import { editableEntryToSubItem } from '../../utils/optionEntryAdapter';
import styles from './ItineraryCardEdit.module.css';

export interface ItineraryCardEditProps {
  entry: ItineraryEntry;
  calendarDate: string;
  /** When option, edits a related option using the same form chrome as a day card. */
  variant?: 'entry' | 'option';
  onSave: (entry: ItineraryEntry) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const ItineraryCardEdit: React.FC<ItineraryCardEditProps> = ({
  entry,
  calendarDate,
  variant = 'entry',
  onSave,
  onCancel,
  onDelete
}) => {
  const { trip, tripDays, usedSuppliers, usedBookingMechanisms, usedLocations, usedCurrencies, persistEntry, persistSubItem } = useTripWorkspace();
  const { placeById } = usePlaces();
  const { config } = useConfig();
  const [draft, setDraft] = React.useState<ItineraryEntry>(() => ({ ...entry }));
  const notesTouchedRef = React.useRef(false);

  React.useEffect(() => {
    notesTouchedRef.current = false;
    setDraft({ ...entry });
  }, [entry.id]);

  React.useEffect(() => {
    if (notesTouchedRef.current) return;
    setDraft((prev) => (prev.id === entry.id ? { ...prev, notes: entry.notes } : prev));
  }, [entry.id, entry.notes]);

  const timeValue = formatTimeHHMM(draft.timeStart);
  const arrivalTimeValue = formatTimeHHMM(draft.arrivalTime ?? '');

  const patch = React.useCallback((partial: Partial<ItineraryEntry>) => {
    if (partial.notes !== undefined) {
      notesTouchedRef.current = true;
    }
    setDraft((d) => ({ ...d, ...partial }));
  }, []);
  const isAccommodation = draft.category === 'Accommodation';
  const isFlights = draft.category === 'Flights';
  const isTransport = draft.category === 'Transport';
  const isCruise = draft.category === 'Cruise';
  const isCruisePort = draft.category === 'Cruise port';
  const isActivities = draft.category === 'Activities';
  const isLocationInfo = isLocationInfoEntry(draft);
  const { docsForEntry, linksForEntry, addDocument, deleteDocument, addLink, deleteLink } = useAttachments();
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [linkTitle, setLinkTitle] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [docBusy, setDocBusy] = React.useState(false);
  const [attachError, setAttachError] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const attachDocs = docsForEntry(draft.id);
  const attachLinks = linksForEntry(draft.id);

  React.useEffect(() => {
    if (attachDocs.length + attachLinks.length > 0) {
      setAttachOpen(true);
    }
  }, [draft.id, attachDocs.length, attachLinks.length]);

  const syncDraftId = React.useCallback((nextId: string) => {
    if (nextId !== draft.id) {
      setDraft((d) => ({ ...d, id: nextId }));
    }
  }, [draft.id]);

  const resolveAttachmentTarget = React.useCallback(
    async (d: ItineraryEntry): Promise<{ id: string; dayId: string }> => {
      if (variant === 'option' && d.parentEntryId) {
        if (isPendingSubItemId(d.id)) {
          const persisted = await persistSubItem(d.parentEntryId, editableEntryToSubItem(d, undefined, calendarDate));
          return { id: persisted.id, dayId: d.dayId };
        }
        return { id: d.id, dayId: d.dayId };
      }
      const resolved = await persistEntry(d);
      return { id: resolved.id, dayId: resolved.dayId };
    },
    [variant, calendarDate, persistEntry, persistSubItem]
  );

  const nights = React.useMemo(() => {
    if (!draft.dateStart || !draft.dateEnd) return 0;
    const start = new Date(`${draft.dateStart}T00:00:00.000Z`);
    const end = new Date(`${draft.dateEnd}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }, [draft.dateStart, draft.dateEnd]);

  const perNight = React.useMemo(() => {
    if (!isAccommodation || nights <= 0) return 0;
    return draft.amount / nights;
  }, [draft.amount, isAccommodation, nights]);

  const dayPlaceOptions = React.useMemo(() => {
    if (isFlights) {
      return flightPlaceOptionsForDay(draft.dayId, tripDays, placeById);
    }
    return buildDayLocationOptions({
      dayId: draft.dayId,
      tripDays,
      placeById,
      usedLocations,
      currentLocation: draft.location,
      includeNextDay: false
    });
  }, [draft.dayId, draft.location, tripDays, placeById, isFlights, usedLocations]);

  React.useEffect(() => {
    if (!isFlights && !isTransport) return;
    const auto = durationFromDateTimes({
      startDate: draft.dateStart || calendarDate,
      startTime: draft.timeStart,
      endDate: isFlights ? draft.arrivalDate || draft.dateStart : draft.dateEnd || draft.dateStart,
      endTime: isFlights || isTransport ? draft.arrivalTime : draft.checkOutTime
    });
    if (!auto) return;
    setDraft((d) => {
      if (d.duration?.trim()) return d;
      return { ...d, duration: auto };
    });
  }, [
    draft.dateStart,
    draft.dateEnd,
    draft.timeStart,
    draft.arrivalDate,
    draft.arrivalTime,
    draft.checkOutTime,
    calendarDate,
    isFlights,
    isTransport
  ]);

  React.useEffect(() => {
    if (!isFlights && !isTransport && !isActivities) return;
    if (!draft.duration?.trim() || !draft.timeStart?.trim()) return;
    const computed = arrivalTimeFromDuration({
      startDate: draft.dateStart || calendarDate,
      startTime: draft.timeStart,
      duration: draft.duration
    });
    if (!computed) return;
    setDraft((d) => {
      const curArr = formatTimeHHMM(d.arrivalTime ?? '');
      const curDate = (d.arrivalDate || d.dateStart || calendarDate).slice(0, 10);
      if (curArr === computed.arrivalTime && curDate === computed.arrivalDate) return d;
      return {
        ...d,
        arrivalTime: computed.arrivalTime,
        arrivalDate: isFlights ? computed.arrivalDate : d.arrivalDate || computed.arrivalDate
      };
    });
  }, [draft.duration, draft.timeStart, draft.dateStart, calendarDate, isFlights, isTransport, isActivities]);

  React.useEffect(() => {
    if (!isAccommodation) return;
    setDraft((prev) => ({
      ...prev,
      dateStart: prev.dateStart || calendarDate,
      dateEnd: prev.dateEnd || prev.dateStart || calendarDate,
      unitType: 'PerNight',
      unitAmount: nights > 0 ? perNight : prev.unitAmount ?? 0
    }));
  }, [isAccommodation, calendarDate, nights, perNight]);

  React.useEffect(() => {
    if (!isFlights) return;
    setDraft((prev) => ({
      ...prev,
      arrivalDate: prev.arrivalDate || prev.dateStart || calendarDate
    }));
  }, [isFlights, calendarDate]);

  const handleSave = React.useCallback(() => {
    let title = draft.title.trim();
    if (!title && isTransport) {
      const tf = (draft.transportFrom ?? '').trim();
      const tt = (draft.transportTo ?? '').trim();
      const tm = (draft.transportMode ?? '').trim();
      const arrow = tf || tt ? `${tf} → ${tt}` : '';
      title = (arrow + (tm ? ` (${tm})` : '')).trim() || 'Transport';
    }
    if (!title) {
      title =
        (draft.location ?? '').trim() ||
        draft.supplier.trim() ||
        draft.category.trim() ||
        'Itinerary item';
    }
    const cur = draft.currency.trim().toUpperCase().slice(0, 3) || 'NZD';
    const timeStart = combineDayAndTime(calendarDate, timeValue);
    const saved: ItineraryEntry = {
      ...draft,
      title,
      currency: cur,
      timeStart: timeStart || '',
      supplier: draft.supplier.trim(),
      notes: draft.notes.trim(),
      location: draft.location?.trim() || undefined,
      duration: draft.duration.trim(),
      arrivalTime: draft.arrivalTime,
      arrivalDate: draft.arrivalDate,
      embarksDate: draft.embarksDate,
      disembarksDate: draft.disembarksDate,
      dateStart: draft.dateStart,
      dateEnd: draft.dateEnd,
      paymentCurrency: draft.paymentCurrency || config.homeCurrency,
      bookingReference: draft.bookingReference?.trim() || undefined,
      roomType: draft.roomType?.trim() || undefined,
      checkInTime: draft.checkInTime?.trim() || undefined,
      checkOutTime: draft.checkOutTime?.trim() || undefined,
      streetAddress: draft.streetAddress?.trim() || undefined,
      flightNumbers: draft.flightNumbers?.trim() || undefined,
      checkInClosesTime: draft.checkInClosesTime?.trim() || undefined,
      bagCheckClosesTime: draft.bagCheckClosesTime?.trim() || undefined,
      phoneNumber: draft.phoneNumber?.trim() || undefined,
      bookingMechanism: draft.bookingMechanism?.trim() || undefined,
      cabinClass: draft.cabinClass,
      journeyType: draft.journeyType,
      returnDate: draft.returnDate?.trim() || undefined,
      returnTime: draft.returnTime?.trim() || undefined,
      perksIncluded: draft.perksIncluded?.trim() || undefined,
      cancellationPolicy: draft.cancellationPolicy?.trim() || undefined,
      cancellationDeadline: draft.cancellationDeadline?.trim() || undefined,
      cruiseReference: draft.cruiseReference?.trim() || undefined,
      cruiseLineName: draft.cruiseLineName?.trim() || undefined,
      shipName: draft.shipName?.trim() || undefined,
      cabinTypeAndNumber: draft.cabinTypeAndNumber?.trim() || undefined,
      packageName: draft.packageName?.trim() || undefined,
      packageInclusions: draft.packageInclusions?.trim() || undefined,
      transportFrom: draft.transportFrom?.trim() || undefined,
      transportTo: draft.transportTo?.trim() || undefined,
      transportMode: draft.transportMode?.trim() || undefined,
      transportTransfers: draft.transportTransfers
    };
    if (saved.category === 'Transport') {
      saved.journeyType = saved.journeyType ?? 'oneway';
      if (saved.journeyType !== 'return') {
        saved.returnDate = undefined;
        saved.returnTime = undefined;
      }
    }
    if (saved.category === 'Flights') {
      saved.cabinClass = saved.cabinClass ?? 'economy';
    }
    if (saved.category === 'Accommodation') {
      saved.unitType = 'PerNight';
      saved.unitAmount = nights > 0 ? perNight : saved.unitAmount;
      if (saved.dateStart && trip) {
        const checkInDay = tripDays.find((d) => d.tripId === trip.id && d.calendarDate === saved.dateStart);
        if (checkInDay) {
          saved.dayId = checkInDay.id;
        }
      }
      if (trip?.id && saved.bookingMechanism) {
        rememberTripBookingMechanism(trip.id, saved.bookingMechanism);
      }
    }
    onSave(saved);
  }, [calendarDate, draft, timeValue, nights, perNight, trip, tripDays, config.homeCurrency, isTransport]);

  const hasMeaningfulDraftContent = React.useMemo(
    () =>
      Boolean(
        draft.title.trim() ||
          draft.supplier.trim() ||
          (draft.location ?? '').trim() ||
          draft.notes.trim() ||
          draft.duration.trim() ||
          (draft.bookingReference ?? '').trim() ||
          (draft.roomType ?? '').trim() ||
          (draft.streetAddress ?? '').trim() ||
          (draft.flightNumbers ?? '').trim() ||
          (draft.phoneNumber ?? '').trim() ||
          (draft.bookingMechanism ?? '').trim() ||
          (draft.transportFrom ?? '').trim() ||
          (draft.transportTo ?? '').trim() ||
          (draft.transportMode ?? '').trim() ||
          (draft.cruiseReference ?? '').trim() ||
          (draft.cruiseLineName ?? '').trim() ||
          (draft.shipName ?? '').trim() ||
          (draft.cabinTypeAndNumber ?? '').trim() ||
          (draft.packageName ?? '').trim() ||
          (draft.packageInclusions ?? '').trim() ||
          (draft.perksIncluded ?? '').trim() ||
          (draft.cancellationPolicy ?? '').trim() ||
          draft.amount > 0 ||
          (draft.amountPaid ?? 0) > 0 ||
          draft.bookingRequired ||
          draft.category !== entry.category ||
          draft.decisionStatus !== entry.decisionStatus ||
          draft.paymentStatus !== entry.paymentStatus ||
          draft.bookingStatus !== entry.bookingStatus ||
          Boolean(
            draft.timeStart ||
              draft.arrivalTime ||
              draft.arrivalDate ||
              draft.embarksDate ||
              draft.disembarksDate ||
              draft.dateStart ||
              draft.dateEnd ||
              draft.returnDate ||
              draft.returnTime ||
              draft.paymentDueDate ||
              draft.bookingDueDate ||
              draft.checkInTime ||
              draft.checkOutTime ||
              draft.checkInClosesTime ||
              draft.bagCheckClosesTime ||
              draft.cancellationDeadline
          )
      ),
    [draft, entry.bookingStatus, entry.category, entry.decisionStatus, entry.paymentStatus]
  );

  const canSave =
    !isPendingItineraryEntryId(draft.id) ||
    isLocationInfo ||
    hasMeaningfulDraftContent ||
    (isTransport &&
      Boolean(
        (draft.transportFrom ?? '').trim() ||
          (draft.transportTo ?? '').trim() ||
          (draft.transportMode ?? '').trim()
      ));

  const layoutProps = {
    draft,
    calendarDate,
    dayPlaceOptions,
    bookingMechanismOptions: usedBookingMechanisms,
    patch,
    nights,
    perNight,
    homeCurrency: config.homeCurrency,
    usedCurrencies,
    usedSuppliers
  };

  const isOption = variant === 'option';

  return (
    <div className={styles.form}>
      {isOption ? <h3 className={styles.optionEditHeading}>Edit option</h3> : null}
      {isFlights ? (
        <FlightEditLayout {...layoutProps} />
      ) : isAccommodation ? (
        <AccommodationEditLayout {...layoutProps} />
      ) : isLocationInfo && !isOption ? (
        <>
          <div className={styles.grid}>
            <label className={styles.label} htmlFor={`cat-${draft.id}`}>
              Category
            </label>
            <select
              id={`cat-${draft.id}`}
              className={styles.select}
              value={draft.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              {CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className={styles.label} htmlFor={`loc-${draft.id}`}>
              Location
            </label>
            <input
              id={`loc-${draft.id}`}
              className={styles.input}
              list={`day-places-${draft.id}`}
              value={draft.location ?? ''}
              onChange={(e) => patch({ location: e.target.value, title: e.target.value.trim() || draft.title })}
              placeholder="Place name or pick from day locations"
            />
            <datalist id={`day-places-${draft.id}`}>
              {dayPlaceOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <LocationInfoEditLayout {...layoutProps} />
        </>
      ) : (
      <div className={styles.grid}>
        {!isOption ? (
          <>
            <label className={styles.label} htmlFor={`cat-${draft.id}`}>
              Category
            </label>
            <select
              id={`cat-${draft.id}`}
              className={styles.select}
              value={draft.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              {CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className={styles.label} htmlFor={`cat-${draft.id}`}>
              Category
            </label>
            <select
              id={`cat-${draft.id}`}
              className={styles.select}
              value={draft.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              {OPTION_CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        <label className={styles.label} htmlFor={`time-${draft.id}`}>
          Time
        </label>
        <input
          id={`time-${draft.id}`}
          className={styles.input}
          type="time"
          value={timeValue}
          onChange={(e) => patch({ timeStart: combineDayAndTime(calendarDate, e.target.value) })}
        />

        <label className={styles.label} htmlFor={`dur-${draft.id}`}>
          Duration
        </label>
        <input
          id={`dur-${draft.id}`}
          className={styles.input}
          type="text"
          placeholder="e.g. 2h 30m"
          value={draft.duration}
          onChange={(e) => patch({ duration: e.target.value })}
        />
        {isFlights || isTransport ? (
          <>
            <label className={styles.label} htmlFor={`arr-time-${draft.id}`}>
              Arrival time
            </label>
            <input
              id={`arr-time-${draft.id}`}
              className={styles.input}
              type="time"
              value={arrivalTimeValue}
              onChange={(e) => patch({ arrivalTime: combineDayAndTime(calendarDate, e.target.value) })}
            />
          </>
        ) : null}
        {isFlights ? (
          <>
            <label className={styles.label} htmlFor={`arr-date-${draft.id}`}>
              Arrival date
            </label>
            <input
              id={`arr-date-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.arrivalDate ?? ''}
              onChange={(e) => patch({ arrivalDate: e.target.value })}
            />
          </>
        ) : null}
        {isCruisePort ? (
          <>
            <label className={styles.label} htmlFor={`arrive-${draft.id}`}>
              Arrives
            </label>
            <input
              id={`arrive-${draft.id}`}
              className={styles.input}
              type="time"
              value={draft.timeStart ?? ''}
              onChange={(e) => patch({ timeStart: e.target.value })}
            />
            <label className={styles.label} htmlFor={`depart-${draft.id}`}>
              Departs
            </label>
            <input
              id={`depart-${draft.id}`}
              className={styles.input}
              type="time"
              value={draft.arrivalTime ?? ''}
              onChange={(e) => patch({ arrivalTime: e.target.value })}
            />
          </>
        ) : null}
        {isCruise ? (
          <>
            <label className={styles.label} htmlFor={`embark-date-${draft.id}`}>
              Embark date
            </label>
            <input
              id={`embark-date-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.embarksDate ?? ''}
              onChange={(e) => patch({ embarksDate: e.target.value })}
            />
            <label className={styles.label} htmlFor={`disembark-date-${draft.id}`}>
              Disembark date
            </label>
            <input
              id={`disembark-date-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.disembarksDate ?? ''}
              onChange={(e) => patch({ disembarksDate: e.target.value })}
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor={`title-${draft.id}`}>
          Title
        </label>
        <input
          id={`title-${draft.id}`}
          className={styles.input}
          type="text"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={isTransport ? 'Optional — auto from From / To / Mode if empty' : undefined}
        />

        {isAccommodation ? (
          <>
            <label className={styles.label} htmlFor={`checkin-${draft.id}`}>
              Check-in date
            </label>
            <input
              id={`checkin-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.dateStart ?? ''}
              onChange={(e) => patch({ dateStart: e.target.value })}
            />

            <label className={styles.label} htmlFor={`checkout-${draft.id}`}>
              Check-out date
            </label>
            <input
              id={`checkout-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.dateEnd ?? ''}
              onChange={(e) => patch({ dateEnd: e.target.value })}
            />

            <label className={styles.label}>Nights</label>
            <div className={styles.readOnlyValue}>{nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—'}</div>
          </>
        ) : null}

        {!isCruise && !isCruisePort ? (
          <>
            <label className={styles.label} htmlFor={`sup-${draft.id}`}>
              Supplier
            </label>
            <input
              id={`sup-${draft.id}`}
              className={styles.input}
              type="text"
              list={`supplier-list-${draft.id}`}
              value={draft.supplier}
              onChange={(e) => patch({ supplier: e.target.value })}
            />
            <datalist id={`supplier-list-${draft.id}`}>
              {usedSuppliers.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </>
        ) : null}

        {isCruise ? (
          <>
            <label className={styles.label} htmlFor={`cref-${draft.id}`}>
              Booking reference
            </label>
            <input
              id={`cref-${draft.id}`}
              className={styles.input}
              value={draft.cruiseReference ?? ''}
              onChange={(e) => patch({ cruiseReference: e.target.value })}
            />
            <label className={styles.label} htmlFor={`cline-${draft.id}`}>
              Cruise line
            </label>
            <input
              id={`cline-${draft.id}`}
              className={styles.input}
              value={draft.cruiseLineName ?? ''}
              onChange={(e) => patch({ cruiseLineName: e.target.value })}
            />
            <label className={styles.label} htmlFor={`ship-${draft.id}`}>
              Ship name
            </label>
            <input
              id={`ship-${draft.id}`}
              className={styles.input}
              value={draft.shipName ?? ''}
              onChange={(e) => patch({ shipName: e.target.value })}
            />
            <label className={styles.label} htmlFor={`cabin-${draft.id}`}>
              Cabin type &amp; number
            </label>
            <input
              id={`cabin-${draft.id}`}
              className={styles.input}
              value={draft.cabinTypeAndNumber ?? ''}
              onChange={(e) => patch({ cabinTypeAndNumber: e.target.value })}
            />
            <label className={styles.label} htmlFor={`pkg-${draft.id}`}>
              Package name
            </label>
            <input
              id={`pkg-${draft.id}`}
              className={styles.input}
              value={draft.packageName ?? ''}
              onChange={(e) => patch({ packageName: e.target.value })}
            />
            <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`pkginc-${draft.id}`}>
              Package inclusions
            </label>
            <textarea
              id={`pkginc-${draft.id}`}
              className={`${styles.textarea} ${styles.fullRow}`}
              rows={3}
              value={draft.packageInclusions ?? ''}
              onChange={(e) => patch({ packageInclusions: e.target.value })}
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor={`loc-${draft.id}`}>
          Location
        </label>
        <input
          id={`loc-${draft.id}`}
          className={styles.input}
          type="text"
          list={`location-list-${draft.id}`}
          value={draft.location ?? ''}
          onChange={(e) => patch({ location: e.target.value })}
        />
        <datalist id={`location-list-${draft.id}`}>
          {dayPlaceOptions.map((value) => (
            <option key={`day-${value}`} value={value} />
          ))}
        </datalist>

        {isTransport ? (
          <>
            <label className={styles.label} htmlFor={`tf-${draft.id}`}>
              From
            </label>
            <input
              id={`tf-${draft.id}`}
              className={styles.input}
              value={draft.transportFrom ?? ''}
              onChange={(e) => patch({ transportFrom: e.target.value })}
            />
            <label className={styles.label} htmlFor={`tt-${draft.id}`}>
              To
            </label>
            <input
              id={`tt-${draft.id}`}
              className={styles.input}
              value={draft.transportTo ?? ''}
              onChange={(e) => patch({ transportTo: e.target.value })}
            />
            <label className={styles.label} htmlFor={`tm-${draft.id}`}>
              Mode
            </label>
            <select
              id={`tm-${draft.id}`}
              className={styles.select}
              value={draft.transportMode ?? ''}
              onChange={(e) => patch({ transportMode: e.target.value })}
            >
              <option value="">—</option>
              <option value="Flight">Flight</option>
              <option value="Train">Train</option>
              <option value="Bus / Coach">Bus / Coach</option>
              <option value="Taxi / Rideshare">Taxi / Rideshare</option>
              <option value="Ferry / Boat">Ferry / Boat</option>
              <option value="Car (rental or own)">Car (rental or own)</option>
              <option value="Ship / Cruise transfer">Ship / Cruise transfer</option>
              <option value="Walking">Walking</option>
              <option value="Other">Other</option>
            </select>
            {(draft.transportMode === 'Train' || draft.transportMode === 'Bus / Coach') ? (
              <>
                <label className={styles.label} htmlFor={`tx-${draft.id}`}>
                  Transfers
                </label>
                <input
                  id={`tx-${draft.id}`}
                  className={styles.input}
                  type="number"
                  min={0}
                  max={20}
                  value={draft.transportTransfers ?? 0}
                  onChange={(e) => patch({ transportTransfers: Math.max(0, Number(e.target.value) || 0) })}
                />
              </>
            ) : null}
            <label className={styles.label} htmlFor={`jt-${draft.id}`}>
              Journey type
            </label>
            <select
              id={`jt-${draft.id}`}
              className={styles.select}
              value={draft.journeyType ?? 'oneway'}
              onChange={(e) =>
                patch({ journeyType: e.target.value as ItineraryEntry['journeyType'] })
              }
            >
              <option value="oneway">One way</option>
              <option value="return">Return</option>
            </select>
            {draft.journeyType === 'return' ? (
              <>
                <label className={styles.label} htmlFor={`rd-${draft.id}`}>
                  Return date
                </label>
                <input
                  id={`rd-${draft.id}`}
                  className={styles.input}
                  type="date"
                  value={draft.returnDate ?? ''}
                  onChange={(e) => patch({ returnDate: e.target.value })}
                />
                <label className={styles.label} htmlFor={`rt-${draft.id}`}>
                  Return departure time
                </label>
                <input
                  id={`rt-${draft.id}`}
                  className={styles.input}
                  type="time"
                  value={formatTimeHHMM(draft.returnTime ?? '')}
                  onChange={(e) => patch({ returnTime: combineDayAndTime(calendarDate, e.target.value) })}
                />
              </>
            ) : null}
          </>
        ) : null}

        {isAccommodation ? (
          <>
            <label className={styles.label} htmlFor={`bref-a-${draft.id}`}>
              Booking reference
            </label>
            <input
              id={`bref-a-${draft.id}`}
              className={styles.input}
              value={draft.bookingReference ?? ''}
              onChange={(e) => patch({ bookingReference: e.target.value })}
            />
            <label className={styles.label} htmlFor={`room-${draft.id}`}>
              Room type
            </label>
            <input
              id={`room-${draft.id}`}
              className={styles.input}
              value={draft.roomType ?? ''}
              onChange={(e) => patch({ roomType: e.target.value })}
            />
            <label className={styles.label} htmlFor={`cit-${draft.id}`}>
              Check-in time
            </label>
            <input
              id={`cit-${draft.id}`}
              className={styles.input}
              type="time"
              value={formatTimeHHMM(draft.checkInTime ?? '')}
              onChange={(e) => patch({ checkInTime: combineDayAndTime(calendarDate, e.target.value) })}
            />
            <label className={styles.label} htmlFor={`cot-${draft.id}`}>
              Check-out time
            </label>
            <input
              id={`cot-${draft.id}`}
              className={styles.input}
              type="time"
              value={formatTimeHHMM(draft.checkOutTime ?? '')}
              onChange={(e) => patch({ checkOutTime: combineDayAndTime(calendarDate, e.target.value) })}
            />
            <label className={styles.label} htmlFor={`addr-a-${draft.id}`}>
              Street address
            </label>
            <input
              id={`addr-a-${draft.id}`}
              className={styles.input}
              value={draft.streetAddress ?? ''}
              onChange={(e) => patch({ streetAddress: e.target.value })}
            />
            <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`perks-${draft.id}`}>
              Perks included
            </label>
            <textarea
              id={`perks-${draft.id}`}
              className={`${styles.textarea} ${styles.fullRow}`}
              rows={2}
              value={draft.perksIncluded ?? ''}
              onChange={(e) => patch({ perksIncluded: e.target.value })}
            />
            <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`cancelpol-${draft.id}`}>
              Cancellation policy
            </label>
            <textarea
              id={`cancelpol-${draft.id}`}
              className={`${styles.textarea} ${styles.fullRow}`}
              rows={2}
              value={draft.cancellationPolicy ?? ''}
              onChange={(e) => patch({ cancellationPolicy: e.target.value })}
            />
            <label className={styles.label} htmlFor={`canceldead-${draft.id}`}>
              Cancellation deadline
            </label>
            <input
              id={`canceldead-${draft.id}`}
              className={styles.input}
              type="datetime-local"
              value={draft.cancellationDeadline ? draft.cancellationDeadline.slice(0, 16) : ''}
              onChange={(e) => patch({ cancellationDeadline: e.target.value || undefined })}
            />
          </>
        ) : null}

        {isFlights ? (
          <>
            <label className={styles.label} htmlFor={`bref-f-${draft.id}`}>
              Booking reference (PNR)
            </label>
            <input
              id={`bref-f-${draft.id}`}
              className={styles.input}
              value={draft.bookingReference ?? ''}
              onChange={(e) => patch({ bookingReference: e.target.value })}
            />
            <label className={styles.label} htmlFor={`fn-${draft.id}`}>
              Flight number(s)
            </label>
            <input
              id={`fn-${draft.id}`}
              className={styles.input}
              value={draft.flightNumbers ?? ''}
              onChange={(e) => patch({ flightNumbers: e.target.value })}
            />
            <label className={styles.label} htmlFor={`cic-${draft.id}`}>
              Check-in closes
            </label>
            <input
              id={`cic-${draft.id}`}
              className={styles.input}
              type="time"
              value={formatTimeHHMM(draft.checkInClosesTime ?? '')}
              onChange={(e) => patch({ checkInClosesTime: combineDayAndTime(calendarDate, e.target.value) })}
            />
            <label className={styles.label} htmlFor={`cab-${draft.id}`}>
              Cabin class
            </label>
            <select
              id={`cab-${draft.id}`}
              className={styles.select}
              value={draft.cabinClass ?? 'economy'}
              onChange={(e) => patch({ cabinClass: e.target.value as ItineraryEntry['cabinClass'] })}
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
            </select>
          </>
        ) : null}

        {isActivities ? (
          <>
            <label className={styles.label} htmlFor={`bref-act-${draft.id}`}>
              Booking reference
            </label>
            <input
              id={`bref-act-${draft.id}`}
              className={styles.input}
              value={draft.bookingReference ?? ''}
              onChange={(e) => patch({ bookingReference: e.target.value })}
            />
            <label className={styles.label} htmlFor={`addr-act-${draft.id}`}>
              Address
            </label>
            <input
              id={`addr-act-${draft.id}`}
              className={styles.input}
              value={draft.streetAddress ?? ''}
              onChange={(e) => patch({ streetAddress: e.target.value })}
            />
            <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`cancelpol-act-${draft.id}`}>
              Cancellation policy
            </label>
            <textarea
              id={`cancelpol-act-${draft.id}`}
              className={`${styles.textarea} ${styles.fullRow}`}
              rows={2}
              value={draft.cancellationPolicy ?? ''}
              onChange={(e) => patch({ cancellationPolicy: e.target.value })}
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor={`dec-${draft.id}`}>
          Decision
        </label>
        <select
          id={`dec-${draft.id}`}
          className={styles.select}
          value={draft.decisionStatus}
          onChange={(e) =>
            patch({ decisionStatus: e.target.value as ItineraryEntry['decisionStatus'] })
          }
        >
          <option value="Idea">Idea</option>
          <option value="Planned">Planned</option>
          <option value="Confirmed">Confirmed</option>
        </select>

        <div className={`${styles.checkboxRow} ${styles.fullRow}`}>
          <input
            id={`bookreq-${draft.id}`}
            className={styles.checkbox}
            type="checkbox"
            checked={draft.bookingRequired}
            onChange={(e) => patch({ bookingRequired: e.target.checked })}
          />
          <label className={styles.label} htmlFor={`bookreq-${draft.id}`}>
            Booking required
          </label>
        </div>

        {draft.bookingRequired ? (
          <>
            <label className={styles.label} htmlFor={`bstat-${draft.id}`}>
              Booking status
            </label>
            <select
              id={`bstat-${draft.id}`}
              className={styles.select}
              value={draft.bookingStatus}
              onChange={(e) =>
                patch({ bookingStatus: e.target.value as ItineraryEntry['bookingStatus'] })
              }
            >
              <option value="Not booked">Not booked</option>
              <option value="Booked">Booked</option>
            </select>
            <label className={styles.label} htmlFor={`bookdue-${draft.id}`}>
              Book by
            </label>
            <input
              id={`bookdue-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.bookingDueDate?.slice(0, 10) || ''}
              onChange={(e) => patch({ bookingDueDate: e.target.value || undefined })}
            />
          </>
        ) : null}

        <label className={styles.label} htmlFor={`pay-${draft.id}`}>
          Payment
        </label>
        <select
          id={`pay-${draft.id}`}
          className={styles.select}
          value={draft.paymentStatus}
          onChange={(e) => {
            const value = e.target.value as ItineraryEntry['paymentStatus'];
            patch({
              paymentStatus: value,
              amount: value === 'Free' ? 0 : draft.amount,
              amountPaid: value === 'Part paid' ? draft.amountPaid : undefined
            });
          }}
        >
          <option value="Not paid">Not paid</option>
          <option value="Part paid">Part paid</option>
          <option value="Fully paid">Fully paid</option>
          <option value="Free">Free</option>
        </select>

        {draft.paymentStatus === 'Not paid' || draft.paymentStatus === 'Part paid' ? (
          <>
            <label className={styles.label} htmlFor={`paydue-${draft.id}`}>
              Pay by
            </label>
            <input
              id={`paydue-${draft.id}`}
              className={styles.input}
              type="date"
              value={draft.paymentDueDate?.slice(0, 10) || ''}
              onChange={(e) => patch({ paymentDueDate: e.target.value || undefined })}
            />
            <label className={styles.label} htmlFor={`paydue-type-${draft.id}`}>
              Payment timing
            </label>
            <select
              id={`paydue-type-${draft.id}`}
              className={styles.select}
              value={draft.paymentDueType || 'Manual'}
              onChange={(e) => patch({ paymentDueType: e.target.value as ItineraryEntry['paymentDueType'] })}
            >
              <option value="Manual">Manual — I need to pay by this date</option>
              <option value="Automatic">Automatic — charged on this date</option>
            </select>
          </>
        ) : null}

        {draft.paymentStatus === 'Part paid' ? (
          <>
            <label className={styles.label} htmlFor={`amt-paid-${draft.id}`}>
              Amount paid so far
            </label>
            <input
              id={`amt-paid-${draft.id}`}
              className={styles.input}
              type="number"
              min={0}
              max={draft.amount}
              step={0.01}
              placeholder="0.00"
              value={draft.amountPaid ?? ''}
              onChange={(e) =>
                patch({
                  amountPaid: e.target.value === '' ? undefined : Math.min(draft.amount, Number(e.target.value) || 0)
                })
              }
            />
            <label className={styles.label} htmlFor={`paycur-${draft.id}`}>
              Payment currency
            </label>
            <CurrencySelect
              id={`paycur-${draft.id}`}
              className={styles.select}
              value={draft.paymentCurrency || config.homeCurrency}
              onChange={(code) => patch({ paymentCurrency: code })}
              priorityCodes={usedCurrencies}
            />
            {(draft.paymentCurrency || config.homeCurrency) !== draft.currency ? (
              <div className={`${styles.readOnlyValue} ${styles.fullRow}`}>
                Will be converted to {config.homeCurrency} at current FX rate
              </div>
            ) : null}
          </>
        ) : null}

        {isOption ? (
          <>
            <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`cancelpol-opt-${draft.id}`}>
              Cancellation policy
            </label>
            <textarea
              id={`cancelpol-opt-${draft.id}`}
              className={`${styles.textarea} ${styles.fullRow}`}
              rows={2}
              value={draft.cancellationPolicy ?? ''}
              onChange={(e) => patch({ cancellationPolicy: e.target.value })}
            />
          </>
        ) : null}

        <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`notes-${draft.id}`}>
          Notes
        </label>
        <textarea
          id={`notes-${draft.id}`}
          className={`${styles.textarea} ${styles.fullRow}`}
          rows={3}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />

        {draft.paymentStatus !== 'Free' ? (
          <>
            <label className={styles.label} htmlFor={`amt-${draft.id}`}>
              {isAccommodation ? 'Total cost' : 'Amount'}
            </label>
            <input
              id={`amt-${draft.id}`}
              className={styles.input}
              type="number"
              min={0}
              step={0.01}
              value={Number.isNaN(draft.amount) ? '' : draft.amount}
              onChange={(e) => patch({ amount: e.target.value === '' ? 0 : Number(e.target.value) })}
            />
            <label className={styles.label} htmlFor={`cur-${draft.id}`}>
              Currency
            </label>
            <CurrencySelect
              id={`cur-${draft.id}`}
              className={styles.select}
              value={draft.currency}
              onChange={(code) => patch({ currency: code })}
              priorityCodes={usedCurrencies}
            />
            <label className={styles.label} htmlFor={`cost-certainty-${draft.id}`}>
              Cost certainty
            </label>
            <select
              id={`cost-certainty-${draft.id}`}
              className={styles.select}
              value={draft.costCertainty || 'Estimated'}
              onChange={(e) =>
                patch({ costCertainty: e.target.value as ItineraryEntry['costCertainty'] })
              }
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Estimated">Estimated</option>
            </select>
          </>
        ) : null}

        {isAccommodation ? (
          <>
            <label className={styles.label}>Per-night cost</label>
            <div className={styles.readOnlyValue}>{nights > 0 ? perNight.toFixed(2) : '—'}</div>
          </>
        ) : null}
      </div>
      )}

      <div className={styles.attachmentsBlock}>
        <button type="button" className={styles.attachmentsToggle} onClick={() => setAttachOpen((o) => !o)}>
          {attachOpen ? 'Hide attachments ▴' : 'Attachments ▾'}
        </button>
        {attachOpen ? (
          <div className={styles.attachmentsInner}>
            <p className={styles.attachmentsHint}>
              {attachDocs.length} file{attachDocs.length === 1 ? '' : 's'} · {attachLinks.length} link
              {attachLinks.length === 1 ? '' : 's'}
              {isPendingItineraryEntryId(draft.id) ? ' · saves entry automatically when you add files or links' : ''}
            </p>
            {attachError ? <p className={styles.attachmentsHint}>{attachError}</p> : null}
            <div className={styles.attachmentsToolbar}>
              <button type="button" className={styles.btnSecondary} disabled={docBusy} onClick={() => fileRef.current?.click()}>
                {docBusy ? 'Uploading…' : 'Upload file'}
              </button>
              <input
                ref={fileRef}
                type="file"
                className={styles.fileHidden}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) return;
                  setDocBusy(true);
                  setAttachError('');
                  void resolveAttachmentTarget(draft)
                    .then((resolved) => {
                      syncDraftId(resolved.id);
                      return addDocument({
                        file: f,
                        dayId: resolved.dayId,
                        entryId: resolved.id,
                        documentType: 'Other',
                        notes: ''
                      });
                    })
                    .catch((err) => {
                      setAttachError('Could not save file — try saving the card first.');
                      console.error(err);
                    })
                    .then(() => {
                      setDocBusy(false);
                      ev.target.value = '';
                    });
                }}
              />
              <input
                className={styles.input}
                placeholder="Link title"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
              <input
                className={styles.input}
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  const t = linkTitle.trim();
                  const u = linkUrl.trim();
                  if (!t || !u) return;
                  setAttachError('');
                  void resolveAttachmentTarget(draft)
                    .then((resolved) => {
                      syncDraftId(resolved.id);
                      return addLink({
                        dayId: resolved.dayId,
                        entryId: resolved.id,
                        linkType: 'Url',
                        url: u,
                        linkTitle: t
                      });
                    })
                    .then(() => {
                      setLinkTitle('');
                      setLinkUrl('');
                    })
                    .catch((err) => {
                      setAttachError('Could not save link — try saving the card first.');
                      console.error(err);
                    });
                }}
              >
                Add link
              </button>
            </div>
            <div className={styles.attachList}>
              {attachDocs.map((d) => (
                <div key={d.id} className={styles.attachRow}>
                  <button type="button" className={styles.attachLink} onClick={() => openDocumentUrl(d.fileUrl)}>
                    {d.title || 'Document'}
                  </button>
                  <button
                    type="button"
                    className={styles.attachRemove}
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmUserAction('Remove this document?'))) return;
                        deleteDocument(d.id).catch(console.error);
                      })();
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <EntryLinksSortableList entryId={draft.id} links={attachLinks}>
                {(l, dragHandle) => (
                  <div className={styles.attachRow}>
                    {dragHandle}
                    <button type="button" className={styles.attachLink} onClick={() => openDocumentUrl(l.url)}>
                      {l.linkTitle || l.url}
                    </button>
                    <button
                      type="button"
                      className={styles.attachRemove}
                      onClick={() => {
                        void (async () => {
                          if (!(await confirmUserAction('Remove this link?'))) return;
                          deleteLink(l.id).catch(console.error);
                        })();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </EntryLinksSortableList>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onDelete}
        >
          {isOption ? 'Delete option' : 'Delete'}
        </button>
        <div className={styles.actionsRight}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} disabled={!canSave} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
