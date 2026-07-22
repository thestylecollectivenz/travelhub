import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { CATEGORY_LIST } from '../../utils/categoryUtils';
import {
  defaultLocationInfoNotes,
  locationHighlightRows,
  locationInfoIsPopulated,
  markHighlightRowsUserEdited,
  normalizeLocationInfoNotes,
  recordSuppressedHighlightLabels,
  splitHighlightRows,
  parseLocationInfoNotes,
  serializeLocationInfoNotes,
  type LocationHighlightRow,
  type LocationInfoNotes
} from '../../utils/locationInfoEntry';
import { LocationInfoAskPanel } from './LocationInfoAskPanel';
import { LocationInfoHighlights } from './LocationInfoHighlights';
import { useConfig } from '../../context/ConfigContext';
import { usePlaces } from '../../context/PlacesContext';
import { useSpContext } from '../../context/SpContext';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoAIGeneration } from '../../utils/locationInfoGeneration';
import { combineDayAndTime, formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { CurrencySelect } from '../shared/CurrencySelect';
import { RichTextField } from '../shared/RichTextField';
import { FieldSuggestionList } from '../shared/FieldSuggestionList';
import styles from './ItineraryCardEdit.module.css';

export interface CategoryEditLayoutProps {
  draft: ItineraryEntry;
  calendarDate: string;
  dayPlaceOptions: string[];
  bookingMechanismOptions: string[];
  patch: (partial: Partial<ItineraryEntry>) => void;
  nights: number;
  perNight: number;
  homeCurrency: string;
  usedCurrencies?: string[];
  usedSuppliers?: string[];
  touchShell?: boolean;
  patchDateStart?: (date: string) => void;
}

function StatusFields({ draft, patch }: Pick<CategoryEditLayoutProps, 'draft' | 'patch'>): React.ReactElement {
  return (
    <>
      <label className={styles.label} htmlFor={`dec-${draft.id}`}>
        Status
      </label>
      <select
        id={`dec-${draft.id}`}
        className={styles.select}
        value={draft.decisionStatus}
        onChange={(e) => patch({ decisionStatus: e.target.value as ItineraryEntry['decisionStatus'] })}
      >
        <option value="Idea">Idea</option>
        <option value="Planned">Planned</option>
        <option value="Confirmed">Confirmed</option>
      </select>
    </>
  );
}

function BookingPaymentFields({
  draft,
  patch,
  homeCurrency,
  usedCurrencies,
  amountLabel
}: Pick<CategoryEditLayoutProps, 'draft' | 'patch' | 'homeCurrency' | 'usedCurrencies'> & { amountLabel: string }): React.ReactElement {
  return (
    <>
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
            onChange={(e) => patch({ bookingStatus: e.target.value as ItineraryEntry['bookingStatus'] })}
          >
            <option value="Not booked">Not booked</option>
            <option value="Booked">Booked</option>
          </select>
        </>
      ) : null}
      <label className={styles.label} htmlFor={`pay-${draft.id}`}>
        Payment status
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
      {draft.paymentStatus !== 'Free' ? (
        <>
          <label className={styles.label} htmlFor={`amt-${draft.id}`}>
            {amountLabel}
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
            onChange={(e) => patch({ costCertainty: e.target.value as ItineraryEntry['costCertainty'] })}
          >
            <option value="Confirmed">Confirmed</option>
            <option value="Estimated">Estimated</option>
          </select>
        </>
      ) : null}
    </>
  );
}

export function CancellationPolicyFields({
  draft,
  patch
}: Pick<CategoryEditLayoutProps, 'draft' | 'patch'>): React.ReactElement {
  return (
    <>
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
  );
}

export const FlightEditLayout: React.FC<CategoryEditLayoutProps> = (props) => {
  const { draft, calendarDate, dayPlaceOptions, patch, usedSuppliers, touchShell } = props;
  const [supplierSuggestOpen, setSupplierSuggestOpen] = React.useState(false);
  const [fromSuggestOpen, setFromSuggestOpen] = React.useState(false);
  const [toSuggestOpen, setToSuggestOpen] = React.useState(false);
  const timeValue = formatTimeHHMM(draft.timeStart);
  const arrivalTimeValue = formatTimeHHMM(draft.arrivalTime ?? '');

  return (
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
      <StatusFields {...props} />
      <label className={styles.label} htmlFor={`tf-${draft.id}`}>
        From location
      </label>
      <div className={styles.fieldWithSuggestions}>
        <input
          id={`tf-${draft.id}`}
          className={styles.input}
          list={`location-list-${draft.id}`}
          value={draft.transportFrom ?? ''}
          onChange={(e) => patch({ transportFrom: e.target.value })}
          onFocus={() => touchShell && setFromSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setFromSuggestOpen(false), 120)}
        />
        {touchShell ? (
          <FieldSuggestionList
            options={dayPlaceOptions}
            value={draft.transportFrom ?? ''}
            onSelect={(value) => {
              patch({ transportFrom: value });
              setFromSuggestOpen(false);
            }}
            active={fromSuggestOpen || Boolean((draft.transportFrom ?? '').trim())}
          />
        ) : null}
      </div>
      <label className={styles.label} htmlFor={`tt-${draft.id}`}>
        To location
      </label>
      <div className={styles.fieldWithSuggestions}>
        <input
          id={`tt-${draft.id}`}
          className={styles.input}
          list={`location-list-${draft.id}`}
          value={draft.transportTo ?? ''}
          onChange={(e) => patch({ transportTo: e.target.value })}
          onFocus={() => touchShell && setToSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setToSuggestOpen(false), 120)}
        />
        {touchShell ? (
          <FieldSuggestionList
            options={dayPlaceOptions}
            value={draft.transportTo ?? ''}
            onSelect={(value) => {
              patch({ transportTo: value });
              setToSuggestOpen(false);
            }}
            active={toSuggestOpen || Boolean((draft.transportTo ?? '').trim())}
          />
        ) : null}
      </div>
      <datalist id={`location-list-${draft.id}`}>
        {dayPlaceOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <label className={styles.label} htmlFor={`dep-date-${draft.id}`}>
        Departure date
      </label>
      <input
        id={`dep-date-${draft.id}`}
        className={styles.input}
        type="date"
        value={draft.dateStart || calendarDate}
        onChange={(e) => patch({ dateStart: e.target.value })}
      />
      <label className={styles.label} htmlFor={`dep-time-${draft.id}`}>
        Departure time
      </label>
      <input
        id={`dep-time-${draft.id}`}
        className={styles.input}
        type="time"
        value={timeValue}
        onChange={(e) => patch({ timeStart: combineDayAndTime(draft.dateStart || calendarDate, e.target.value) })}
      />
      <label className={styles.label} htmlFor={`arr-date-${draft.id}`}>
        Arrival date
      </label>
      <input
        id={`arr-date-${draft.id}`}
        className={styles.input}
        type="date"
        value={draft.arrivalDate ?? draft.dateStart ?? calendarDate}
        onChange={(e) => patch({ arrivalDate: e.target.value })}
      />
      <label className={styles.label} htmlFor={`arr-time-${draft.id}`}>
        Arrival time
      </label>
      <input
        id={`arr-time-${draft.id}`}
        className={styles.input}
        type="time"
        value={arrivalTimeValue}
        onChange={(e) => patch({ arrivalTime: combineDayAndTime(draft.arrivalDate || calendarDate, e.target.value) })}
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
      <label className={styles.label} htmlFor={`airline-${draft.id}`}>
        Airline
      </label>
      <div className={styles.fieldWithSuggestions}>
        <input
          id={`airline-${draft.id}`}
          className={styles.input}
          list={`supplier-list-f-${draft.id}`}
          value={draft.supplier}
          onChange={(e) => patch({ supplier: e.target.value })}
          onFocus={() => touchShell && setSupplierSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setSupplierSuggestOpen(false), 120)}
        />
        {touchShell ? (
          <FieldSuggestionList
            options={usedSuppliers ?? []}
            value={draft.supplier}
            onSelect={(value) => {
              patch({ supplier: value });
              setSupplierSuggestOpen(false);
            }}
            active={supplierSuggestOpen || Boolean(draft.supplier.trim())}
          />
        ) : null}
      </div>
      <datalist id={`supplier-list-f-${draft.id}`}>
        {(usedSuppliers ?? []).map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <label className={styles.label} htmlFor={`bref-f-${draft.id}`}>
        Booking ref
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
      <label className={styles.label} htmlFor={`cab-${draft.id}`}>
        Booking class
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
      <label className={styles.label} htmlFor={`bcc-${draft.id}`}>
        Bag check closes
      </label>
      <input
        id={`bcc-${draft.id}`}
        className={styles.input}
        type="time"
        value={formatTimeHHMM(draft.bagCheckClosesTime ?? '')}
        onChange={(e) => patch({ bagCheckClosesTime: combineDayAndTime(calendarDate, e.target.value) })}
      />
      <label className={styles.label} htmlFor={`addr-f-${draft.id}`}>
        Street address
      </label>
      <input
        id={`addr-f-${draft.id}`}
        className={styles.input}
        value={draft.streetAddress ?? ''}
        onChange={(e) => patch({ streetAddress: e.target.value })}
        placeholder="Terminal or airport address for maps"
      />
      <BookingPaymentFields {...props} amountLabel="Amount" />
      <CancellationPolicyFields {...props} />
    </div>
  );
};

export const AccommodationEditLayout: React.FC<CategoryEditLayoutProps> = (props) => {
  const {
    draft,
    calendarDate,
    dayPlaceOptions,
    bookingMechanismOptions,
    patch,
    nights,
    perNight,
    usedSuppliers,
    touchShell,
    patchDateStart
  } = props;
  const [supplierSuggestOpen, setSupplierSuggestOpen] = React.useState(false);
  const [locationSuggestOpen, setLocationSuggestOpen] = React.useState(false);

  return (
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
      <StatusFields {...props} />
      <label className={styles.label} htmlFor={`loc-${draft.id}`}>
        Location
      </label>
      <div className={styles.fieldWithSuggestions}>
        <input
          id={`loc-${draft.id}`}
          className={styles.input}
          list={`location-list-${draft.id}`}
          value={draft.location ?? ''}
          onChange={(e) => patch({ location: e.target.value })}
          onFocus={() => touchShell && setLocationSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setLocationSuggestOpen(false), 120)}
        />
        {touchShell ? (
          <FieldSuggestionList
            options={dayPlaceOptions}
            value={draft.location ?? ''}
            onSelect={(value) => {
              patch({ location: value });
              setLocationSuggestOpen(false);
            }}
            active={locationSuggestOpen || Boolean((draft.location ?? '').trim())}
          />
        ) : null}
      </div>
      <datalist id={`location-list-${draft.id}`}>
        {dayPlaceOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <label className={styles.label} htmlFor={`title-${draft.id}`}>
        Accommodation name
      </label>
      <input
        id={`title-${draft.id}`}
        className={styles.input}
        value={draft.title}
        onChange={(e) => patch({ title: e.target.value })}
      />
      <label className={styles.label} htmlFor={`sup-a-${draft.id}`}>
        Supplier
      </label>
      <div className={styles.fieldWithSuggestions}>
        <input
          id={`sup-a-${draft.id}`}
          className={styles.input}
          type="text"
          list={`supplier-list-a-${draft.id}`}
          value={draft.supplier}
          onChange={(e) => patch({ supplier: e.target.value })}
          onFocus={() => touchShell && setSupplierSuggestOpen(true)}
          onBlur={() => window.setTimeout(() => setSupplierSuggestOpen(false), 120)}
        />
        {touchShell ? (
          <FieldSuggestionList
            options={usedSuppliers ?? []}
            value={draft.supplier}
            onSelect={(value) => {
              patch({ supplier: value });
              setSupplierSuggestOpen(false);
            }}
            active={supplierSuggestOpen || Boolean(draft.supplier.trim())}
          />
        ) : null}
      </div>
      <datalist id={`supplier-list-a-${draft.id}`}>
        {(usedSuppliers ?? []).map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <label className={styles.label} htmlFor={`checkin-${draft.id}`}>
        Check-in date
      </label>
      <input
        id={`checkin-${draft.id}`}
        className={styles.input}
        type="date"
        value={draft.dateStart ?? ''}
        onChange={(e) => (patchDateStart ? patchDateStart(e.target.value) : patch({ dateStart: e.target.value }))}
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
      <label className={styles.label}>
        Nights
      </label>
      <div className={styles.readOnlyValue}>{nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—'}</div>
      <label className={styles.label} htmlFor={`bref-a-${draft.id}`}>
        Booking ref
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
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={draft.breakfastIncluded === true}
          onChange={(e) => patch({ breakfastIncluded: e.target.checked })}
        />{' '}
        Breakfast included
      </label>
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={draft.parkingIncluded === true}
          onChange={(e) => patch({ parkingIncluded: e.target.checked })}
        />{' '}
        Parking included
      </label>
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
      <label className={styles.label} htmlFor={`pat-${draft.id}`}>
        Planned arrival time (itinerary)
      </label>
      <input
        id={`pat-${draft.id}`}
        className={styles.input}
        type="time"
        value={formatTimeHHMM(draft.plannedArrivalTime ?? '')}
        onChange={(e) => patch({ plannedArrivalTime: combineDayAndTime(calendarDate, e.target.value) })}
      />
      <label className={styles.label} htmlFor={`pdt-${draft.id}`}>
        Planned departure time (itinerary)
      </label>
      <input
        id={`pdt-${draft.id}`}
        className={styles.input}
        type="time"
        value={formatTimeHHMM(draft.plannedDepartureTime ?? '')}
        onChange={(e) => patch({ plannedDepartureTime: combineDayAndTime(calendarDate, e.target.value) })}
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
      <label className={styles.label} htmlFor={`phone-a-${draft.id}`}>
        Phone
      </label>
      <input
        id={`phone-a-${draft.id}`}
        className={styles.input}
        type="tel"
        value={draft.phoneNumber ?? ''}
        onChange={(e) => patch({ phoneNumber: e.target.value })}
      />
      <label className={styles.label} htmlFor={`bm-a-${draft.id}`}>
        Booking mechanism
      </label>
      <input
        id={`bm-a-${draft.id}`}
        className={styles.input}
        list={`booking-mechanism-list-${draft.id}`}
        value={draft.bookingMechanism ?? ''}
        onChange={(e) => patch({ bookingMechanism: e.target.value })}
      />
      <datalist id={`booking-mechanism-list-${draft.id}`}>
        {bookingMechanismOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
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
      <BookingPaymentFields {...props} amountLabel="Total cost" />
      <label className={styles.label}>Per night cost</label>
      <div className={styles.readOnlyValue}>{nights > 0 ? perNight.toFixed(2) : '—'}</div>
      <CancellationPolicyFields {...props} />
    </div>
  );
};

export const LocationInfoEditLayout: React.FC<CategoryEditLayoutProps> = ({ draft, patch }) => {
  const { config } = useConfig();
  const { placeById } = usePlaces();
  const spContext = useSpContext();
  const [researchLoading, setResearchLoading] = React.useState(false);
  const [researchSuccess, setResearchSuccess] = React.useState(false);

  const data = React.useMemo(() => {
    const parsed = parseLocationInfoNotes(draft.notes) ?? defaultLocationInfoNotes('');
    return normalizeLocationInfoNotes(parsed);
  }, [draft.notes]);

  const place = placeById(data.placeId);
  const highlightRowsRef = React.useRef<LocationHighlightRow[]>(locationHighlightRows(data));
  const populated = locationInfoIsPopulated(data);

  highlightRowsRef.current = locationHighlightRows(data);

  const updateNotes = (partial: Partial<LocationInfoNotes>): void => {
    const next = normalizeLocationInfoNotes({ ...data, ...partial });
    patch({ notes: serializeLocationInfoNotes(next), paymentStatus: 'Free', amount: 0 });
  };

  const openSettings = (): void => {
    window.dispatchEvent(new Event('travelhub-open-settings'));
  };

  React.useEffect(() => {
    return subscribeLocationInfoAIStatus(draft.id, (detail) => {
      if (detail.section === 'qa') return;
      if (detail.section && detail.section !== 'all') return;
      setResearchLoading(detail.loading);
      if (detail.success) {
        setResearchSuccess(true);
        window.setTimeout(() => setResearchSuccess(false), 3000);
      }
    });
  }, [draft.id]);

  const runResearchAll = (): void => {
    if (!place || !(config.geminiApiKey || '').trim()) return;
    scheduleLocationInfoAIGeneration({
      spContext,
      entry: draft,
      place,
      apiKey: config.geminiApiKey,
      additiveOnly: populated
    });
  };

  const handleHighlightChange = (rows: LocationHighlightRow[]): void => {
    const prev = highlightRowsRef.current;
    const suppressed = recordSuppressedHighlightLabels(data, prev, rows);
    const marked = markHighlightRowsUserEdited(rows);
    highlightRowsRef.current = marked;
    updateNotes({
      ...splitHighlightRows(marked),
      suppressedHighlightKeys: suppressed
    });
  };

  return (
    <div className={styles.grid}>
      <RichTextField
        id={`loc-overview-${draft.id}`}
        label="Overview — what to see and do"
        fullRow
        labelClassName={`${styles.label} ${styles.fullRow}`}
        minHeight="6rem"
        value={data.overview}
        onChange={(html) => updateNotes({ overview: html, userEditedOverview: true })}
      />
      <label className={`${styles.label} ${styles.fullRow}`}>
        Highlights (sights, food, drink, souvenirs)
      </label>
      <div className={styles.fullRow}>
        <div className={styles.locationInfoResearchRow}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={researchLoading || !(config.geminiApiKey || '').trim() || !place}
            onClick={runResearchAll}
          >
            {researchLoading ? 'Researching…' : 'Research with AI'}
          </button>
          {researchSuccess ? <span className={styles.aiSuccessHint}>Updated from AI</span> : null}
          {data.aiError?.trim() ? <span className={styles.aiErrorHint}>{data.aiError.trim()}</span> : null}
        </div>
        <LocationInfoHighlights
          rows={locationHighlightRows(data)}
          emptyHint={data.aiSightsPlaceholder}
          entry={draft}
          place={place}
          geminiApiKey={config.geminiApiKey}
          hasAnyContent={populated}
          onOpenSettings={openSettings}
          onChange={handleHighlightChange}
        />
        <p className={styles.locationInfoMergeHint}>
          AI only adds new suggestions. Your edits, checkmarks, and deleted items are kept.
        </p>
      </div>
      <label className={`${styles.label} ${styles.fullRow}`} htmlFor={`loc-tips-${draft.id}`}>
        Practical tips
      </label>
      <textarea
        id={`loc-tips-${draft.id}`}
        className={`${styles.textarea} ${styles.fullRow}`}
        rows={3}
        value={data.practicalTips}
        onChange={(e) => updateNotes({ practicalTips: e.target.value, userEditedPracticalTips: true })}
        placeholder="Transport, timing, etiquette, money — filled by AI on first generate if left empty"
      />
      <div className={styles.fullRow}>
        <LocationInfoAskPanel
          entry={draft}
          place={place}
          data={data}
          geminiApiKey={config.geminiApiKey}
          onOpenSettings={openSettings}
          onThreadChange={(thread) => updateNotes({ aiQaThread: thread })}
        />
      </div>
    </div>
  );
};
