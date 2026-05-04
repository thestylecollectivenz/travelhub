import * as React from 'react';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { useSpContext } from '../../context/SpContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { ReminderService } from '../../services/ReminderService';
import type { EntryDocumentType, EntryLinkType } from '../../models';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug } from '../../utils/categoryUtils';
import { formatCurrency } from '../../utils/financialUtils';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { SubItemList } from './SubItemList';
import { openDocumentUrl } from '../../utils/openDocumentUrl';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { effectivePlannerTimeStart, isTransportReturnOnCalendarDate } from '../../utils/itineraryDayEntries';
import { googleMapsDirectionsUrl } from '../../utils/googleMapsLink';
import styles from './ItineraryCardView.module.css';

export interface ItineraryCardViewProps {
  entry: ItineraryEntry;
  calendarDate: string;
  /** When true (e.g. pre-trip day), hide multi-day accommodation / cruise continuation labels. */
  suppressCarryoverUi?: boolean;
  hasTask?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function emptySubItem(): ItinerarySubItem {
  return {
    id: `sub-${Date.now()}`,
    title: '',
    decisionStatus: 'Idea',
    paymentStatus: 'Not paid',
    bookingRequired: false,
    amount: 0,
    currency: 'NZD'
  };
}

function ClockIcon(): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon(): React.ReactElement {
  return (
    <svg className={styles.pin} width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function LinkIcon(): React.ReactElement {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 10l4-4M5 5h2M9 11h2M3.5 8a2.5 2.5 0 0 1 2.5-2.5M12.5 8A2.5 2.5 0 0 1 10 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DocumentTypeIcon({ type }: { type: EntryDocumentType }): React.ReactElement {
  if (type === 'PDF') {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.2" />
        <text x="5" y="11.5" fontSize="4" fill="currentColor">PDF</text>
      </svg>
    );
  }
  if (type === 'Image') {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="6" cy="6" r="1.1" fill="currentColor" />
        <path d="M3.8 11l2.4-2.4 2.2 1.8 2.1-2.3L12.2 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'Ticket') {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 5.2h12v2a1.4 1.4 0 0 0 0 2.8v2H2v-2a1.4 1.4 0 1 0 0-2.8v-2Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5.2v6.8" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.2 1.2" />
      </svg>
    );
  }
  if (type === 'Confirmation') {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 5.2l5.5 3.8 5.5-3.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M6.3 10.6l1.1 1.1 2.3-2.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 1.5h5l3 3V14.5H4V1.5Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 1.5V5h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function formatYmdRange(start?: string, end?: string): string {
  if (!start || !end) return '';
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  return `${s.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} → ${e.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`;
}

function formatYmd(date?: string): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ItineraryCardView: React.FC<ItineraryCardViewProps> = ({
  entry,
  calendarDate,
  suppressCarryoverUi = false,
  hasTask = false,
  onEdit,
  onDuplicate,
  onDelete
}) => {
  const spContext = useSpContext();
  const { addSubItem, convertToHomeCurrency, setSelectedDayId } = useTripWorkspace();
  const { config } = useConfig();
  const { docsForEntry, linksForEntry, addDocument, updateDocument, deleteDocument, addLink, updateLink, deleteLink } = useAttachments();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(Boolean(entry.notes && entry.notes.trim()));
  const [attachmentsOpen, setAttachmentsOpen] = React.useState(false);
  const [subItemsOpen, setSubItemsOpen] = React.useState(true);
  const [addingSubItem, setAddingSubItem] = React.useState(false);
  const [newSub, setNewSub] = React.useState<ItinerarySubItem>(emptySubItem);
  const [docType, setDocType] = React.useState<EntryDocumentType>('Other');
  const [docNotes, setDocNotes] = React.useState('');
  const [docBusy, setDocBusy] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkBusy, setLinkBusy] = React.useState(false);
  const [editingDocId, setEditingDocId] = React.useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [docDraft, setDocDraft] = React.useState<{ title: string; documentType: EntryDocumentType; notes: string }>({
    title: '',
    documentType: 'Other',
    notes: ''
  });
  const [linkDraft, setLinkDraft] = React.useState<{
    linkTitle: string;
    url: string;
    linkType: EntryLinkType;
    notes: string;
  }>({
    linkTitle: '',
    url: '',
    linkType: 'Url',
    notes: ''
  });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [taskPromptOpen, setTaskPromptOpen] = React.useState(false);
  const [taskDueDate, setTaskDueDate] = React.useState('');

  React.useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onDoc = (ev: MouseEvent): void => {
      const el = menuRef.current;
      if (el && !el.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  React.useEffect(() => {
    setNotesOpen(Boolean(entry.notes && entry.notes.trim()));
  }, [entry.notes]);

  const displayAmountHome = convertToHomeCurrency(entry.amount, entry.currency || 'NZD');
  const paidCurrency = (entry.paymentCurrency || config.homeCurrency || 'NZD').toUpperCase();
  const displayAmountPaidHome = entry.amountPaid !== undefined
    ? (paidCurrency === (config.homeCurrency || 'NZD').toUpperCase()
      ? entry.amountPaid
      : convertToHomeCurrency(entry.amountPaid, paidCurrency))
    : undefined;
  const hhmm = formatTimeHHMM(effectivePlannerTimeStart(entry, calendarDate));
  // Guard: if duration is a bare number (legacy Number column value) hide it
  const durationDisplay = (() => {
    const d = entry.duration?.trim() ?? '';
    if (!d) return '';
    // If it's purely numeric (old Number column artifact) suppress it
    if (/^\d+(\.\d+)?$/.test(d)) return '';
    return d;
  })();

  const timeChip =
    hhmm !== ''
      ? `${hhmm}${durationDisplay ? ` · ${durationDisplay}` : ''}`
      : durationDisplay || null;

  const supplier = entry.supplier.trim();
  const location = (entry.location ?? '').trim();
  const isAccommodation = entry.category === 'Accommodation' && !!entry.dateStart && !!entry.dateEnd;
  const isCruise = entry.category === 'Cruise' && !!entry.embarksDate && !!entry.disembarksDate;
  const isFlights = entry.category === 'Flights';
  const isTransport = entry.category === 'Transport';
  const isActivities = entry.category === 'Activities';
  const transportReturnHere = isTransport && isTransportReturnOnCalendarDate(entry, calendarDate);
  const mapsUrl = googleMapsDirectionsUrl(entry.streetAddress || '');
  const cabinLabel =
    entry.cabinClass === 'business'
      ? 'Business'
      : entry.cabinClass === 'premium_economy'
        ? 'Premium Economy'
        : entry.cabinClass === 'economy'
          ? 'Economy'
          : '';
  const nights = React.useMemo(() => {
    if (!isAccommodation) return 0;
    const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
    const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
  }, [isAccommodation, entry.dateStart, entry.dateEnd]);
  const perNightHome = nights > 0 ? displayAmountHome / nights : 0;
  const isContinuation = React.useMemo(() => {
    if (suppressCarryoverUi) return false;
    if (!isAccommodation || !entry.dateStart || !entry.dateEnd) return false;
    const thisDay = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
    const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
    if (Number.isNaN(thisDay.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    const inRange = thisDay.getTime() >= start.getTime() && thisDay.getTime() < end.getTime();
    return inRange && calendarDate !== entry.dateStart;
  }, [calendarDate, entry.dateEnd, entry.dateStart, isAccommodation, suppressCarryoverUi]);
  const nightNumber = React.useMemo(() => {
    if (!isContinuation || !entry.dateStart) return 0;
    const thisDay = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
    return Math.floor((thisDay.getTime() - start.getTime()) / 86400000) + 1;
  }, [calendarDate, entry.dateStart, isContinuation]);
  const isCruiseContinuation = React.useMemo(() => {
    if (suppressCarryoverUi) return false;
    if (!isCruise || !entry.embarksDate || !entry.disembarksDate) return false;
    const thisDay = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
    if (Number.isNaN(thisDay.getTime()) || Number.isNaN(start.getTime())) return false;
    return thisDay.getTime() > start.getTime();
  }, [calendarDate, entry.disembarksDate, entry.embarksDate, isCruise, suppressCarryoverUi]);
  const cruiseDayNumber = React.useMemo(() => {
    if (!isCruise || !entry.embarksDate || !entry.disembarksDate) return 0;
    const thisDay = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
    return Math.floor((thisDay.getTime() - start.getTime()) / 86400000) + 1;
  }, [calendarDate, entry.disembarksDate, entry.embarksDate, isCruise]);
  const cruiseTotalDays = React.useMemo(() => {
    if (!isCruise || !entry.embarksDate || !entry.disembarksDate) return 0;
    const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
    const end = new Date(`${entry.disembarksDate}T00:00:00.000Z`);
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  }, [entry.disembarksDate, entry.embarksDate, isCruise]);
  const perCruiseDayHome = cruiseTotalDays > 0 ? displayAmountHome / cruiseTotalDays : 0;
  const perCruiseDayTrip = cruiseTotalDays > 0 ? entry.amount / cruiseTotalDays : 0;
  const showCruiseDailyAmount = isCruise && entry.amount > 0 && cruiseTotalDays > 0;

  let unitSuffix = '';
  if (!isAccommodation && entry.unitType && typeof entry.unitAmount === 'number' && !Number.isNaN(entry.unitAmount)) {
    const unitAmountHome = convertToHomeCurrency(entry.unitAmount, entry.currency || 'NZD');
    const amt = formatCurrency(unitAmountHome, config.homeCurrency);
    if (entry.unitType === 'PerPerson') {
      unitSuffix = ` · ${amt} pp`;
    } else if (entry.unitType === 'PerNight') {
      unitSuffix = ` · ${amt} /night`;
    } else if (entry.unitType === 'PerDay') {
      unitSuffix = ` · ${amt} /day`;
    }
  }

  const decisionClass =
    entry.decisionStatus === 'Idea'
      ? styles.decisionIdea
      : entry.decisionStatus === 'Planned'
        ? styles.decisionPlanned
        : styles.decisionConfirmed;

  const paymentClass =
    entry.paymentStatus === 'Free'
      ? styles.paymentFree
      : entry.paymentStatus === 'Fully paid'
      ? styles.paymentPaid
      : entry.paymentStatus === 'Part paid'
        ? styles.paymentPart
        : styles.paymentUnpaid;
  const categorySlug = getCategorySlug(entry.category);
  const subItems = entry.subItems ?? [];
  const hasSubItems = subItems.length > 0;
  const subPaid = subItems.reduce((sum, s) => {
    if (s.paymentStatus === 'Fully paid') {
      return sum + convertToHomeCurrency(s.amount, s.currency || 'NZD');
    }
    if (s.paymentStatus === 'Part paid') {
      const paid = s.amountPaid ?? 0;
      return sum + convertToHomeCurrency(paid, s.currency || 'NZD');
    }
    return sum;
  }, 0);
  const subTotal = subItems.reduce((sum, s) => sum + convertToHomeCurrency(s.amount, s.currency || 'NZD'), 0);
  const subOwing = subTotal - subPaid;
  const hasSubTotal = subTotal > 0;
  const showSubItemContent = hasSubItems || addingSubItem;
  const docs = docsForEntry(entry.id);
  const links = linksForEntry(entry.id);

  const handleStartAddSubItem = React.useCallback(() => {
    setSubItemsOpen(true);
    setAddingSubItem(true);
    setNewSub(emptySubItem());
  }, []);

  const handleSaveNewSubItem = React.useCallback(() => {
    const title = newSub.title.trim();
    if (!title) {
      return;
    }
    addSubItem(entry.id, {
      ...newSub,
      title
    });
    setNewSub(emptySubItem());
    setAddingSubItem(false);
    setSubItemsOpen(true);
  }, [addSubItem, entry.id, newSub]);

  const handleDocumentPick = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const inputEl = ev.currentTarget;
      const file = ev.target.files?.[0];
      if (!file) return;
      setDocBusy(true);
      try {
        await addDocument({
          file,
          dayId: entry.dayId,
          entryId: entry.id,
          documentType: docType,
          notes: docNotes.trim()
        });
        setDocNotes('');
      } finally {
        setDocBusy(false);
        inputEl.value = '';
      }
    },
    [addDocument, docNotes, docType, entry.dayId, entry.id]
  );

  const resetLinkDraft = React.useCallback(() => {
    setLinkDraft({ linkTitle: '', url: '', linkType: 'Url', notes: '' });
  }, []);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {timeChip ? (
            <span className={styles.timeChip}>
              <ClockIcon />
              {timeChip}
            </span>
          ) : null}
          <span className={`${styles.categoryBadge} th-cat-${categorySlug} th-cat-badge`}>
            <CategoryIcon category={entry.category} size={12} color="currentColor" />
            {entry.category}
          </span>
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Entry actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className={styles.dropdown} role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setSelectedDayId(entry.dayId);
                  requestSidebarDayFocus(entry.dayId);
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <h3 className={styles.title}>
        {transportReturnHere ? <span className={styles.returnPill}>Return</span> : null}
        {entry.title || 'Untitled'}
      </h3>
      {entry.category === 'Accommodation' && (entry.checkInTime || entry.bookingReference?.trim()) ? (
        <div className={styles.categorySummary}>
          {entry.checkInTime ? <span>Check-in {formatTimeHHMM(entry.checkInTime)}</span> : null}
          {entry.checkInTime && entry.bookingReference?.trim() ? <span aria-hidden> · </span> : null}
          {entry.bookingReference?.trim() ? <span>Ref {entry.bookingReference.trim()}</span> : null}
        </div>
      ) : null}
      {isFlights && (entry.flightNumbers?.trim() || cabinLabel) ? (
        <div className={styles.categorySummary}>
          {entry.flightNumbers?.trim() ? <span>{entry.flightNumbers.trim()}</span> : null}
          {entry.flightNumbers?.trim() && cabinLabel ? <span aria-hidden> · </span> : null}
          {cabinLabel ? <span>{cabinLabel}</span> : null}
        </div>
      ) : null}
      {isTransport && entry.journeyType === 'return' ? (
        <div className={styles.categorySummary}>Return journey</div>
      ) : null}
      {isActivities && entry.bookingReference?.trim() ? (
        <div className={styles.categorySummary}>Ref {entry.bookingReference.trim()}</div>
      ) : null}
      {isContinuation ? <div className={styles.continuationLabel}>Continuing stay — Night {nightNumber} of {nights}</div> : null}
      {isCruise && isCruiseContinuation ? <div className={styles.continuationLabel}>Day {cruiseDayNumber} of cruise</div> : null}
      {isAccommodation ? (
        <div className={styles.metaRow}>
          <span>{formatYmdRange(entry.dateStart, entry.dateEnd)}</span>
          <span aria-hidden> · </span>
          <span>{nights} night{nights === 1 ? '' : 's'}</span>
        </div>
      ) : null}
      {(entry.category === 'Flights' && (entry.arrivalTime || entry.arrivalDate)) ? (
        <div className={styles.metaRow}>
          <span>Arrives {entry.arrivalDate ? formatYmd(entry.arrivalDate) : ''}{entry.arrivalDate && entry.arrivalTime ? ' · ' : ''}{entry.arrivalTime ? formatTimeHHMM(entry.arrivalTime) : ''}</span>
        </div>
      ) : null}
      {isCruise ? (
        <div className={styles.metaRow}>
          <span>Embark {formatYmd(entry.embarksDate)}</span>
          <span aria-hidden> · </span>
          <span>Disembark {formatYmd(entry.disembarksDate)}</span>
          <span aria-hidden> · </span>
          <span>{cruiseTotalDays} day{cruiseTotalDays === 1 ? '' : 's'}</span>
        </div>
      ) : null}

      {supplier || location ? (
        <div className={styles.metaRow}>
          {supplier ? <span>{supplier}</span> : null}
          {supplier && location ? <span aria-hidden> · </span> : null}
          {location ? (
            <span>
              <PinIcon />
              {location}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.badges}>
        <span className={`${styles.statusPill} ${styles.decisionPill} ${decisionClass}`}>{entry.decisionStatus}</span>
        <span className={`${styles.statusPill} ${styles.paymentPill} ${paymentClass}`}>{entry.paymentStatus}</span>
        {entry.bookingRequired ? (
          <span className={`${styles.statusPill} ${styles.bookingPill} ${styles.booking}`}>
            {entry.bookingStatus}
          </span>
        ) : null}
        {hasTask ? <span className={`${styles.statusPill} ${styles.taskPill}`}>Task added</span> : null}
      </div>

      <div className={styles.amountRow}>
        {isAccommodation && nights > 0
          ? `${formatCurrency(displayAmountHome, config.homeCurrency)} total · ${formatCurrency(perNightHome, config.homeCurrency)} /night`
          : showCruiseDailyAmount
            ? `${formatCurrency(displayAmountHome, config.homeCurrency)} total · ${formatCurrency(perCruiseDayHome, config.homeCurrency)} /day`
            : formatCurrency(displayAmountHome, config.homeCurrency)}
        {entry.currency && entry.currency.toUpperCase() !== config.homeCurrency.toUpperCase() ? (
          <span className={styles.unitSuffix}>
            {isAccommodation && nights > 0
              ? ` (${entry.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.currency} · ${(entry.amount / nights).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.currency} /night)`
              : showCruiseDailyAmount
                ? ` (${entry.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.currency} · ${perCruiseDayTrip.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.currency} /day)`
                : ` (${entry.amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${entry.currency})`}
          </span>
        ) : null}
        {unitSuffix ? <span className={styles.unitSuffix}>{unitSuffix}</span> : null}
      </div>
      {entry.paymentStatus === 'Part paid' && entry.amountPaid !== undefined && displayAmountPaidHome !== undefined ? (
        <div className={styles.partPaidDetail}>
          <span className={styles.partPaidPaid}>{formatCurrency(displayAmountPaidHome, config.homeCurrency)} paid</span>
          <span className={styles.partPaidSep}> · </span>
          <span className={styles.partPaidOwing}>{formatCurrency(displayAmountHome - displayAmountPaidHome, config.homeCurrency)} owing</span>
        </div>
      ) : null}
      {hasSubTotal ? (
        <div className={styles.subTotalLine}>
          <span className={styles.subTotalLabel}>incl. options</span>
          <span className={styles.subTotalAmount}>{formatCurrency(displayAmountHome + subTotal, config.homeCurrency)}</span>
          {subPaid > 0 || subOwing > 0 ? (
            <span className={styles.subTotalSplit}>
              <span className={styles.subPaid}>{formatCurrency(subPaid, config.homeCurrency)} paid</span>
              {subOwing > 0 ? <span className={styles.subOwing}> · {formatCurrency(subOwing, config.homeCurrency)} owing</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}

      {isAccommodation && (entry.roomType?.trim() || entry.checkOutTime || entry.streetAddress?.trim()) ? (
        <div className={styles.detailBlock}>
          {entry.roomType?.trim() ? <div>Room: {entry.roomType.trim()}</div> : null}
          {entry.checkOutTime ? <div>Check-out {formatTimeHHMM(entry.checkOutTime)}</div> : null}
          {entry.streetAddress?.trim() ? <div>{entry.streetAddress.trim()}</div> : null}
          {mapsUrl ? (
            <a className={styles.mapsLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
      {isFlights && (entry.bookingReference?.trim() || entry.checkInClosesTime) ? (
        <div className={styles.detailBlock}>
          {entry.bookingReference?.trim() ? <div>PNR / ref {entry.bookingReference.trim()}</div> : null}
          {entry.checkInClosesTime ? <div>Check-in closes {formatTimeHHMM(entry.checkInClosesTime)}</div> : null}
        </div>
      ) : null}
      {isActivities && (entry.streetAddress?.trim() || mapsUrl) ? (
        <div className={styles.detailBlock}>
          {entry.streetAddress?.trim() ? <div>{entry.streetAddress.trim()}</div> : null}
          {mapsUrl ? (
            <a className={styles.mapsLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
      {isTransport && entry.journeyType === 'return' && (entry.returnDate || entry.returnTime) ? (
        <div className={styles.detailBlock}>
          {entry.returnDate ? <div>Return date {formatYmd(entry.returnDate)}</div> : null}
          {entry.returnTime ? <div>Return dep. {formatTimeHHMM(entry.returnTime)}</div> : null}
        </div>
      ) : null}

      {entry.notes.trim() ? (
        <>
          <button type="button" className={styles.notesToggle} onClick={() => setNotesOpen((o) => !o)}>
            {notesOpen ? 'Notes ▴' : 'Notes ▾'}
          </button>
          {notesOpen ? <div className={styles.notesBody}>{entry.notes}</div> : null}
        </>
      ) : null}

      <button type="button" className={styles.relatedToggle} onClick={() => setAttachmentsOpen((o) => !o)}>
        {attachmentsOpen
          ? 'Hide attachments ▴'
          : `${docs.length} document${docs.length === 1 ? '' : 's'} · ${links.length} link${links.length === 1 ? '' : 's'} ▾`}
      </button>
      {attachmentsOpen ? (
        <div className={styles.attachmentsPanel}>
          <div className={styles.attachmentsSummary}>
            {docs.length} document{docs.length === 1 ? '' : 's'} · {links.length} link{links.length === 1 ? '' : 's'}
          </div>
          <div className={styles.attachmentsActions}>
            <select className={styles.newSubField} value={docType} onChange={(e) => setDocType(e.target.value as EntryDocumentType)}>
              <option value="Ticket">Ticket</option>
              <option value="Confirmation">Confirmation</option>
              <option value="Image">Image</option>
              <option value="PDF">PDF</option>
              <option value="Other">Other</option>
            </select>
            <input
              className={styles.newSubField}
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
              placeholder="Document notes (optional)"
            />
            <button type="button" className={styles.newSubActionBtn} disabled={docBusy} onClick={() => fileInputRef.current?.click()}>
              {docBusy ? 'Uploading…' : 'Add document'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleDocumentPick(e).catch(console.error);
              }}
            />
            <button
              type="button"
              className={styles.newSubActionBtn}
              onClick={() =>
                setLinkOpen((v) => {
                  const next = !v;
                  if (next) resetLinkDraft();
                  return next;
                })
              }
            >
              {linkOpen ? 'Close link form' : 'Add link'}
            </button>
          </div>
          {linkOpen ? (
            <div className={styles.newSubItemForm}>
              <input
                className={styles.newSubField}
                placeholder="Title"
                value={linkDraft.linkTitle}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkTitle: e.target.value }))}
              />
              <input
                className={styles.newSubField}
                placeholder="URL"
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))}
              />
              <div className={styles.newSubRow}>
                <select
                  className={styles.newSubField}
                  value={linkDraft.linkType}
                  onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkType: e.target.value as EntryLinkType }))}
                >
                  <option value="Url">Url</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Booking">Booking</option>
                  <option value="Email">Email</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  className={styles.newSubField}
                  placeholder="Notes (optional)"
                  value={linkDraft.notes}
                  onChange={(e) => setLinkDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className={styles.newSubActions}>
                <button
                  type="button"
                  className={styles.newSubActionBtn}
                  disabled={linkBusy || linkDraft.linkTitle.trim() === '' || linkDraft.url.trim() === ''}
                  onClick={() => {
                    setLinkBusy(true);
                    addLink({
                      dayId: entry.dayId,
                      entryId: entry.id,
                      linkTitle: linkDraft.linkTitle.trim(),
                      url: linkDraft.url.trim(),
                      linkType: linkDraft.linkType,
                      notes: linkDraft.notes.trim()
                    })
                      .then(() => {
                        resetLinkDraft();
                        setLinkOpen(false);
                        setLinkBusy(false);
                      })
                      .catch((err) => {
                        setLinkBusy(false);
                        // eslint-disable-next-line no-console
                        console.error(err);
                      });
                  }}
                >
                  {linkBusy ? 'Saving…' : 'Save link'}
                </button>
              </div>
            </div>
          ) : null}
          <div className={styles.attachmentsList}>
            {docs.map((doc) => (
              <div key={doc.id} className={styles.attachmentRow}>
                <span className={styles.attachmentIcon}><DocumentTypeIcon type={doc.documentType} /></span>
                {editingDocId === doc.id ? (
                  <>
                    <input className={styles.newSubField} value={docDraft.title} onChange={(e) => setDocDraft((prev) => ({ ...prev, title: e.target.value }))} />
                    <select className={styles.newSubField} value={docDraft.documentType} onChange={(e) => setDocDraft((prev) => ({ ...prev, documentType: e.target.value as EntryDocumentType }))}>
                      <option value="Ticket">Ticket</option>
                      <option value="Confirmation">Confirmation</option>
                      <option value="Image">Image</option>
                      <option value="PDF">PDF</option>
                      <option value="Other">Other</option>
                    </select>
                    <input className={styles.newSubField} value={docDraft.notes} onChange={(e) => setDocDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" />
                    <button
                      type="button"
                      className={styles.newSubActionBtn}
                      onClick={() => {
                        updateDocument(doc.id, {
                          title: docDraft.title.trim(),
                          documentType: docDraft.documentType,
                          notes: docDraft.notes.trim()
                        })
                          .then(() => setEditingDocId(null))
                          .catch(console.error);
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className={styles.newSubActionBtn} onClick={() => setEditingDocId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.attachmentTitle}
                      onClick={(ev) => {
                        ev.preventDefault();
                        openDocumentUrl(doc.fileUrl);
                      }}
                    >
                      {doc.fileName || doc.title}
                    </button>
                    <span className={styles.attachmentType}>{doc.documentType}</span>
                    <button
                      type="button"
                      className={styles.newSubActionBtn}
                      onClick={() => {
                        setEditingDocId(doc.id);
                        setDocDraft({ title: doc.title || doc.fileName || '', documentType: doc.documentType, notes: doc.notes || '' });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className={styles.newSubActionBtn} onClick={() => deleteDocument(doc.id).catch(console.error)}>
                      Delete
                    </button>
                    {doc.notes?.trim() ? <span className={styles.attachmentType}>{doc.notes}</span> : null}
                  </>
                )}
              </div>
            ))}
            {links.map((link) => (
              <div key={link.id} className={styles.attachmentRow}>
                <span className={styles.attachmentIcon}><LinkIcon /></span>
                {editingLinkId === link.id ? (
                  <>
                    <input className={styles.newSubField} value={linkDraft.linkTitle} onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkTitle: e.target.value }))} />
                    <input className={styles.newSubField} value={linkDraft.url} onChange={(e) => setLinkDraft((prev) => ({ ...prev, url: e.target.value }))} />
                    <select className={styles.newSubField} value={linkDraft.linkType} onChange={(e) => setLinkDraft((prev) => ({ ...prev, linkType: e.target.value as EntryLinkType }))}>
                      <option value="Url">Url</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Booking">Booking</option>
                      <option value="Email">Email</option>
                      <option value="Other">Other</option>
                    </select>
                    <input className={styles.newSubField} value={linkDraft.notes} onChange={(e) => setLinkDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" />
                    <button
                      type="button"
                      className={styles.newSubActionBtn}
                      onClick={() => {
                        updateLink(link.id, {
                          title: linkDraft.linkTitle.trim(),
                          linkTitle: linkDraft.linkTitle.trim(),
                          url: linkDraft.url.trim(),
                          linkType: linkDraft.linkType,
                          notes: linkDraft.notes.trim()
                        })
                          .then(() => setEditingLinkId(null))
                          .catch(console.error);
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className={styles.newSubActionBtn} onClick={() => setEditingLinkId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.attachmentTitle}
                      onClick={(ev) => {
                        ev.preventDefault();
                        openDocumentUrl(link.url);
                      }}
                    >
                      {link.linkTitle}
                    </button>
                    <span className={styles.attachmentType}>{link.linkType}</span>
                    <button
                      type="button"
                      className={styles.newSubActionBtn}
                      onClick={() => {
                        setEditingLinkId(link.id);
                        setLinkDraft({
                          linkTitle: link.linkTitle,
                          url: link.url,
                          linkType: link.linkType,
                          notes: link.notes || ''
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className={styles.newSubActionBtn} onClick={() => deleteLink(link.id).catch(console.error)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.subItemActionsRow}>
        <button
          type="button"
          className={styles.addSubItemBtn}
          onClick={() => setTaskPromptOpen((v) => !v)}
        >
          {hasTask ? 'Task linked' : '+ Add to tasks'}
        </button>
        <button type="button" className={styles.addSubItemBtn} onClick={handleStartAddSubItem}>
          + Add option
        </button>
        {hasSubItems ? (
          <button type="button" className={styles.relatedToggle} onClick={() => setSubItemsOpen((o) => !o)}>
            {subItemsOpen ? `Hide related items ▴` : `Show ${subItems.length} related items ▾`}
          </button>
        ) : null}
      </div>
      {taskPromptOpen ? (
        <div className={styles.newSubItemForm}>
          <div className={styles.newSubRow}>
            <input className={styles.newSubField} type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
            <button
              type="button"
              className={styles.newSubActionBtn}
              onClick={() => {
                const svc = new ReminderService(spContext);
                svc.create({
                  title: `Task: ${entry.title || 'Itinerary item'}`,
                  tripId: entry.tripId,
                  dayId: entry.dayId,
                  entryId: entry.id,
                  reminderType: 'Manual',
                  reminderText: `Follow up: ${entry.title || 'Itinerary item'}`,
                  dueDate: taskDueDate ? `${taskDueDate}T00:00:00.000Z` : undefined,
                  isComplete: false
                }).then(() => {
                  window.dispatchEvent(new CustomEvent('trip-reminders-updated'));
                  setTaskPromptOpen(false);
                  setTaskDueDate('');
                }).catch(console.error);
              }}
            >
              Save task
            </button>
          </div>
        </div>
      ) : null}

      {showSubItemContent ? (
        <div className={`${styles.relatedContent} ${subItemsOpen || addingSubItem ? styles.relatedContentOpen : ''}`}>
          <SubItemList subItems={subItems} entryId={entry.id} />
          {addingSubItem ? (
            <div className={styles.newSubItemForm}>
              <input
                className={styles.newSubField}
                type="text"
                placeholder="Option title"
                value={newSub.title}
                onChange={(e) => setNewSub((prev) => ({ ...prev, title: e.target.value }))}
              />
              <div className={styles.newSubRow}>
                <select
                  className={styles.newSubField}
                  value={newSub.decisionStatus}
                  onChange={(e) =>
                    setNewSub((prev) => ({ ...prev, decisionStatus: e.target.value as ItinerarySubItem['decisionStatus'] }))
                  }
                >
                  <option value="Idea">Idea</option>
                  <option value="Planned">Planned</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
                <select
                  className={styles.newSubField}
                  value={newSub.paymentStatus}
                  onChange={(e) => {
                    const value = e.target.value as ItinerarySubItem['paymentStatus'];
                    setNewSub((prev) => ({
                      ...prev,
                      paymentStatus: value,
                      amount: value === 'Free' ? 0 : prev.amount
                    }));
                  }}
                >
                  <option value="Not paid">Not paid</option>
                  <option value="Part paid">Part paid</option>
                  <option value="Fully paid">Fully paid</option>
                  <option value="Free">Free</option>
                </select>
                {newSub.paymentStatus !== 'Free' ? (
                  <input
                    className={styles.newSubField}
                    type="number"
                    min={0}
                    placeholder="Amount"
                    value={newSub.amount}
                    onChange={(e) => setNewSub((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                  />
                ) : null}
              </div>
              <div className={styles.newSubActions}>
                <button type="button" className={styles.newSubActionBtn} onClick={handleSaveNewSubItem}>
                  Add
                </button>
                <button
                  type="button"
                  className={styles.newSubActionBtn}
                  onClick={() => {
                    setAddingSubItem(false);
                    setNewSub(emptySubItem());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
