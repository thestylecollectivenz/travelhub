import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry, ItinerarySubItem } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { useSpContext } from '../../context/SpContext';
import { useAttachments } from '../../context/AttachmentsContext';
import { ReminderService } from '../../services/ReminderService';
import type { EntryDocumentType, EntryLinkType } from '../../models';
import { CategoryIcon } from '../shared/CategoryIcon';
import { getCategorySlug, CATEGORY_LIST } from '../../utils/categoryUtils';
import { formatCurrency } from '../../utils/financialUtils';
import { useCanSeeFinancials } from '../../hooks/useCanSeeFinancials';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { SubItemList } from './SubItemList';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { requestViewTask, scrollToReminderRow } from '../../utils/viewTaskFocus';
import { loadTripAssignees, rememberTripAssignee } from '../../utils/tripAssignees';
import { usePlanView } from '../../context/PlanViewContext';
import { paymentDueActionLabel } from '../../utils/paymentDueLabels';
import { EntryFilesLinksPanel } from './EntryFilesLinksPanel';
import { sortEntryDocuments } from '../../utils/entryDocumentSort';
import { sortEntryLinks } from '../../utils/entryLinkSort';
import { RichTextContent } from '../shared/RichTextContent';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import type { LinkedEntryTask } from '../../utils/linkedEntryTask';
import { linkedTaskDisplayText, linkedTaskNoteDisplay } from '../../utils/linkedEntryTask';
import {
  effectivePlannerTimeStart,
  effectiveTransportLegTime,
  isTransportReturnOnCalendarDate,
  transportLegDurationLabel,
  formatEntryScheduleHero,
  isAccommodationCheckoutOnCalendarDate,
  isAccommodationNightOnCalendarDate
} from '../../utils/itineraryDayEntries';
import type { TransportTimelineLeg } from '../../utils/itineraryDayEntries';
import { formatActivityScheduleLabel } from '../../utils/activityScheduleLabel';
import {
  isLocationInfoEntry,
  locationInfoIsPopulated,
  markHighlightRowsUserEdited,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  recordSuppressedHighlightLabels,
  serializeLocationInfoNotes,
  type LocationHighlightRow
} from '../../utils/locationInfoEntry';
import { LocationInfoAskPanel } from './LocationInfoAskPanel';
import { LocationInfoHighlights } from './LocationInfoHighlights';
import { formatLocationText, placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { usePlaces } from '../../context/PlacesContext';
import {
  locationHighlightRows,
  splitHighlightRows
} from '../../utils/locationInfoEntry';

function deriveTransportDisplayTitle(entry: ItineraryEntry, calendarDate: string): string {
  const raw = (entry.title || '').trim();
  const isReturnHere = isTransportReturnOnCalendarDate(entry, calendarDate);
  if (raw) {
    return raw;
  }
  let from = (entry.transportFrom || '').trim();
  let to = (entry.transportTo || '').trim();
  if (entry.journeyType === 'return' && isReturnHere) {
    const swap = from;
    from = to;
    to = swap;
  }
  const mode = (entry.transportMode || '').trim();
  const arrow = from || to ? `${from} → ${to}` : '';
  return (arrow + (mode ? ` (${mode})` : '')).trim() || 'Transport';
}
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '../../utils/googleMapsLink';
import styles from './ItineraryCardView.module.css';

export interface ItineraryCardViewProps {
  entry: ItineraryEntry;
  calendarDate: string;
  /** When true (e.g. pre-trip day), hide multi-day accommodation / cruise continuation labels. */
  suppressCarryoverUi?: boolean;
  /** Show a single outbound or return leg of a return transport entry on the timeline. */
  transportLeg?: TransportTimelineLeg;
  hasTask?: boolean;
  linkedEntryTask?: LinkedEntryTask;
  linkedEntryTasks?: LinkedEntryTask[];
  /** True when a Trip Reminders row exists for this entry with ReminderType CancellationDeadline. */
  hasCancellationDeadlineReminder?: boolean;
  /** When true, hide edit/duplicate/delete and other mutating controls. */
  readOnly?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMenuOpenChange?: (open: boolean) => void;
}

function emptySubItem(parent?: ItineraryEntry): Omit<ItinerarySubItem, 'id'> {
  return {
    title: '',
    category: 'Other',
    location: parent?.location?.trim() || undefined,
    decisionStatus: 'Idea',
    paymentStatus: 'Not paid',
    bookingRequired: false,
    amount: 0,
    currency: 'NZD',
    costCertainty: 'Estimated'
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
  transportLeg,
  hasTask = false,
  linkedEntryTask,
  linkedEntryTasks,
  hasCancellationDeadlineReminder = false,
  readOnly = false,
  onEdit,
  onDuplicate,
  onDelete,
  onMenuOpenChange
}) => {
  const manualTasks = linkedEntryTasks?.length ? linkedEntryTasks : linkedEntryTask ? [linkedEntryTask] : [];
  const [openTaskReminderId, setOpenTaskReminderId] = React.useState(
    () => linkedEntryTask?.reminderId ?? manualTasks[0]?.reminderId ?? ''
  );
  React.useEffect(() => {
    setOpenTaskReminderId(linkedEntryTask?.reminderId ?? linkedEntryTasks?.[0]?.reminderId ?? '');
  }, [entry.id, linkedEntryTask?.reminderId, linkedEntryTasks]);
  const openTaskTarget =
    manualTasks.find((t) => t.reminderId === openTaskReminderId) ?? linkedEntryTask ?? manualTasks[0];
  const spContext = useSpContext();
  const { trip, addSubItem, convertToHomeCurrency, setSelectedDayId, setMainWorkspaceTab, tripDays, localEntries, updateEntry, persistEntry, editingSubItem, setEditingSubItem } =
    useTripWorkspace();
  const planView = usePlanView();
  const { config } = useConfig();
  const canSeeFinancials = useCanSeeFinancials();
  const { documents, links: allLinks, addDocument, addLink } = useAttachments();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [attachmentEntryId, setAttachmentEntryId] = React.useState(entry.id);

  React.useEffect(() => {
    setAttachmentEntryId(entry.id);
  }, [entry.id]);

  const knownAttachmentEntryIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (entry.id) ids.add(entry.id);
    if (attachmentEntryId) ids.add(attachmentEntryId);
    return ids;
  }, [attachmentEntryId, entry.id]);
  const hasNotes = !isRichTextEditorEmpty(entry.notes);
  const [notesOpen, setNotesOpen] = React.useState(() => hasNotes);
  const [subItemsOpen, setSubItemsOpen] = React.useState(() => (entry.subItems?.length ?? 0) > 0);
  const menuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const menuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [menuAnchor, setMenuAnchor] = React.useState({ top: 0, left: 0, width: 140 });
  const [taskPromptOpen, setTaskPromptOpen] = React.useState(false);
  const [taskEditOpen, setTaskEditOpen] = React.useState(false);
  const [taskDueDate, setTaskDueDate] = React.useState('');
  const [taskDescription, setTaskDescription] = React.useState('');
  const [taskCategory, setTaskCategory] = React.useState(entry.category || 'Other');
  const [taskAssignee, setTaskAssignee] = React.useState('');
  const [taskNoteDraft, setTaskNoteDraft] = React.useState('');
  const [editTaskDescription, setEditTaskDescription] = React.useState('');
  const [editTaskDueDate, setEditTaskDueDate] = React.useState('');
  const [editTaskNote, setEditTaskNote] = React.useState('');
  const taskAssigneeOptions = React.useMemo(
    () => (trip?.id ? loadTripAssignees(trip.id) : []),
    [trip?.id, manualTasks.length]
  );

  React.useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  React.useLayoutEffect(() => {
    if (!menuOpen || !menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    const width = 140;
    setMenuAnchor({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width
    });
  }, [menuOpen]);

  React.useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onDoc = (ev: MouseEvent): void => {
      const target = ev.target as Node;
      if (menuButtonRef.current?.contains(target)) return;
      if (menuPortalRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  React.useEffect(() => {
    const nextHasNotes = !isRichTextEditorEmpty(entry.notes);
    setNotesOpen(nextHasNotes);
  }, [entry.id, entry.notes]);

  React.useEffect(() => {
    if ((entry.subItems?.length ?? 0) > 0) {
      setSubItemsOpen(true);
    }
  }, [entry.id, entry.subItems?.length]);

  React.useEffect(() => {
    setTaskPromptOpen(false);
    setTaskDueDate('');
    setTaskDescription('');
    setTaskNoteDraft('');
    setTaskAssignee('');
  }, [entry.id]);

  const displayAmountHome = convertToHomeCurrency(entry.amount, entry.currency || 'NZD');
  const paidCurrency = (entry.paymentCurrency || config.homeCurrency || 'NZD').toUpperCase();
  const displayAmountPaidHome = entry.amountPaid !== undefined
    ? (paidCurrency === (config.homeCurrency || 'NZD').toUpperCase()
      ? entry.amountPaid
      : convertToHomeCurrency(entry.amountPaid, paidCurrency))
    : undefined;
  const isActivities = entry.category === 'Activities';
  const isTransport = entry.category === 'Transport';
  const transportReturnHere =
    isTransport &&
    (transportLeg === 'return' || (!transportLeg && isTransportReturnOnCalendarDate(entry, calendarDate)));
  const transportOutboundHere = isTransport && !transportReturnHere && transportLeg !== 'return';
  const legDurationLabel = transportLegDurationLabel(entry, calendarDate, tripDays, transportLeg);
  const entryScheduleHero = formatEntryScheduleHero(entry, calendarDate, tripDays, {
    transportLeg,
    allEntries: localEntries
  });
  const isCheckoutMorningOnly =
    entry.category === 'Accommodation' &&
    isAccommodationCheckoutOnCalendarDate(entry, calendarDate) &&
    !isAccommodationNightOnCalendarDate(entry, calendarDate);
  const hhmm = formatTimeHHMM(effectiveTransportLegTime(entry, calendarDate, tripDays, transportLeg));
  const timeChip = isActivities
    ? formatActivityScheduleLabel({
        calendarDate,
        timeStart: effectiveTransportLegTime(entry, calendarDate, tripDays, transportLeg),
        duration: entry.duration,
        arrivalTime: entry.arrivalTime
      }) ?? null
    : (() => {
        const durationDisplay = legDurationLabel;
        if (hhmm !== '') {
          return `${hhmm}${durationDisplay ? ` · ${durationDisplay}` : ''}`;
        }
        return durationDisplay || null;
      })();

  const supplier = entry.supplier.trim();
  const location = formatLocationText((entry.location ?? '').trim());
  const isLocationInfo = isLocationInfoEntry(entry);
  const { placeById } = usePlaces();
  const [locationInfoExpanded, setLocationInfoExpanded] = React.useState(false);
  const locationInfoData = isLocationInfo
    ? (() => {
        const parsed = parseLocationInfoNotes(entry.notes);
        return parsed ? normalizeLocationInfoNotes(parsed) : null;
      })()
    : null;
  const locationHighlightRowsRef = React.useRef<LocationHighlightRow[]>(
    locationInfoData ? locationHighlightRows(locationInfoData) : []
  );
  if (locationInfoData) {
    locationHighlightRowsRef.current = locationHighlightRows(locationInfoData);
  }
  const locationInfoPlaceLabel = React.useMemo(() => {
    if (!locationInfoData) return formatLocationText((entry.location ?? '').trim());
    const place = placeById(locationInfoData.placeId);
    return place ? placeDisplayLabel(place) : formatLocationText((entry.location ?? '').trim());
  }, [locationInfoData, entry.location, placeById]);
  const isAccommodation = entry.category === 'Accommodation' && !!entry.dateStart && !!entry.dateEnd;
  const isCruise = entry.category === 'Cruise' && !!entry.embarksDate && !!entry.disembarksDate;
  const isCruisePort = entry.category === 'Cruise port';
  const isFlights = entry.category === 'Flights';
  const mapsPlaceUrl = googleMapsPlaceUrl(entry.streetAddress || '');
  const mapsDirectionsUrl = googleMapsDirectionsUrl(entry.streetAddress || '');
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
  const cardTotalHome = displayAmountHome + subTotal;
  const showSubItemContent = hasSubItems || editingSubItem?.parentEntryId === entry.id;
  const docs = React.useMemo(
    () => sortEntryDocuments(documents.filter((d) => knownAttachmentEntryIds.has(d.entryId))),
    [documents, knownAttachmentEntryIds]
  );
  const links = React.useMemo(
    () => sortEntryLinks(allLinks.filter((l) => knownAttachmentEntryIds.has(l.entryId))),
    [allLinks, knownAttachmentEntryIds]
  );


  const handleStartAddSubItem = React.useCallback(() => {
    if (readOnly) return;
    setSubItemsOpen(true);
    const tempId = addSubItem(entry.id, emptySubItem(entry));
    setEditingSubItem({ parentEntryId: entry.id, subItemId: tempId });
  }, [addSubItem, entry, readOnly, setEditingSubItem]);

  const handleUploadDocument = React.useCallback(
    async (file: File, documentType: EntryDocumentType, notes: string, title?: string) => {
      const resolved = await persistEntry(entry);
      setAttachmentEntryId(resolved.id);
      await addDocument({
        file,
        dayId: resolved.dayId,
        entryId: resolved.id,
        documentType,
        notes,
        title
      });
    },
    [addDocument, entry, persistEntry]
  );

  const handleAddLink = React.useCallback(
    async (draft: { linkTitle: string; url: string; linkType: EntryLinkType; notes: string }) => {
      const resolved = await persistEntry(entry);
      setAttachmentEntryId(resolved.id);
      await addLink({
        dayId: resolved.dayId,
        entryId: resolved.id,
        linkTitle: draft.linkTitle,
        url: draft.url,
        linkType: draft.linkType,
        notes: draft.notes
      });
    },
    [addLink, entry, persistEntry]
  );

  const entryMenuPortal =
    !readOnly && menuOpen && typeof document !== 'undefined'
      ? ReactDOM.createPortal(
          <div
            ref={menuPortalRef}
            className={styles.dropdownPortal}
            role="menu"
            style={{ top: menuAnchor.top, left: menuAnchor.left, minWidth: menuAnchor.width }}
          >
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className={isLocationInfo ? styles.locationInfoView : undefined}>
      {!isLocationInfo ? (
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {!entryScheduleHero && timeChip ? (
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
        <div className={styles.menuWrap}>
          {!readOnly ? (
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Entry actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {isLocationInfo ? (
        <div className={styles.locationInfoTitleRow}>
          <h3 className={styles.locationInfoTitle}>
            <span className={styles.locationInfoKind}>Location info</span>
            <PinIcon />
            <span>{locationInfoPlaceLabel || 'Location'}</span>
          </h3>
          <div className={styles.locationInfoTitleActions}>
            <div className={styles.menuWrap}>
              {!readOnly ? (
              <button
                ref={menuButtonRef}
                type="button"
                className={styles.menuButton}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Entry actions"
                onClick={() => setMenuOpen((o) => !o)}
              >
                ⋯
              </button>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.locationInfoCollapseBtn}
              aria-expanded={locationInfoExpanded}
              onClick={() => setLocationInfoExpanded((v) => !v)}
            >
              {locationInfoExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
      ) : (
        <h3 className={styles.title}>
          {transportReturnHere ? <span className={styles.returnPill}>Return</span> : null}
          {isTransport ? deriveTransportDisplayTitle(entry, calendarDate) : entry.title || 'Untitled'}
        </h3>
      )}
      {entryScheduleHero ? (
        <div className={`${styles.scheduleHero} th-cat-${categorySlug} th-cat-border`}>{entryScheduleHero}</div>
      ) : null}
      {isActivities && location ? (
        <div className={styles.metaRow}>
          <span>
            <PinIcon />
            {location}
          </span>
        </div>
      ) : null}
      {entry.category === 'Accommodation' && !entryScheduleHero && (entry.checkInTime || entry.bookingReference?.trim()) ? (
        <div className={styles.categorySummary}>
          {entry.checkInTime ? <span>Check-in {formatTimeHHMM(entry.checkInTime)}</span> : null}
          {entry.checkInTime && canSeeFinancials && entry.bookingReference?.trim() ? <span aria-hidden> · </span> : null}
          {canSeeFinancials && entry.bookingReference?.trim() ? <span>Ref {entry.bookingReference.trim()}</span> : null}
        </div>
      ) : null}
      {isFlights && (entry.flightNumbers?.trim() || cabinLabel) ? (
        <div className={styles.categorySummary}>
          {entry.flightNumbers?.trim() ? <span>{entry.flightNumbers.trim()}</span> : null}
          {entry.flightNumbers?.trim() && cabinLabel ? <span aria-hidden> · </span> : null}
          {cabinLabel ? <span>{cabinLabel}</span> : null}
        </div>
      ) : null}
      {isCruise && (entry.cruiseLineName?.trim() || entry.shipName?.trim()) ? (
        <div className={styles.categorySummary}>
          {entry.cruiseLineName?.trim() ? <span>{entry.cruiseLineName.trim()}</span> : null}
          {entry.cruiseLineName?.trim() && entry.shipName?.trim() ? <span aria-hidden> · </span> : null}
          {entry.shipName?.trim() ? <span>{entry.shipName.trim()}</span> : null}
        </div>
      ) : null}
      {transportReturnHere ? (
        <div className={styles.categorySummary}>Return journey</div>
      ) : null}
      {isActivities && canSeeFinancials && entry.bookingReference?.trim() ? (
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
      {(entry.category === 'Flights' && !entryScheduleHero && (entry.arrivalTime || entry.arrivalDate)) ? (
        <div className={styles.metaRow}>
          <span>Arrives {entry.arrivalDate ? formatYmd(entry.arrivalDate) : ''}{entry.arrivalDate && entry.arrivalTime ? ' · ' : ''}{entry.arrivalTime ? formatTimeHHMM(entry.arrivalTime) : ''}</span>
        </div>
      ) : null}
      {isCruisePort && !entryScheduleHero && (entry.timeStart || entry.arrivalTime) ? (
        <div className={styles.metaRow}>
          {entry.timeStart ? <span>Arrives {formatTimeHHMM(entry.timeStart)}</span> : null}
          {entry.timeStart && entry.arrivalTime ? <span aria-hidden> · </span> : null}
          {entry.arrivalTime ? <span>Departs {formatTimeHHMM(entry.arrivalTime)}</span> : null}
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

      {!isLocationInfo && supplier ? (
        <div className={styles.metaRow}>
          {supplier ? <span>{supplier}</span> : null}
        </div>
      ) : null}
      {!isLocationInfo && !isActivities && location ? (
        <div className={styles.metaRow}>
          <span>
            <PinIcon />
            {location}
          </span>
        </div>
      ) : null}

      {isLocationInfo && locationInfoData && locationInfoExpanded ? (
        <div className={styles.locationInfoBody}>
          {locationInfoData.aiError?.trim() ? (
            <p className={styles.locationInfoAiError}>{locationInfoData.aiError.trim()}</p>
          ) : null}
          {locationInfoData.overview.trim() ? (
            <section className={styles.locationInfoSection}>
              <h4 className={styles.locationInfoHeading}>Overview</h4>
              <div className={styles.locationInfoText}>
                <RichTextContent html={locationInfoData.overview.trim()} />
              </div>
            </section>
          ) : null}
          <section className={styles.locationInfoSection}>
            <h4 className={styles.locationInfoHeading}>Highlights</h4>
            <LocationInfoHighlights
              rows={locationHighlightRows(locationInfoData)}
              emptyHint={locationInfoData.aiSightsPlaceholder}
              entry={entry}
              place={placeById(locationInfoData.placeId)}
              geminiApiKey={config.geminiApiKey}
              hasAnyContent={locationInfoIsPopulated(locationInfoData)}
              readOnly={readOnly}
              onOpenSettings={() => window.dispatchEvent(new Event('travelhub-open-settings'))}
              onChange={(rows) => {
                if (readOnly) return;
                const prev = locationHighlightRowsRef.current;
                const suppressed = recordSuppressedHighlightLabels(locationInfoData, prev, rows);
                const marked = markHighlightRowsUserEdited(rows);
                locationHighlightRowsRef.current = marked;
                const next = normalizeLocationInfoNotes({
                  ...locationInfoData,
                  ...splitHighlightRows(marked),
                  suppressedHighlightKeys: suppressed
                });
                updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
              }}
            />
          </section>
          {locationInfoData.practicalTips.trim() ? (
            <section className={styles.locationInfoSection}>
              <h4 className={styles.locationInfoHeading}>Practical tips</h4>
              <p className={styles.locationInfoText}>{locationInfoData.practicalTips.trim()}</p>
            </section>
          ) : null}
          <LocationInfoAskPanel
            entry={entry}
            place={placeById(locationInfoData.placeId)}
            data={locationInfoData}
            geminiApiKey={config.geminiApiKey}
            onOpenSettings={() => window.dispatchEvent(new Event('travelhub-open-settings'))}
            onThreadChange={(thread) => {
              const next = normalizeLocationInfoNotes({ ...locationInfoData, aiQaThread: thread });
              updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
            }}
          />
        </div>
      ) : null}

      {!isLocationInfo ? (
      <div className={styles.badges}>
        <span className={`${styles.statusPill} ${styles.decisionPill} ${decisionClass}`}>{entry.decisionStatus}</span>
        {canSeeFinancials ? (
        <span className={`${styles.statusPill} ${styles.paymentPill} ${paymentClass}`}>
          {entry.paymentStatus}
          {(entry.paymentStatus === 'Not paid' || entry.paymentStatus === 'Part paid') && entry.paymentDueDate
            ? ` · ${paymentDueActionLabel(entry)} ${entry.paymentDueDate.slice(0, 10)}`
            : ''}
        </span>
        ) : null}
        {entry.bookingRequired ? (
          <span className={`${styles.statusPill} ${styles.bookingPill} ${styles.booking}`}>
            {entry.bookingStatus}
            {entry.bookingDueDate ? ` · by ${entry.bookingDueDate.slice(0, 10)}` : ''}
          </span>
        ) : null}
        {hasTask ? <span className={`${styles.statusPill} ${styles.taskPill}`}>Task added</span> : null}
      </div>
      ) : null}

      {!isLocationInfo && !isCheckoutMorningOnly && canSeeFinancials ? (
        <>
          <div className={styles.amountRow}>
            {isAccommodation && nights > 0 ? (
              entry.currency && entry.currency.toUpperCase() !== (config.homeCurrency || 'NZD').toUpperCase() ? (
                <>
                  {`${formatCurrency(entry.amount, entry.currency)} total · ${formatCurrency(entry.amount / nights, entry.currency)} /night`}
                  <span className={styles.unitSuffix}>
                    {` (${formatCurrency(displayAmountHome, config.homeCurrency)} total · ${formatCurrency(perNightHome, config.homeCurrency)} /night)`}
                  </span>
                </>
              ) : (
                `${formatCurrency(displayAmountHome, config.homeCurrency)} total · ${formatCurrency(perNightHome, config.homeCurrency)} /night`
              )
            ) : showCruiseDailyAmount ? (
              `${formatCurrency(displayAmountHome, config.homeCurrency)} total · ${formatCurrency(perCruiseDayHome, config.homeCurrency)} /day`
            ) : (
              formatCurrency(hasSubItems ? cardTotalHome : displayAmountHome, config.homeCurrency)
            )}
            {!isAccommodation && entry.currency && entry.currency.toUpperCase() !== config.homeCurrency.toUpperCase() ? (
              <span className={styles.unitSuffix}>
                {showCruiseDailyAmount
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
        </>
      ) : null}

      {!isLocationInfo && !isCheckoutMorningOnly && (entry.cancellationPolicy?.trim() || entry.cancellationDeadline) ? (
        <div className={styles.cancellationBlock}>
          {entry.cancellationPolicy?.trim() ? <div>Cancellation: {entry.cancellationPolicy.trim()}</div> : null}
          {entry.cancellationDeadline ? (
            <div>Cancel by {new Date(entry.cancellationDeadline).toLocaleString('en-NZ')}</div>
          ) : null}
          {entry.cancellationDeadline && hasCancellationDeadlineReminder ? (
            <div className={styles.cancellationTaskNote}>Cancellation task created (see Tasks view).</div>
          ) : null}
        </div>
      ) : null}

      {isAccommodation &&
      (entry.roomType?.trim() ||
        entry.checkOutTime ||
        entry.streetAddress?.trim() ||
        entry.phoneNumber?.trim() ||
        entry.bookingMechanism?.trim() ||
        entry.perksIncluded?.trim()) ? (
        <div className={styles.detailBlock}>
          {entry.roomType?.trim() ? <div>Room: {entry.roomType.trim()}</div> : null}
          {entry.checkOutTime ? <div>Check-out {formatTimeHHMM(entry.checkOutTime)}</div> : null}
          {entry.streetAddress?.trim() ? <div>{entry.streetAddress.trim()}</div> : null}
          {entry.phoneNumber?.trim() ? <div>Phone: {entry.phoneNumber.trim()}</div> : null}
          {entry.bookingMechanism?.trim() ? <div>Booked via: {entry.bookingMechanism.trim()}</div> : null}
          {entry.perksIncluded?.trim() ? <div>Perks: {entry.perksIncluded.trim()}</div> : null}
          {mapsPlaceUrl ? (
            <div className={styles.mapsLinks}>
              <a className={styles.mapsLink} href={mapsPlaceUrl} target="_blank" rel="noopener noreferrer">
                View on map
              </a>
              {mapsDirectionsUrl ? (
                <a className={styles.mapsLinkSecondary} href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {isFlights && (entry.checkInClosesTime || entry.bagCheckClosesTime || (canSeeFinancials && entry.bookingReference?.trim())) ? (
        <div className={styles.detailBlock}>
          {canSeeFinancials && entry.bookingReference?.trim() ? <div>PNR / ref {entry.bookingReference.trim()}</div> : null}
          {entry.checkInClosesTime ? <div>Check-in closes {formatTimeHHMM(entry.checkInClosesTime)}</div> : null}
          {entry.bagCheckClosesTime ? <div>Bag check closes {formatTimeHHMM(entry.bagCheckClosesTime)}</div> : null}
        </div>
      ) : null}
      {isActivities && (entry.streetAddress?.trim() || mapsPlaceUrl) ? (
        <div className={styles.detailBlock}>
          {entry.streetAddress?.trim() ? <div>{entry.streetAddress.trim()}</div> : null}
          {mapsPlaceUrl ? (
            <div className={styles.mapsLinks}>
              <a className={styles.mapsLink} href={mapsPlaceUrl} target="_blank" rel="noopener noreferrer">
                View on map
              </a>
              {mapsDirectionsUrl ? (
                <a className={styles.mapsLinkSecondary} href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {isTransport &&
      (entry.transportFrom?.trim() ||
        entry.transportTo?.trim() ||
        entry.transportMode?.trim() ||
        (entry.transportTransfers !== undefined && entry.transportTransfers > 0) ||
        (entry.journeyType === 'oneway' && entry.journeyType) ||
        (transportOutboundHere && (entry.timeStart || entry.arrivalTime)) ||
        (transportReturnHere && (entry.returnDate || entry.returnTime || entry.returnArrivalTime))) ? (
        <div className={styles.detailBlock}>
          {entry.transportFrom?.trim() ? <div>From {entry.transportFrom.trim()}</div> : null}
          {entry.transportTo?.trim() ? <div>To {entry.transportTo.trim()}</div> : null}
          {entry.transportMode?.trim() ? <div>Mode {entry.transportMode.trim()}</div> : null}
          {entry.transportTransfers !== undefined && entry.transportTransfers > 0 ? (
            <div>Transfers {entry.transportTransfers}</div>
          ) : null}
          {entry.journeyType === 'oneway' ? <div>Journey One way</div> : null}
          {!entryScheduleHero && transportOutboundHere && entry.timeStart ? (
            <div>Departs {formatTimeHHMM(entry.timeStart)}</div>
          ) : null}
          {!entryScheduleHero && transportOutboundHere && entry.arrivalTime ? (
            <div>Arrives {formatTimeHHMM(entry.arrivalTime)}</div>
          ) : null}
          {transportReturnHere && entry.returnDate ? <div>Return date {formatYmd(entry.returnDate)}</div> : null}
          {!entryScheduleHero && transportReturnHere && entry.returnTime ? (
            <div>Return dep. {formatTimeHHMM(entry.returnTime)}</div>
          ) : null}
          {!entryScheduleHero && transportReturnHere && entry.returnArrivalTime ? (
            <div>Return arr. {formatTimeHHMM(entry.returnArrivalTime)}</div>
          ) : null}
        </div>
      ) : null}
      {isCruise &&
      (entry.cruiseReference?.trim() ||
        entry.cabinTypeAndNumber?.trim() ||
        entry.packageName?.trim() ||
        entry.packageInclusions?.trim()) ? (
        <div className={styles.detailBlock}>
          {entry.cruiseReference?.trim() ? <div>Ref {entry.cruiseReference.trim()}</div> : null}
          {entry.cabinTypeAndNumber?.trim() ? <div>Cabin {entry.cabinTypeAndNumber.trim()}</div> : null}
          {entry.packageName?.trim() ? <div>Package {entry.packageName.trim()}</div> : null}
          {entry.packageInclusions?.trim() ? <div>Inclusions {entry.packageInclusions.trim()}</div> : null}
        </div>
      ) : null}

      {!isLocationInfo ? (
        <div className={styles.cardLinksRow}>
          {hasNotes ? (
            <button type="button" className={styles.cardInlineLink} onClick={() => setNotesOpen((o) => !o)}>
              {notesOpen ? 'Notes ▴' : 'Notes ▾'}
            </button>
          ) : !readOnly ? (
            <button type="button" className={styles.cardInlineLink} onClick={onEdit}>
              Enter notes
            </button>
          ) : null}
          <EntryFilesLinksPanel
            entryId={attachmentEntryId}
            docs={docs}
            links={links}
            allowAdd={!readOnly}
            toggleClassName={styles.cardInlineLink}
            onUploadDocument={handleUploadDocument}
            onAddLink={handleAddLink}
          />
        </div>
      ) : null}
      {!isLocationInfo && notesOpen && hasNotes ? (
        <div className={styles.notesBody}>
          <RichTextContent html={entry.notes} />
        </div>
      ) : null}

      {(!isLocationInfo || !locationInfoExpanded) ? (
        <>
          {isLocationInfo && !locationInfoExpanded && !readOnly ? (
            <div className={styles.locationInfoInlineActions}>
              <button type="button" className={styles.addSubItemBtn} onClick={onEdit}>
                Edit
              </button>
              <button
                type="button"
                className={styles.addSubItemBtn}
                onClick={() => {
                  setTaskPromptOpen((v) => {
                    const next = !v;
                    if (!v) {
                      setTaskDescription('');
                      setTaskCategory(entry.category || 'Other');
                      setTaskAssignee('');
                      setTaskNoteDraft('');
                      setTaskDueDate('');
                    }
                    return next;
                  });
                }}
              >
                {manualTasks.length > 0 ? 'Create another task' : 'Create task'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {manualTasks.length > 0 && openTaskTarget ? (
        <div className={styles.linkedTaskSummary}>
          <span className={styles.linkedTaskLabel}>Linked task</span>
          <p className={styles.linkedTaskText}>{linkedTaskDisplayText(openTaskTarget)}</p>
          {openTaskTarget.dueDate ? (
            <p className={styles.linkedTaskNote}>
              Due {new Date(openTaskTarget.dueDate).toLocaleDateString('en-NZ')}
            </p>
          ) : null}
          {openTaskTarget.assignedTo?.trim() ? (
            <p className={styles.linkedTaskNote}>Assigned to {openTaskTarget.assignedTo.trim()}</p>
          ) : null}
          {linkedTaskNoteDisplay(openTaskTarget) ? (
            <p className={styles.linkedTaskNote}>{linkedTaskNoteDisplay(openTaskTarget)}</p>
          ) : null}
        </div>
      ) : null}
      <div className={`${styles.subItemActionsRow} ${isLocationInfo && !locationInfoExpanded ? styles.subItemActionsRowHidden : ''}`}>
        {manualTasks.length > 0 && openTaskTarget ? (
          <>
            {manualTasks.length > 1 ? (
              <select
                className={styles.taskPickSelect}
                aria-label="Choose linked task"
                value={openTaskReminderId}
                onChange={(e) => setOpenTaskReminderId(e.target.value)}
              >
                {manualTasks.map((t) => (
                  <option key={t.reminderId} value={t.reminderId}>
                    {linkedTaskDisplayText(t)}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className={styles.addSubItemBtn}
              onClick={() => {
                setMainWorkspaceTab('plan');
                planView?.setPlanTab('tasks');
                planView?.setTasksViewMode('list');
                planView?.setTaskSectionFilter('todo');
                planView?.setFocusedReminderId(openTaskTarget.reminderId);
                requestViewTask({
                  reminderId: openTaskTarget.reminderId,
                  entryId: entry.id,
                  dayId: entry.dayId
                });
                scrollToReminderRow(openTaskTarget.reminderId);
              }}
            >
              Open task
            </button>
            {!readOnly ? (
            <button type="button" className={styles.addSubItemBtn} onClick={onEdit}>
              Edit
            </button>
            ) : null}
            {!readOnly ? (
            <button
              type="button"
              className={styles.addSubItemBtn}
              onClick={() => {
                setTaskEditOpen((v) => {
                  const next = !v;
                  if (!v && openTaskTarget) {
                    setEditTaskDescription(linkedTaskDisplayText(openTaskTarget));
                    setEditTaskDueDate(openTaskTarget.dueDate ? openTaskTarget.dueDate.slice(0, 10) : '');
                    setEditTaskNote((openTaskTarget.taskNote || '').trim());
                  }
                  return next;
                });
                setTaskPromptOpen(false);
              }}
            >
              Edit task
            </button>
            ) : null}
            {!readOnly ? (
            <button
              type="button"
              className={styles.addSubItemBtn}
              onClick={() => {
                setTaskEditOpen(false);
                setTaskPromptOpen((v) => {
                  const next = !v;
                  if (!v) {
                    setTaskDescription('');
                    setTaskCategory(entry.category || 'Other');
                    setTaskAssignee('');
                    setTaskNoteDraft('');
                    setTaskDueDate('');
                  }
                  return next;
                });
              }}
            >
              Create another task
            </button>
            ) : null}
          </>
        ) : !readOnly ? (
          <>
            <button type="button" className={styles.addSubItemBtn} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className={styles.addSubItemBtn}
              onClick={() => {
                setTaskPromptOpen((v) => {
                  const next = !v;
                  if (!v) {
                    setTaskDescription('');
                    setTaskCategory(entry.category || 'Other');
                    setTaskAssignee('');
                    setTaskNoteDraft('');
                    setTaskDueDate('');
                  }
                  return next;
                });
              }}
            >
              {manualTasks.length > 0 ? 'Create another task' : 'Create task'}
            </button>
          </>
        ) : null}
      </div>
      {!isLocationInfo ? (
      <div className={styles.subItemActionsRowSecondary}>
        {!readOnly ? (
        <button type="button" className={styles.addSubItemBtn} onClick={handleStartAddSubItem}>
          + Add option
        </button>
        ) : null}
        {hasSubItems ? (
          <button type="button" className={styles.relatedToggle} onClick={() => setSubItemsOpen((o) => !o)}>
            {subItemsOpen ? `Hide related items ▴` : `Show ${subItems.length} related items ▾`}
          </button>
        ) : null}
      </div>
      ) : null}
      {taskEditOpen && !readOnly && openTaskTarget ? (
        <div className={styles.newSubItemForm}>
          <label className={styles.taskInlineLabel} htmlFor={`task-edit-desc-${entry.id}`}>
            Task description
          </label>
          <input
            id={`task-edit-desc-${entry.id}`}
            className={styles.newSubField}
            type="text"
            value={editTaskDescription}
            onChange={(e) => setEditTaskDescription(e.target.value)}
          />
          <label className={styles.taskInlineLabel} htmlFor={`task-edit-note-${entry.id}`}>
            Task note (optional)
          </label>
          <input
            id={`task-edit-note-${entry.id}`}
            className={styles.newSubField}
            type="text"
            value={editTaskNote}
            onChange={(e) => setEditTaskNote(e.target.value)}
          />
          <div className={styles.newSubRow}>
            <input
              className={styles.newSubField}
              type="date"
              value={editTaskDueDate}
              onChange={(e) => setEditTaskDueDate(e.target.value)}
            />
            <button
              type="button"
              className={styles.newSubActionBtn}
              onClick={() => {
                const trimmed = editTaskDescription.trim();
                if (!trimmed) return;
                const svc = new ReminderService(spContext);
                void svc
                  .update(openTaskTarget.reminderId, {
                    title: trimmed.startsWith('Task:') ? trimmed : `Task: ${trimmed}`,
                    reminderText: trimmed,
                    taskNote: editTaskNote.trim(),
                    taskCategory: entry.category || taskCategory,
                    dueDate: editTaskDueDate ? `${editTaskDueDate}T00:00:00.000Z` : undefined
                  })
                  .then(() => {
                    window.dispatchEvent(new CustomEvent('trip-reminders-updated'));
                    setTaskEditOpen(false);
                  })
                  .catch(console.error);
              }}
            >
              Save task
            </button>
            <button type="button" className={styles.newSubActionBtn} onClick={() => setTaskEditOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {taskPromptOpen && !readOnly ? (
        <div className={styles.newSubItemForm}>
          <label className={styles.taskInlineLabel} htmlFor={`task-cat-${entry.id}`}>
            Category
          </label>
          <select
            id={`task-cat-${entry.id}`}
            className={styles.newSubField}
            value={taskCategory}
            onChange={(e) => setTaskCategory(e.target.value)}
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className={styles.taskInlineLabel} htmlFor={`task-desc-${entry.id}`}>
            Task description (optional)
          </label>
          <input
            id={`task-desc-${entry.id}`}
            className={styles.newSubField}
            type="text"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />
          <label className={styles.taskInlineLabel} htmlFor={`task-note-${entry.id}`}>
            Task note (optional)
          </label>
          <input
            id={`task-note-${entry.id}`}
            className={styles.newSubField}
            type="text"
            value={taskNoteDraft}
            onChange={(e) => setTaskNoteDraft(e.target.value)}
          />
          <label className={styles.taskInlineLabel} htmlFor={`task-assignee-${entry.id}`}>
            Assigned to (optional)
          </label>
          <input
            id={`task-assignee-${entry.id}`}
            className={styles.newSubField}
            type="text"
            value={taskAssignee}
            onChange={(e) => setTaskAssignee(e.target.value)}
            list={`task-assignees-${entry.id}`}
          />
          <datalist id={`task-assignees-${entry.id}`}>
            {taskAssigneeOptions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className={styles.newSubRow}>
            <input className={styles.newSubField} type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
            <button
              type="button"
              className={styles.newSubActionBtn}
              onClick={() => {
                const svc = new ReminderService(spContext);
                const desc = taskDescription.trim();
                const note = taskNoteDraft.trim();
                void svc
                  .create({
                    title: desc ? (desc.startsWith('Task:') ? desc : `Task: ${desc}`) : 'Task',
                    tripId: entry.tripId,
                    dayId: entry.dayId,
                    entryId: entry.id,
                    reminderType: 'Manual',
                    reminderText: desc,
                    taskCategory,
                    taskNote: note || undefined,
                    assignedTo: taskAssignee.trim() || undefined,
                    dueDate: taskDueDate ? `${taskDueDate}T00:00:00.000Z` : undefined,
                    isComplete: false
                  })
                  .then((created) => {
                    if (trip?.id && taskAssignee.trim()) rememberTripAssignee(trip.id, taskAssignee);
                    setOpenTaskReminderId(created.id);
                    window.dispatchEvent(new CustomEvent('trip-reminders-updated'));
                    setTaskPromptOpen(false);
                    setTaskDueDate('');
                    setTaskDescription('');
                    setTaskNoteDraft('');
                    setTaskAssignee('');
                  })
                  .catch(console.error);
              }}
            >
              Add task
            </button>
            <button
              type="button"
              className={styles.newSubActionBtn}
              onClick={() => {
                setTaskPromptOpen(false);
                setTaskDueDate('');
                setTaskDescription('');
                setTaskNoteDraft('');
                setTaskAssignee('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showSubItemContent ? (
        <div className={`${styles.relatedContent} ${subItemsOpen || editingSubItem?.parentEntryId === entry.id ? styles.relatedContentOpen : ''}`}>
          <SubItemList subItems={subItems} entryId={entry.id} />
        </div>
      ) : null}
      {entryMenuPortal}
    </div>
  );
};
