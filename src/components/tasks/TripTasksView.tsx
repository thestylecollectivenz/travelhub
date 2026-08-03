import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService, TripReminder } from '../../services/ReminderService';
import { useOfflineStatus } from '../../context/OfflineStatusContext';
import { loadTripOfflineCache, patchTripOfflineExtrasCache } from '../../utils/tripOfflineCache';
import { isLikelyNetworkError } from '../../utils/networkError';
import { requestSidebarDayFocus } from '../../utils/sidebarDayFocus';
import { TasksCalendarView, type CalendarEvent } from './TasksCalendarView';
import type { CalendarRangeFilter } from '../../utils/tasksCalendarRange';
import { TasksMonthCalendar } from './TasksMonthCalendar';
import { TRAVELHUB_VIEW_TASK, scrollToReminderRow } from '../../utils/viewTaskFocus';
import {
  dismissMissingAmountEntry,
  loadDismissedMissingAmountIds,
  restoreMissingAmountEntry
} from '../../utils/missingAmountDismissed';
import { collectMissingAmountRows } from '../../utils/missingAmountEntries';
import { paymentDueTaskTitle, paymentDueDateHint } from '../../utils/paymentDueLabels';
import {
  clearPaymentDuePatch,
  effectivePaymentDueDate,
  paymentDueDateInputValue,
  setPaymentDuePatch,
  shouldHideFromPaymentTasks
} from '../../utils/paymentDueDefaults';
import { setPendingMobileItineraryOpen } from '../../utils/mobileItineraryOpenPending';
import { GO_TO_DAY_EVENT } from '../mobile/MobileTripIdeasList';
import { confirmUserAction } from '../../utils/confirmAction';
import { loadTripAssignees, rememberTripAssignee } from '../../utils/tripAssignees';
import { reminderTaskCategory, TASK_FILTER_UNCATEGORISED, matchesTaskCompletionFilter } from '../../utils/taskFilters';
import { isDayIdeaReminder } from '../../utils/dayIdeas';
import { isJotterIdeaReminder } from '../../utils/tripJotterIdeas';
import { isSavedSpotReminder } from '../../utils/tripSavedSpots';
import {
  buildTaskCategoryOptions,
  rememberTripTaskCategory,
  resolveTaskCategorySelection
} from '../../utils/tripTaskCategories';
import { openTasksPrintPreview, type TasksPrintSection } from '../../utils/tasksPrintHtml';
import { INSIGHT_FOCUS_EVENT, type InsightFocusDetail } from '../../utils/insightFocus';
import { formatReminderDueLabel } from '../../utils/wallDateTime';
import { MOBILE_OPEN_TASK_ADD } from '../../utils/mobileHomePendingAction';
import {
  isAllTaskDueFilters,
  localTodayYmd,
  matchesAnyTaskDueFilter,
  toggleTaskDueFilter,
  type TaskDueFilter
} from '../../utils/taskDueBuckets';
import { useTripRole } from '../../context/TripRoleContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { assigneeLabelsMatch } from '../../utils/tripMemberIdentity';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import dayHeaderStyles from '../day/DayHeader.module.css';
import styles from './TripTasksView.module.css';
import listStyles from '../mobile/MobilePackingList.module.css';

const DUE_FILTER_KEYS: TaskDueFilter[] = ['all', 'overdue', 'today', 'tomorrow'];

const NO_TASK_CATEGORY_FILTERS: string[] = [];
const NO_DUE_FILTERS: TaskDueFilter[] = [];

function dueFilterLabel(key: TaskDueFilter): string {
  if (key === 'all') return 'All';
  if (key === 'overdue') return 'Overdue';
  if (key === 'today') return 'Due today';
  return 'Due tomorrow';
}

function IconOpenInItinerary(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 3h6v6M21 3l-9 9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 7V5h4v2m-6 3v8m4-8v8M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DueFilterChips(props: {
  ariaLabel: string;
  value: TaskDueFilter[];
  onChange: (value: TaskDueFilter[]) => void;
}): React.ReactElement {
  return (
    <div className={styles.dueFilterRow} role="group" aria-label={props.ariaLabel}>
      {DUE_FILTER_KEYS.map((key) => {
        const active = key === 'all' ? isAllTaskDueFilters(props.value) : props.value.indexOf(key) >= 0;
        return (
          <button
            key={key}
            type="button"
            className={active ? styles.dueFilterChipActive : styles.dueFilterChip}
            aria-pressed={active}
            onClick={() => props.onChange(toggleTaskDueFilter(props.value, key))}
          >
            {dueFilterLabel(key)}
          </button>
        );
      })}
    </div>
  );
}

export interface TripTasksViewProps {
  variant?: 'tasks' | 'missing_costs';
  mobileLayout?: boolean;
  /** Mobile: open the Filters drawer (button sits next to search). */
  onOpenFilters?: () => void;
  filtersActive?: boolean;
  filtersOpen?: boolean;
}

type CreateKind = 'task' | 'reminder';
type ViewMode = 'list' | 'calendar';
type CalendarLayout = 'grid' | 'list';
type MissingAmountFilter = 'unchecked' | 'all';
type DueDateSort = 'none' | 'asc' | 'desc';

function sortRemindersByDueDate(rows: TripReminder[], mode: DueDateSort): TripReminder[] {
  if (mode === 'none') return rows;
  const copy = rows.slice();
  copy.sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return mode === 'asc' ? aDue - bDue : bDue - aDue;
    return (a.title || '').localeCompare(b.title || '');
  });
  return copy;
}

function stripFollowUpPrefix(text: string): string {
  return text.replace(/^Follow\s*up:\s*/i, '').trim();
}

function reminderDisplayTitle(m: TripReminder): string {
  const isManual = m.reminderType === 'Manual' || m.reminderType === 'ManualEntryTask';
  const isReminder = m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline';
  if (isManual) {
    const raw = stripFollowUpPrefix((m.reminderText || m.title || '').trim());
    if (!raw) return 'Task';
    return raw.startsWith('Task:') ? raw : `Task: ${raw}`;
  }
  if (isReminder) {
    const raw = (m.reminderText || m.title || '').trim();
    if (!raw) return 'Reminder';
    return raw.startsWith('Reminder:') ? raw : `Reminder: ${raw}`;
  }
  return m.title;
}

function resolveReminderItineraryTarget(
  m: TripReminder,
  localEntries: ItineraryEntry[]
): { openEntryId: string; openDayId: string; contextLine: string; entry?: ItineraryEntry; supplier?: string } | undefined {
  const eid = (m.entryId || '').trim();
  if (!eid) return undefined;
  const parent = localEntries.find((e) => e.id === eid);
  if (parent) {
    const supplier = parent.supplier?.trim() || undefined;
    return {
      openEntryId: parent.id,
      openDayId: parent.dayId,
      contextLine: `${parent.category ? `${parent.category} · ` : ''}${parent.title || 'Untitled'}`,
      entry: parent,
      supplier
    };
  }
  for (const p of localEntries) {
    const sub = p.subItems?.find((s) => s.id === eid);
    if (sub) {
      const supplier = sub.supplier?.trim() || p.supplier?.trim() || undefined;
      return {
        openEntryId: p.id,
        openDayId: p.dayId,
        contextLine: `Option: ${sub.title || 'Untitled'} · under ${p.title || 'Item'}`,
        entry: p,
        supplier
      };
    }
  }
  return undefined;
}

function supplierMetaLine(supplier?: string): React.ReactNode {
  if (!supplier?.trim()) return null;
  return (
    <>
      <span aria-hidden> · </span>
      {supplier.trim()}
    </>
  );
}

function ymdFromIso(iso?: string): string {
  return (iso || '').slice(0, 10);
}

export const TripTasksView: React.FC<TripTasksViewProps> = ({
  variant = 'tasks',
  mobileLayout = false,
  onOpenFilters,
  filtersActive = false,
  filtersOpen = false
}) => {
  const spContext = useSpContext();
  const { reportNetworkFailure } = useOfflineStatus();
  const {
    trip,
    localEntries,
    tripDays,
    updateEntry,
    setSelectedDayId,
    setEditingCardId,
    setEditingSubItem,
    setFocusedEntryId,
    setMainWorkspaceTab,
    setWorkspaceReturn
  } = useTripWorkspace();
  const planView = usePlanView();
  const { role } = useTripRole();
  const { members } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);
  const canEditManualTask = React.useCallback(
    (assignedTo?: string) => canEditOwnedRecord(spContext, undefined, role, assignedTo, members),
    [spContext, role, members]
  );
  const [manual, setManual] = React.useState<TripReminder[]>([]);
  const taskCompletionFilter = planView?.taskCompletionFilter ?? 'all';
  const showCompletedOnly = taskCompletionFilter === 'completed';
  const hideManualPaymentTasks = planView?.hideManualPaymentTasks ?? false;
  const [viewMode, setViewMode] = React.useState<ViewMode>(planView?.tasksViewMode ?? 'list');
  const [calendarLayout, setCalendarLayout] = React.useState<CalendarLayout>('grid');
  const [calendarRange, setCalendarRange] = React.useState<CalendarRangeFilter>('all');
  const [customRangeStart, setCustomRangeStart] = React.useState('');
  const [customRangeEnd, setCustomRangeEnd] = React.useState('');
  const [createKind, setCreateKind] = React.useState<CreateKind>('task');
  const [text, setText] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [missingAmountFilter, setMissingAmountFilter] = React.useState<MissingAmountFilter>('unchecked');
  const [dismissedMissing, setDismissedMissing] = React.useState<Set<string>>(() => new Set());
  const [editingReminderId, setEditingReminderId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDueDate, setEditDueDate] = React.useState('');
  const [editNote, setEditNote] = React.useState('');
  const [editAssignedTo, setEditAssignedTo] = React.useState('');
  const [editTaskCategory, setEditTaskCategory] = React.useState('Other');
  const [editCustomTaskCategory, setEditCustomTaskCategory] = React.useState('');
  const [createAssignedTo, setCreateAssignedTo] = React.useState('');
  const [createTaskCategory, setCreateTaskCategory] = React.useState('To Do');
  const [createCustomTaskCategory, setCreateCustomTaskCategory] = React.useState('');
  const [dueDateSort, setDueDateSort] = React.useState<DueDateSort>('none');
  const [localTaskDueFilters, setLocalTaskDueFilters] = React.useState<TaskDueFilter[]>(NO_DUE_FILTERS);
  const taskDueFilters = planView?.taskDueFilters ?? localTaskDueFilters;
  const setTaskDueFilters = planView?.setTaskDueFilters ?? setLocalTaskDueFilters;
  const [bookingDueFilters, setBookingDueFilters] = React.useState<TaskDueFilter[]>(NO_DUE_FILTERS);
  const [paymentDueFilters, setPaymentDueFilters] = React.useState<TaskDueFilter[]>(NO_DUE_FILTERS);

  // Keep bookings / payments / cancellations aligned with the shared due filter (mobile stats + chips).
  React.useEffect(() => {
    setBookingDueFilters(taskDueFilters);
    setPaymentDueFilters(taskDueFilters);
  }, [taskDueFilters]);
  const [tasksInsightFocus, setTasksInsightFocus] = React.useState<string | null>(null);
  const [taskSearch, setTaskSearch] = React.useState('');
  const [savingReminderId, setSavingReminderId] = React.useState<string | null>(null);
  const [togglingCompleteId, setTogglingCompleteId] = React.useState<string | null>(null);
  const addTaskInputRef = React.useRef<HTMLInputElement | null>(null);
  const todayYmd = React.useMemo(() => localTodayYmd(), []);

  React.useEffect(() => {
    const handler = (): void => {
      setViewMode('list');
      window.setTimeout(() => addTaskInputRef.current?.focus(), 100);
    };
    window.addEventListener(MOBILE_OPEN_TASK_ADD, handler);
    return () => window.removeEventListener(MOBILE_OPEN_TASK_ADD, handler);
  }, []);

  React.useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<InsightFocusDetail>).detail;
      if (detail.pane !== 'tasks') return;
      setTasksInsightFocus(detail.focus || null);
      if (detail.focus === 'overdue') setTaskDueFilters(['overdue']);
    };
    window.addEventListener(INSIGHT_FOCUS_EVENT, handler);
    return () => window.removeEventListener(INSIGHT_FOCUS_EVENT, handler);
  }, []);

  const taskCategoryFilters = planView?.taskCategoryFilters ?? NO_TASK_CATEGORY_FILTERS;
  const taskAssigneeFilter = planView?.taskAssigneeFilter ?? null;
  const taskSectionFilter = planView?.taskSectionFilter ?? null;
  const showTaskSection = React.useCallback(
    (key: 'todo' | 'bookings' | 'payments' | 'cancellations') => !taskSectionFilter || taskSectionFilter === key,
    [taskSectionFilter]
  );
  const knownAssignees = React.useMemo(() => {
    const fromStorage = trip?.id ? loadTripAssignees(trip.id) : [];
    const fromMembers = members.map((m) => m.userDisplayName).filter(Boolean);
    const fromManual = manual.map((m) => m.assignedTo).filter(Boolean) as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of [...fromMembers, ...fromStorage, ...fromManual]) {
      const t = (raw || '').trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [trip?.id, manual, members]);

  const taskCategoryOptions = React.useMemo(
    () => buildTaskCategoryOptions(trip?.id, manual.map((m) => m.taskCategory || '')),
    [trip?.id, manual]
  );

  React.useEffect(() => {
    if (!planView) return;
    planView.setTasksViewMode(viewMode);
  }, [planView, viewMode]);

  React.useEffect(() => {
    if (planView?.tasksViewMode && planView.tasksViewMode !== viewMode) {
      setViewMode(planView.tasksViewMode);
    }
  }, [planView?.tasksViewMode]);
  const svc = React.useMemo(() => new ReminderService(spContext), [spContext]);

  const matchesCategoryFilter = React.useCallback(
    (entry: ItineraryEntry): boolean => {
      if (!taskCategoryFilters.length) return true;
      const cat = (entry.category || 'Other').trim();
      return taskCategoryFilters.some((f) => f !== TASK_FILTER_UNCATEGORISED && f === cat);
    },
    [taskCategoryFilters]
  );

  const showEntryDerivedTasks =
    taskCategoryFilters.length === 0 || taskCategoryFilters.some((c) => c !== TASK_FILTER_UNCATEGORISED);
  const showEntryDerivedForAssignee = !taskAssigneeFilter;

  const matchesAssigneeFilter = React.useCallback(
    (assignedTo?: string): boolean => {
      if (!taskAssigneeFilter) return true;
      return assigneeLabelsMatch(spContext, assignedTo, taskAssigneeFilter, members);
    },
    [taskAssigneeFilter, spContext, members]
  );

  const matchesReminderFilters = React.useCallback(
    (m: TripReminder): boolean => {
      if (!matchesAssigneeFilter(m.assignedTo)) return false;
      if (!taskCategoryFilters.length) return true;
      const target = resolveReminderItineraryTarget(m, localEntries);
      const cat = reminderTaskCategory(m, target?.entry?.category);
      if (!cat) return taskCategoryFilters.indexOf(TASK_FILTER_UNCATEGORISED) >= 0;
      return taskCategoryFilters.indexOf(cat) >= 0;
    },
    [taskCategoryFilters, taskAssigneeFilter, localEntries, matchesAssigneeFilter]
  );

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        setManual(rows);
        void patchTripOfflineExtrasCache(trip.id, { reminders: rows });
      })
      .catch(async (err) => {
        console.error(err);
        if (isLikelyNetworkError(err)) reportNetworkFailure(err);
        const cached = await loadTripOfflineCache(trip.id);
        if (cached?.reminders) setManual(cached.reminders);
      });
  }, [svc, trip?.id, reportNetworkFailure]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    const onView = (ev: Event): void => {
      const id = (ev as CustomEvent<{ reminderId?: string }>).detail?.reminderId;
      if (!id) return;
      planView?.setFocusedReminderId(id);
      planView?.setTaskSectionFilter(
        manual.find((m) => m.id === id)?.reminderType === 'CancellationDeadline' ? 'cancellations' : 'todo'
      );
      planView?.setTasksViewMode('list');
      setViewMode('list');
      scrollToReminderRow(id);
    };
    window.addEventListener(TRAVELHUB_VIEW_TASK, onView as EventListener);
    return () => window.removeEventListener(TRAVELHUB_VIEW_TASK, onView as EventListener);
  }, [planView, manual]);

  React.useEffect(() => {
    if (trip?.id) {
      setDismissedMissing(loadDismissedMissingAmountIds(trip.id));
    }
  }, [trip?.id]);

  const bookingTasks = React.useMemo(
    () =>
      showEntryDerivedTasks && showEntryDerivedForAssignee && !showCompletedOnly
        ? localEntries.filter(
            (e) =>
              e.bookingRequired &&
              e.bookingStatus === 'Not booked' &&
              matchesCategoryFilter(e) &&
              matchesAnyTaskDueFilter(e.bookingDueDate, bookingDueFilters, todayYmd)
          )
        : [],
    [localEntries, matchesCategoryFilter, showEntryDerivedTasks, showEntryDerivedForAssignee, bookingDueFilters, todayYmd, showCompletedOnly]
  );
  const completedBookingTasks = React.useMemo(
    () =>
      showEntryDerivedTasks && showEntryDerivedForAssignee && showCompletedOnly
        ? localEntries.filter(
            (e) =>
              e.bookingRequired &&
              e.bookingStatus === 'Booked' &&
              matchesCategoryFilter(e) &&
              matchesAnyTaskDueFilter(e.bookingDueDate, bookingDueFilters, todayYmd)
          )
        : [],
    [localEntries, matchesCategoryFilter, showEntryDerivedTasks, showEntryDerivedForAssignee, bookingDueFilters, todayYmd, showCompletedOnly]
  );
  const paymentTasks = React.useMemo(
    () =>
      showEntryDerivedTasks && showEntryDerivedForAssignee && !showCompletedOnly
        ? localEntries.filter(
            (e) => {
              if (shouldHideFromPaymentTasks(e)) return false;
              return (
                ((e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid') &&
                matchesCategoryFilter(e) &&
                matchesAnyTaskDueFilter(effectivePaymentDueDate(e), paymentDueFilters, todayYmd)
              );
            }
          )
        : [],
    [
      localEntries,
      matchesCategoryFilter,
      showEntryDerivedTasks,
      showEntryDerivedForAssignee,
      paymentDueFilters,
      todayYmd,
      showCompletedOnly,
      hideManualPaymentTasks
    ]
  );
  const completedPaymentTasks = React.useMemo(
    () =>
      showEntryDerivedTasks && showEntryDerivedForAssignee && showCompletedOnly
        ? localEntries.filter(
            (e) =>
              e.amount > 0 &&
              e.paymentStatus === 'Fully paid' &&
              matchesCategoryFilter(e) &&
              matchesAnyTaskDueFilter(effectivePaymentDueDate(e), paymentDueFilters, todayYmd)
          )
        : [],
    [localEntries, matchesCategoryFilter, showEntryDerivedTasks, showEntryDerivedForAssignee, paymentDueFilters, todayYmd, showCompletedOnly]
  );

  const manualTodos = React.useMemo(() => {
    let rows = manual.filter(
      (m) =>
        !isDayIdeaReminder(m) &&
        !isSavedSpotReminder(m) &&
        !isJotterIdeaReminder(m) &&
        (m.reminderType === 'Manual' ||
        m.reminderType === 'ManualEntryTask' ||
        m.reminderType === 'Custom')
    );
    rows = rows.filter((m) => matchesTaskCompletionFilter(m.isComplete, taskCompletionFilter));
    rows = rows.filter(matchesReminderFilters);
    return sortRemindersByDueDate(rows, dueDateSort);
  }, [manual, taskCompletionFilter, matchesReminderFilters, dueDateSort]);

  const filteredManualTodos = React.useMemo(() => {
    let rows = manualTodos.filter((m) => matchesAnyTaskDueFilter(m.dueDate, taskDueFilters, todayYmd));
    if (tasksInsightFocus === 'no_assignee') {
      rows = rows.filter((m) => !(m.assignedTo || '').trim());
    }
    const q = taskSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((m) => {
        const hay = [
          reminderDisplayTitle(m),
          m.taskNote || '',
          m.assignedTo || '',
          m.taskCategory || '',
          m.reminderText || ''
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [manualTodos, taskDueFilters, todayYmd, tasksInsightFocus, taskSearch]);

  const cancellationReminders = React.useMemo(() => {
    let rows = manual.filter((m) => m.reminderType === 'CancellationDeadline');
    rows = rows.filter((m) => matchesTaskCompletionFilter(m.isComplete, taskCompletionFilter));
    rows = rows.filter(matchesReminderFilters);
    rows = rows.filter((m) => matchesAnyTaskDueFilter(m.dueDate, taskDueFilters, todayYmd));
    const q = taskSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((m) => {
        const hay = [reminderDisplayTitle(m), m.taskNote || '', m.assignedTo || '', m.reminderText || '']
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [manual, taskCompletionFilter, matchesReminderFilters, taskSearch, taskDueFilters, todayYmd]);

  React.useEffect(() => {
    const id = planView?.focusedReminderId;
    if (!id || viewMode !== 'list') return;
    scrollToReminderRow(id);
  }, [planView?.focusedReminderId, manualTodos, cancellationReminders, taskSectionFilter, viewMode]);

  const missingAmountEntries = React.useMemo(() => {
    return collectMissingAmountRows(localEntries)
      .filter((row) => {
        if (!taskCategoryFilters.length) return true;
        const cat = (row.category || 'Other').trim();
        return taskCategoryFilters.some((f) => f !== TASK_FILTER_UNCATEGORISED && f === cat);
      })
      .filter((row) => missingAmountFilter === 'all' || !dismissedMissing.has(row.id))
      .sort((a, b) => {
        const da = tripDays.find((d) => d.id === a.dayId)?.dayNumber ?? 0;
        const db = tripDays.find((d) => d.id === b.dayId)?.dayNumber ?? 0;
        if (da !== db) return da - db;
        if (a.openEntryId !== b.openEntryId) {
          return (a.parentTitle || a.title).localeCompare(b.parentTitle || b.title);
        }
        if (a.isOption !== b.isOption) return a.isOption ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [localEntries, tripDays, missingAmountFilter, dismissedMissing, taskCategoryFilters]);

  const dayName = React.useCallback((dayId?: string) => tripDays.find((d) => d.id === dayId)?.displayTitle || '', [tripDays]);

  const openEntryInItineraryRead = React.useCallback(
    (entryId: string, dayId: string, optionId?: string): void => {
      if (mobileLayout) {
        setPendingMobileItineraryOpen(entryId, dayId, optionId);
        window.dispatchEvent(new CustomEvent(GO_TO_DAY_EVENT, { detail: { dayId } }));
        return;
      }
      const returnLabel =
        variant === 'missing_costs'
          ? 'missing costs'
          : viewMode === 'calendar'
            ? 'calendar'
            : 'tasks list';
      setWorkspaceReturn({
        tab: 'plan',
        planMode: variant === 'missing_costs' ? 'missing_costs' : 'tasks',
        tasksViewMode: viewMode,
        label: returnLabel
      });
      setMainWorkspaceTab('itinerary');
      setSelectedDayId(dayId);
      setEditingCardId(null);
      setFocusedEntryId(entryId);
      if (optionId) {
        setEditingSubItem({ parentEntryId: entryId, subItemId: optionId });
      } else {
        setEditingSubItem(null);
      }
      requestSidebarDayFocus(dayId);
    },
    [
      mobileLayout,
      setEditingCardId,
      setEditingSubItem,
      setFocusedEntryId,
      setMainWorkspaceTab,
      setSelectedDayId,
      setWorkspaceReturn,
      variant,
      viewMode
    ]
  );

  const calendarEvents = React.useMemo((): CalendarEvent[] => {
    const out: CalendarEvent[] = [];
    for (const m of [...manualTodos, ...cancellationReminders].filter((x) => x.dueDate)) {
      const date = ymdFromIso(m.dueDate);
      if (!date) continue;
      out.push({
        id: `rem-${m.id}`,
        date,
        title: reminderDisplayTitle(m),
        kind: m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline' ? 'reminder' : 'task',
        entryId: m.entryId,
        dayId: m.dayId
      });
    }
    const derivedBookings = showCompletedOnly ? completedBookingTasks : bookingTasks;
    const derivedPayments = showCompletedOnly ? completedPaymentTasks : paymentTasks;
    for (const e of derivedBookings) {
      const date = e.bookingDueDate;
      if (date) {
        out.push({
          id: `book-${e.id}`,
          date,
          title: showCompletedOnly ? `Booked: ${e.title || 'Untitled'}` : `Book: ${e.title || 'Untitled'}`,
          kind: 'booking',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    for (const e of derivedPayments) {
      const date = e.paymentDueDate;
      if (date) {
        out.push({
          id: `pay-${e.id}`,
          date,
          title: showCompletedOnly ? `Paid: ${e.title || 'Untitled'}` : paymentDueTaskTitle(e),
          kind: 'payment',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    return out;
  }, [
    manualTodos,
    cancellationReminders,
    bookingTasks,
    paymentTasks,
    completedBookingTasks,
    completedPaymentTasks,
    showCompletedOnly
  ]);

  const showMissingCosts = variant === 'missing_costs';
  const showStandardSections = !showMissingCosts;
  const customRange = React.useMemo(
    () => ({ start: customRangeStart, end: customRangeEnd }),
    [customRangeStart, customRangeEnd]
  );

  const startEditReminder = React.useCallback((m: TripReminder): void => {
    if (!canEditManualTask(m.assignedTo)) return;
    setEditingReminderId(m.id);
    const raw = (m.reminderText || m.title || '').trim();
    setEditTitle(raw.replace(/^(Task|Reminder):\s*/i, ''));
    setEditDueDate(m.dueDate ? m.dueDate.slice(0, 10) : '');
    setEditNote((m.taskNote || '').trim());
    setEditAssignedTo((m.assignedTo || '').trim());
    const category = reminderTaskCategory(m) || 'Other';
    const known = taskCategoryOptions.some((x) => x.toLowerCase() === category.toLowerCase());
    if (known) {
      setEditTaskCategory(category);
      setEditCustomTaskCategory('');
    } else {
      setEditTaskCategory('__custom__');
      setEditCustomTaskCategory(category);
    }
  }, [canEditManualTask, taskCategoryOptions]);

  const saveEditReminder = React.useCallback(
    (m: TripReminder): void => {
      const trimmed = editTitle.trim();
      if (!trimmed) return;
      if (savingReminderId === m.id) return;
      const isReminder = m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline';
      const title = isReminder
        ? trimmed.startsWith('Reminder:')
          ? trimmed
          : `Reminder: ${trimmed}`
        : trimmed.startsWith('Task:')
          ? trimmed
          : `Task: ${trimmed}`;
      const resolvedCategory = resolveTaskCategorySelection(editTaskCategory, editCustomTaskCategory);
      setSavingReminderId(m.id);
      svc
        .update(m.id, {
          title,
          reminderText: trimmed,
          taskNote: editNote.trim(),
          taskCategory: resolvedCategory,
          assignedTo: editAssignedTo.trim() || undefined,
          dueDate: editDueDate ? `${editDueDate}T00:00:00.000Z` : undefined
        })
        .then(() => {
          if (trip?.id && editAssignedTo.trim()) rememberTripAssignee(trip.id, editAssignedTo);
          if (trip?.id && !isReminder) rememberTripTaskCategory(trip.id, resolvedCategory);
          setEditingReminderId(null);
          refresh();
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(err);
          window.alert(err instanceof Error ? err.message : 'Could not save task. Try again.');
        })
        .finally(() => setSavingReminderId(null));
    },
    [
      editDueDate,
      editNote,
      editTitle,
      editTaskCategory,
      editCustomTaskCategory,
      editAssignedTo,
      refresh,
      savingReminderId,
      svc,
      trip?.id
    ]
  );

  const toggleReminderComplete = React.useCallback(
    (m: TripReminder): void => {
      if (togglingCompleteId === m.id) return;
      const next = !m.isComplete;
      setTogglingCompleteId(m.id);
      setManual((prev) => prev.map((row) => (row.id === m.id ? { ...row, isComplete: next } : row)));
      svc
        .update(m.id, { isComplete: next })
        .then(() => {
          window.dispatchEvent(new CustomEvent('trip-reminders-updated'));
          refresh();
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(err);
          setManual((prev) => prev.map((row) => (row.id === m.id ? { ...row, isComplete: m.isComplete } : row)));
          window.alert(err instanceof Error ? err.message : 'Could not update task. Try again.');
        })
        .finally(() => setTogglingCompleteId(null));
    },
    [refresh, svc, togglingCompleteId]
  );

  const renderTaskNote = (note: string | undefined, titleForDedup: string): React.ReactNode => {
    const n = stripFollowUpPrefix((note || '').trim());
    if (!n) return null;
    const titleNorm = stripFollowUpPrefix(titleForDedup.replace(/^(Task|Reminder):\s*/i, '')).toLowerCase();
    if (n.toLowerCase() === titleNorm) return null;
    return (
      <div className={styles.noteCallout}>
        <span className={styles.noteCalloutLabel}>Notes</span>
        <p className={styles.noteCalloutText}>{n}</p>
      </div>
    );
  };

  const renderTaskNoteForRow = (
    note: string | undefined,
    titleForDedup: string,
    linkedEntry?: ItineraryEntry
  ): React.ReactNode => {
    const n = stripFollowUpPrefix((note || '').trim());
    if (!n) return null;
    const entryNotes = (linkedEntry?.notes || '').trim();
    if (entryNotes && n === entryNotes) return null;
    return renderTaskNote(note, titleForDedup);
  };

  const printTasks = React.useCallback((): void => {
    if (!trip) return;
    const sections: TasksPrintSection[] = [];
    if (showTaskSection('todo') && manualTodos.length) {
      sections.push({
        heading: 'To do',
        rows: manualTodos.map((m) => {
          const target = resolveReminderItineraryTarget(m, localEntries);
          const note = stripFollowUpPrefix((m.taskNote || '').trim());
          const entryNotes = (target?.entry?.notes || '').trim();
          return {
            title: reminderDisplayTitle(m),
            dueLine: m.dueDate ? formatReminderDueLabel(m.dueDate) : '',
            contextLine: target ? `${target.contextLine} · ${dayName(target.openDayId) || ''}` : '',
            note: entryNotes && note === entryNotes ? undefined : note || undefined,
            complete: m.isComplete
          };
        })
      });
    }
    openTasksPrintPreview(`${trip.title} — Tasks`, sections);
  }, [trip, manualTodos, localEntries, showTaskSection, dayName]);

  return (
    <section className={`${styles.root} ${mobileLayout ? styles.mobileRoot : ''}`} id="trip-tasks-print-root">
      <div className={`${styles.filterBar} ${styles.noPrint}`}>
        <div className={styles.filterBarMain}>
          {!mobileLayout ? <h2 className={styles.title}>Tasks &amp; reminders</h2> : null}
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              type="search"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
            />
            {mobileLayout && onOpenFilters ? (
              <button
                type="button"
                className={filtersOpen || filtersActive ? listStyles.filterBtnOn : listStyles.filterBtn}
                aria-expanded={filtersOpen}
                onClick={onOpenFilters}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Filters
              </button>
            ) : null}
          </div>
          <select className={styles.select} value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
            <option value="list">List</option>
            <option value="calendar">Calendar</option>
          </select>
          {viewMode === 'calendar' ? (
            <select className={styles.select} value={calendarLayout} onChange={(e) => setCalendarLayout(e.target.value as CalendarLayout)}>
              <option value="grid">Month grid</option>
              <option value="list">By date list</option>
            </select>
          ) : null}
          {viewMode === 'calendar' ? (
            <select className={styles.select} value={calendarRange} onChange={(e) => setCalendarRange(e.target.value as CalendarRangeFilter)}>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="next_week">Next week</option>
              <option value="next_month">Next month</option>
              <option value="all">All dates</option>
              <option value="custom">Custom range</option>
            </select>
          ) : null}
          {viewMode === 'calendar' && calendarRange === 'custom' ? (
            <div className={styles.customRange}>
              <label>
                From{' '}
                <input className={styles.input} type="date" value={customRangeStart} onChange={(e) => setCustomRangeStart(e.target.value)} />
              </label>
              <label>
                To{' '}
                <input className={styles.input} type="date" value={customRangeEnd} onChange={(e) => setCustomRangeEnd(e.target.value)} />
              </label>
            </div>
          ) : null}
        </div>
        {viewMode === 'list' && showStandardSections && !mobileLayout ? (
          <div className={styles.filterBarActions}>
            <button className={dayHeaderStyles.journalButton} type="button" onClick={printTasks}>
              Print
            </button>
          </div>
        ) : null}
      </div>

      {viewMode === 'calendar' && showStandardSections ? (
        <div className={styles.calendarDueFilters}>
          {showTaskSection('todo') ? (
            <DueFilterChips ariaLabel="Filter tasks by due date" value={taskDueFilters} onChange={setTaskDueFilters} />
          ) : null}
          {!showCompletedOnly && showTaskSection('bookings') ? (
            <DueFilterChips ariaLabel="Filter bookings by due date" value={bookingDueFilters} onChange={setBookingDueFilters} />
          ) : null}
          {!showCompletedOnly && showTaskSection('payments') ? (
            <DueFilterChips ariaLabel="Filter payments by due date" value={paymentDueFilters} onChange={setPaymentDueFilters} />
          ) : null}
        </div>
      ) : null}

      {viewMode === 'calendar' && showStandardSections ? (
        calendarLayout === 'grid' ? (
          <TasksMonthCalendar
            events={calendarEvents}
            rangeFilter={calendarRange}
            customRange={calendarRange === 'custom' ? customRange : undefined}
            tripStartYmd={trip?.dateStart?.slice(0, 10)}
            onOpenEntry={openEntryInItineraryRead}
          />
        ) : (
          <TasksCalendarView
            events={calendarEvents}
            rangeFilter={calendarRange}
            customRange={calendarRange === 'custom' ? customRange : undefined}
            onOpenEntry={openEntryInItineraryRead}
          />
        )
      ) : null}

      {showMissingCosts ? (
        <div className={styles.group}>
          <h3 className={styles.title}>Itinerary items with no cost entered</h3>
          <p className={styles.hint}>
            Cards and options where the amount is zero or blank (excluding Free and Location info). Mark as cost not required when
            no amount is needed, or open the item to add a cost.
          </p>
          <select
            className={styles.select}
            value={missingAmountFilter}
            onChange={(e) => setMissingAmountFilter(e.target.value as MissingAmountFilter)}
          >
            <option value="unchecked">Needs review only</option>
            <option value="all">All (including marked costs not required)</option>
          </select>
          {missingAmountEntries.length === 0 ? (
            <div className={styles.meta} role="status">
              No items missing amounts.
            </div>
          ) : (
            missingAmountEntries.map((row) => (
              <div key={row.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.missingTitle}>{row.title || 'Untitled'}</div>
                  <div className={styles.meta}>
                    {row.isOption ? 'Option · ' : null}
                    {row.category ? `${row.category} · ` : null}
                    {dayName(row.dayId) || 'Day'}
                    {row.isOption && row.parentTitle ? ` · on ${row.parentTitle}` : null}
                    {supplierMetaLine(row.supplier)}
                  </div>
                  {row.optionCostSummary ? (
                    <div className={styles.meta}>{row.optionCostSummary}</div>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() =>
                      openEntryInItineraryRead(row.openEntryId, row.dayId, row.isOption ? row.id : undefined)
                    }
                  >
                    Open in itinerary
                  </button>
                  {dismissedMissing.has(row.id) ? (
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => {
                        if (!trip?.id) return;
                        setDismissedMissing(restoreMissingAmountEntry(trip.id, row.id, dismissedMissing));
                      }}
                    >
                      Needs review
                    </button>
                  ) : (
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => {
                        if (!trip?.id) return;
                        setDismissedMissing(dismissMissingAmountEntry(trip.id, row.id, dismissedMissing));
                      }}
                    >
                      Cost not required
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {viewMode === 'list' && showStandardSections ? (
        <>
          {showTaskSection('todo') ? (
          <div className={styles.group}>
            {!showCompletedOnly ? (
              <>
            <h3 className={styles.composeHeading}>Add new task or reminder</h3>
            <div className={`${styles.filters} ${styles.addRow}`}>
              <select className={styles.select} value={createKind} onChange={(e) => setCreateKind(e.target.value as CreateKind)}>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
              </select>
              <input
                ref={addTaskInputRef}
                className={styles.input}
                placeholder={createKind === 'task' ? 'Task description' : 'Reminder text'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              {createKind === 'task' ? (
                <>
                  <select
                    className={styles.select}
                    value={createTaskCategory}
                    onChange={(e) => setCreateTaskCategory(e.target.value)}
                    aria-label="Task category"
                  >
                    {taskCategoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {createTaskCategory === '__custom__' ? (
                    <input
                      className={styles.input}
                      placeholder="Custom task type"
                      value={createCustomTaskCategory}
                      onChange={(e) => setCreateCustomTaskCategory(e.target.value)}
                      aria-label="Custom task type"
                    />
                  ) : null}
                </>
              ) : null}
              <input
                className={styles.input}
                placeholder="Assigned to (optional)"
                value={createAssignedTo}
                onChange={(e) => setCreateAssignedTo(e.target.value)}
                list="trip-task-assignees"
              />
              <datalist id="trip-task-assignees">
                {knownAssignees.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button
                className={`${styles.button} ${styles.addBtn}`}
                type="button"
                onClick={() => {
                  if (!trip?.id || !text.trim()) return;
                  const trimmed = text.trim();
                  const title =
                    createKind === 'task'
                      ? trimmed.startsWith('Task:')
                        ? trimmed
                        : `Task: ${trimmed}`
                      : trimmed.startsWith('Reminder:')
                        ? trimmed
                        : `Reminder: ${trimmed}`;
                  const resolvedCategory =
                    createKind === 'task'
                      ? resolveTaskCategorySelection(createTaskCategory, createCustomTaskCategory)
                      : undefined;
                  svc
                    .create({
                      title,
                      tripId: trip.id,
                      reminderType: createKind === 'task' ? 'Manual' : 'Custom',
                      reminderText: trimmed,
                      taskCategory: resolvedCategory,
                      assignedTo: createAssignedTo.trim() || undefined,
                      isComplete: false,
                      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
                      dayId: '',
                      entryId: ''
                    })
                    .then(() => {
                      if (createAssignedTo.trim()) rememberTripAssignee(trip.id, createAssignedTo);
                      if (createKind === 'task' && resolvedCategory) {
                        rememberTripTaskCategory(trip.id, resolvedCategory);
                      }
                      setText('');
                      setDueDate('');
                      setCreateAssignedTo('');
                      setCreateCustomTaskCategory('');
                      refresh();
                      window.dispatchEvent(new Event('trip-reminders-updated'));
                    })
                    .catch((err) => {
                      // eslint-disable-next-line no-console
                      console.error(err);
                      window.alert(
                        err instanceof Error
                          ? err.message
                          : `Could not save ${createKind === 'task' ? 'task' : 'reminder'}.`
                      );
                    });
                }}
              >
                Add {createKind === 'task' ? 'task' : 'reminder'}
              </button>
            </div>
              </>
            ) : null}
            <div className={styles.todoHeadingRow}>
              <h3 className={styles.todoHeading}>{showCompletedOnly ? 'Completed tasks' : 'To do'}</h3>
              <button
                type="button"
                className={styles.sortDueBtn}
                onClick={() =>
                  setDueDateSort((s) => (s === 'none' ? 'asc' : s === 'asc' ? 'desc' : 'none'))
                }
                title="Sort by due date"
              >
                Due date {dueDateSort === 'asc' ? '↑' : dueDateSort === 'desc' ? '↓' : '—'}
              </button>
            </div>
            <DueFilterChips ariaLabel="Filter tasks by due date" value={taskDueFilters} onChange={setTaskDueFilters} />
            {filteredManualTodos.length === 0 ? (
              <p className={styles.sectionHelp}>
                {showCompletedOnly ? 'No completed tasks yet.' : 'No tasks match these filters.'}
              </p>
            ) : null}
            {filteredManualTodos.map((m) => {
              const target = resolveReminderItineraryTarget(m, localEntries);
              const isEditing = editingReminderId === m.id;
              return (
                <div
                  key={m.id}
                  data-reminder-id={m.id}
                  className={`${styles.item} ${m.isComplete ? styles.itemComplete : ''} ${planView?.focusedReminderId === m.id ? styles.itemFocused : ''}`}
                >
                  {!isEditing ? (
                    <input
                      className={styles.completeCheck}
                      type="checkbox"
                      checked={m.isComplete}
                      aria-label={m.isComplete ? 'Mark incomplete' : 'Mark complete'}
                      onChange={() => toggleReminderComplete(m)}
                      disabled={togglingCompleteId === m.id}
                    />
                  ) : null}
                  <div className={styles.itemBody}>
                    {isEditing ? (
                      <div className={styles.editForm}>
                        <input
                          className={styles.input}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          aria-label="Task or reminder text"
                        />
                        <input
                          className={styles.input}
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          aria-label="Due date"
                        />
                        {m.reminderType === 'Manual' || m.reminderType === 'ManualEntryTask' ? (
                          <select
                            className={styles.select}
                            value={editTaskCategory}
                            onChange={(e) => setEditTaskCategory(e.target.value)}
                            aria-label="Category"
                          >
                            {taskCategoryOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                            <option value="__custom__">Custom…</option>
                          </select>
                        ) : null}
                        {(m.reminderType === 'Manual' || m.reminderType === 'ManualEntryTask') &&
                        editTaskCategory === '__custom__' ? (
                          <input
                            className={styles.input}
                            placeholder="Custom task type"
                            value={editCustomTaskCategory}
                            onChange={(e) => setEditCustomTaskCategory(e.target.value)}
                            aria-label="Custom task type"
                          />
                        ) : null}
                        <input
                          className={styles.input}
                          placeholder="Assigned to (optional)"
                          value={editAssignedTo}
                          onChange={(e) => setEditAssignedTo(e.target.value)}
                          list="trip-task-assignees-edit"
                        />
                        <datalist id="trip-task-assignees-edit">
                          {knownAssignees.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                        <textarea
                          className={styles.textarea}
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Note (optional)"
                          rows={2}
                        />
                      </div>
                    ) : (
                      <>
                        <div className={styles.itemTitleRow}>
                          <span>{reminderDisplayTitle(m)}</span>
                          {m.isComplete ? <span className={styles.completeBadge}>Complete</span> : null}
                        </div>
                        <div className={styles.meta}>
                          {m.dueDate ? formatReminderDueLabel(m.dueDate) : 'No due date'}
                          {m.assignedTo?.trim() ? (
                            <>
                              <span aria-hidden> · </span>
                              Assigned to {m.assignedTo.trim()}
                            </>
                          ) : null}
                        </div>
                        {renderTaskNoteForRow(m.taskNote, reminderDisplayTitle(m), target?.entry)}
                        {target ? (
                          <div className={styles.meta}>
                            {target.contextLine}
                            <span aria-hidden> · </span>
                            {dayName(target.openDayId) || 'Itinerary day'}
                            {supplierMetaLine(target.supplier)}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className={`${styles.iconActions} ${styles.noPrint}`}>
                    {isEditing ? (
                      <>
                        <button
                          className={styles.iconBtn}
                          type="button"
                          title="Save"
                          disabled={savingReminderId === m.id}
                          onClick={() => saveEditReminder(m)}
                        >
                          {savingReminderId === m.id ? '…' : '✓'}
                        </button>
                        <button className={styles.iconBtn} type="button" title="Cancel" onClick={() => setEditingReminderId(null)}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        {canEditManualTask(m.assignedTo) ? (
                        <button className={styles.iconBtn} type="button" title="Edit" onClick={() => startEditReminder(m)}>
                          ✎
                        </button>
                        ) : null}
                        {target ? (
                          <button
                            className={mobileLayout ? styles.iconBtn : `${styles.iconBtn} ${styles.iconBtnWide}`}
                            type="button"
                            title="Open linked itinerary item"
                            aria-label="Open in itinerary"
                            onClick={() => openEntryInItineraryRead(target.openEntryId, target.openDayId)}
                          >
                            <IconOpenInItinerary />
                            {mobileLayout ? null : 'Open'}
                          </button>
                        ) : null}
                        {canEditManualTask(m.assignedTo) ? (
                        <button
                          className={styles.iconBtn}
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction('Delete this task?'))) return;
                              svc.delete(m.id).then(refresh).catch(console.error);
                            })();
                          }}
                        >
                          <IconTrash />
                        </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          ) : null}

          {showTaskSection('bookings') ? (
          <div className={styles.group}>
            <h3 className={styles.title}>{showCompletedOnly ? 'Completed bookings' : 'Bookings needed'}</h3>
            {!showCompletedOnly ? (
              <DueFilterChips ariaLabel="Filter bookings by due date" value={bookingDueFilters} onChange={setBookingDueFilters} />
            ) : null}
            {(showCompletedOnly ? completedBookingTasks : bookingTasks).length === 0 ? (
              <p className={styles.sectionHelp}>
                {showCompletedOnly ? 'No completed bookings yet.' : 'No items need booking right now.'}
              </p>
            ) : null}
            {(showCompletedOnly ? completedBookingTasks : bookingTasks).map((entry) => (
              <div key={entry.id} className={styles.item}>
                {!showCompletedOnly ? (
                  <input
                    className={styles.completeCheck}
                    type="checkbox"
                    aria-label="Mark booked"
                    onChange={() => void updateEntry({ ...entry, bookingStatus: 'Booked' })}
                  />
                ) : (
                  <span className={styles.completeCheck} aria-hidden>✓</span>
                )}
                <div className={styles.itemBody}>
                  <div>{showCompletedOnly ? `Booked: ${entry.title}` : `Book: ${entry.title}`}</div>
                  <div className={styles.meta}>
                    {dayName(entry.dayId)}
                    {supplierMetaLine(entry.supplier)}
                  </div>
                  {!showCompletedOnly ? (
                    <label className={styles.dueLabel}>
                      Book by{' '}
                      <input
                        className={styles.input}
                        type="date"
                        value={entry.bookingDueDate?.slice(0, 10) || ''}
                        onChange={(e) => void updateEntry({ ...entry, bookingDueDate: e.target.value || undefined })}
                      />
                    </label>
                  ) : null}
                </div>
                <div className={`${styles.iconActions} ${styles.noPrint}`}>
                  <button
                    className={mobileLayout ? styles.iconBtn : `${styles.iconBtn} ${styles.iconBtnWide}`}
                    type="button"
                    title="Open linked itinerary item"
                    aria-label="Open in itinerary"
                    onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}
                  >
                    <IconOpenInItinerary />
                    {mobileLayout ? null : 'Open'}
                  </button>
                  {!showCompletedOnly ? (
                    <button
                      className={styles.iconBtn}
                      type="button"
                      title="Mark booked"
                      onClick={() => void updateEntry({ ...entry, bookingStatus: 'Booked' })}
                    >
                      ✓
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          ) : null}

          {showTaskSection('payments') ? (
          <div className={styles.group}>
            <h3 className={styles.title}>{showCompletedOnly ? 'Completed payments' : 'Payments due'}</h3>
            {!showCompletedOnly ? (
              <DueFilterChips ariaLabel="Filter payments by due date" value={paymentDueFilters} onChange={setPaymentDueFilters} />
            ) : null}
            {(showCompletedOnly ? completedPaymentTasks : paymentTasks).length === 0 ? (
              <p className={styles.sectionHelp}>
                {showCompletedOnly ? 'No completed payments yet.' : 'No outstanding payments.'}
              </p>
            ) : null}
            {(showCompletedOnly ? completedPaymentTasks : paymentTasks).map((entry) => (
              <div key={entry.id} className={styles.item}>
                {!showCompletedOnly ? (
                  <input
                    className={styles.completeCheck}
                    type="checkbox"
                    aria-label="Mark paid"
                    onChange={() => void updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}
                  />
                ) : (
                  <span className={styles.completeCheck} aria-hidden>✓</span>
                )}
                <div className={styles.itemBody}>
                  <div>
                    {showCompletedOnly
                      ? `Paid: ${entry.title}`
                      : entry.paymentStatus === 'Part paid'
                        ? `Pay balance: ${entry.title}`
                        : paymentDueTaskTitle(entry)}{' '}
                    {!showCompletedOnly ? `(${Math.max(0, entry.amount - (entry.amountPaid || 0)).toFixed(2)})` : null}
                  </div>
                  <div className={styles.meta}>
                    {dayName(entry.dayId)}
                    {supplierMetaLine(entry.supplier)}
                  </div>
                  {!showCompletedOnly ? (
                    <>
                    <label className={styles.dueLabel}>
                      Pay by{' '}
                      <input
                        className={styles.input}
                        type="date"
                        value={paymentDueDateInputValue(entry)}
                        onChange={(e) =>
                          void updateEntry({
                            ...entry,
                            ...(e.target.value ? setPaymentDuePatch(e.target.value) : clearPaymentDuePatch())
                          })
                        }
                      />
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Clear due date"
                        onClick={() => void updateEntry({ ...entry, ...clearPaymentDuePatch() })}
                      >
                        Clear
                      </button>
                    </label>
                    <label className={styles.dueLabel}>
                      <input
                        type="checkbox"
                        checked={entry.payOnsite === true}
                        onChange={(e) =>
                          void updateEntry({
                            ...entry,
                            payOnsite: e.target.checked,
                            ...(e.target.checked ? clearPaymentDuePatch() : {})
                          })
                        }
                      />{' '}
                      Pay onsite
                    </label>
                    </>
                  ) : null}
                  {!showCompletedOnly ? <div className={styles.meta}>{paymentDueDateHint(entry)}</div> : null}
                </div>
                <div className={`${styles.iconActions} ${styles.noPrint}`}>
                  <button
                    className={mobileLayout ? styles.iconBtn : `${styles.iconBtn} ${styles.iconBtnWide}`}
                    type="button"
                    title="Open linked itinerary item"
                    aria-label="Open in itinerary"
                    onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}
                  >
                    <IconOpenInItinerary />
                    {mobileLayout ? null : 'Open'}
                  </button>
                  <button
                    className={styles.iconBtn}
                    type="button"
                    title="Mark paid"
                    onClick={() => void updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
          ) : null}

          {showTaskSection('cancellations') ? (
          <div className={styles.group}>
            <h3 className={styles.title}>
              {showCompletedOnly ? 'Completed cancellation reminders' : 'Cancellation deadline reminders'}
            </h3>
            {cancellationReminders.length === 0 ? (
              <p className={styles.sectionHelp}>
                {showCompletedOnly ? 'No completed cancellation reminders.' : 'No cancellation reminders.'}
              </p>
            ) : (
              cancellationReminders.map((m) => {
                const target = resolveReminderItineraryTarget(m, localEntries);
                return (
                  <div
                    key={m.id}
                    data-reminder-id={m.id}
                    className={`${styles.item} ${m.isComplete ? styles.itemComplete : ''} ${planView?.focusedReminderId === m.id ? styles.itemFocused : ''}`}
                  >
                    <input
                      className={styles.completeCheck}
                      type="checkbox"
                      checked={m.isComplete}
                      aria-label={m.isComplete ? 'Mark incomplete' : 'Mark complete'}
                      onChange={() => toggleReminderComplete(m)}
                      disabled={togglingCompleteId === m.id}
                    />
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitleRow}>
                        <span>{reminderDisplayTitle(m)}</span>
                        {m.isComplete ? <span className={styles.completeBadge}>Complete</span> : null}
                      </div>
                      <div className={styles.meta}>
                        {m.dueDate ? formatReminderDueLabel(m.dueDate) : 'No due date'}
                        {m.assignedTo?.trim() ? (
                          <>
                            <span aria-hidden> · </span>
                            Assigned to {m.assignedTo.trim()}
                          </>
                        ) : null}
                      </div>
                      {renderTaskNoteForRow(m.taskNote, reminderDisplayTitle(m), target?.entry)}
                      {target ? (
                        <div className={styles.meta}>
                          {target.contextLine}
                          <span aria-hidden> · </span>
                          {dayName(target.openDayId) || 'Itinerary day'}
                        </div>
                      ) : null}
                    </div>
                    <div className={`${styles.iconActions} ${styles.noPrint}`}>
                      {target ? (
                        <button
                          className={mobileLayout ? styles.iconBtn : `${styles.iconBtn} ${styles.iconBtnWide}`}
                          type="button"
                          title="Open linked itinerary item"
                          aria-label="Open in itinerary"
                          onClick={() => openEntryInItineraryRead(target.openEntryId, target.openDayId)}
                        >
                          <IconOpenInItinerary />
                          {mobileLayout ? null : 'Open'}
                        </button>
                      ) : null}
                      <button
                        className={styles.iconBtn}
                        type="button"
                        title="Edit"
                        disabled={!canEditManualTask(m.assignedTo)}
                        onClick={() => startEditReminder(m)}
                      >
                        ✎
                      </button>
                      {canEditManualTask(m.assignedTo) ? (
                      <button
                        className={styles.iconBtn}
                        type="button"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => {
                          void (async () => {
                            if (!(await confirmUserAction('Delete this reminder?'))) return;
                            svc.delete(m.id).then(refresh).catch(console.error);
                          })();
                        }}
                      >
                        <IconTrash />
                      </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

