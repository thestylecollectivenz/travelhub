import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService, TripReminder } from '../../services/ReminderService';
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
import { paymentDueTaskTitle, paymentDueDateHint } from '../../utils/paymentDueLabels';
import { CATEGORY_LIST } from '../../utils/categoryUtils';
import { confirmUserAction } from '../../utils/confirmAction';
import { loadTripAssignees, rememberTripAssignee } from '../../utils/tripAssignees';
import { reminderTaskCategory, TASK_FILTER_UNCATEGORISED } from '../../utils/taskFilters';
import { openTasksPrintPreview, type TasksPrintSection } from '../../utils/tasksPrintHtml';
import { localTodayYmd, matchesTaskDueFilter, type TaskDueFilter } from '../../utils/taskDueBuckets';
import dayHeaderStyles from '../day/DayHeader.module.css';
import styles from './TripTasksView.module.css';

type TaskFilter = 'incomplete' | 'all';

export interface TripTasksViewProps {
  variant?: 'tasks' | 'missing_costs';
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

function entryAmountMissing(amount: number | undefined): boolean {
  if (amount === undefined || amount === null) return true;
  if (typeof amount !== 'number' || Number.isNaN(amount)) return true;
  return amount <= 0;
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
): { openEntryId: string; openDayId: string; contextLine: string; entry?: ItineraryEntry } | undefined {
  const eid = (m.entryId || '').trim();
  if (!eid) return undefined;
  const parent = localEntries.find((e) => e.id === eid);
  if (parent) {
    return {
      openEntryId: parent.id,
      openDayId: parent.dayId,
      contextLine: `${parent.category ? `${parent.category} · ` : ''}${parent.title || 'Untitled'}`,
      entry: parent
    };
  }
  for (const p of localEntries) {
    const sub = p.subItems?.find((s) => s.id === eid);
    if (sub) {
      return {
        openEntryId: p.id,
        openDayId: p.dayId,
        contextLine: `Option: ${sub.title || 'Untitled'} · under ${p.title || 'Item'}`,
        entry: p
      };
    }
  }
  return undefined;
}

function ymdFromIso(iso?: string): string {
  return (iso || '').slice(0, 10);
}

export const TripTasksView: React.FC<TripTasksViewProps> = ({ variant = 'tasks' }) => {
  const spContext = useSpContext();
  const {
    trip,
    localEntries,
    tripDays,
    updateEntry,
    setSelectedDayId,
    setEditingCardId,
    setFocusedEntryId,
    setMainWorkspaceTab,
    setWorkspaceReturn
  } = useTripWorkspace();
  const planView = usePlanView();
  const [manual, setManual] = React.useState<TripReminder[]>([]);
  const [filter, setFilter] = React.useState<TaskFilter>('incomplete');
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
  const [createAssignedTo, setCreateAssignedTo] = React.useState('');
  const [createTaskCategory, setCreateTaskCategory] = React.useState('Other');
  const [dueDateSort, setDueDateSort] = React.useState<DueDateSort>('none');
  const [taskDueFilter, setTaskDueFilter] = React.useState<TaskDueFilter>('all');
  const [paymentDueFilter, setPaymentDueFilter] = React.useState<TaskDueFilter>('all');
  const todayYmd = React.useMemo(() => localTodayYmd(), []);

  const taskCategoryFilter = planView?.taskCategoryFilter ?? null;
  const taskAssigneeFilter = planView?.taskAssigneeFilter ?? null;
  const taskSectionFilter = planView?.taskSectionFilter ?? null;
  const showTaskSection = React.useCallback(
    (key: 'todo' | 'bookings' | 'payments' | 'cancellations') => !taskSectionFilter || taskSectionFilter === key,
    [taskSectionFilter]
  );
  const knownAssignees = React.useMemo(
    () => (trip?.id ? loadTripAssignees(trip.id) : []),
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
      if (!taskCategoryFilter) return true;
      if (taskCategoryFilter === TASK_FILTER_UNCATEGORISED) return false;
      return (entry.category || 'Other').trim() === taskCategoryFilter;
    },
    [taskCategoryFilter]
  );

  const showEntryDerivedTasks = !taskCategoryFilter || taskCategoryFilter !== TASK_FILTER_UNCATEGORISED;
  const showEntryDerivedForAssignee = !taskAssigneeFilter;

  const matchesAssigneeFilter = React.useCallback(
    (assignedTo?: string): boolean => {
      if (!taskAssigneeFilter) return true;
      return (assignedTo || '').trim() === taskAssigneeFilter;
    },
    [taskAssigneeFilter]
  );

  const matchesReminderFilters = React.useCallback(
    (m: TripReminder): boolean => {
      if (!matchesAssigneeFilter(m.assignedTo)) return false;
      if (!taskCategoryFilter) return true;
      const target = resolveReminderItineraryTarget(m, localEntries);
      const cat = reminderTaskCategory(m, target?.entry?.category);
      if (taskCategoryFilter === TASK_FILTER_UNCATEGORISED) return !cat;
      return cat === taskCategoryFilter;
    },
    [taskCategoryFilter, taskAssigneeFilter, localEntries, matchesAssigneeFilter]
  );

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    svc.getForTrip(trip.id).then(setManual).catch(console.error);
  }, [svc, trip?.id]);

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
      showEntryDerivedTasks && showEntryDerivedForAssignee
        ? localEntries.filter(
            (e) => e.bookingRequired && e.bookingStatus === 'Not booked' && matchesCategoryFilter(e)
          )
        : [],
    [localEntries, matchesCategoryFilter, showEntryDerivedTasks, showEntryDerivedForAssignee]
  );
  const paymentTasks = React.useMemo(
    () =>
      showEntryDerivedTasks && showEntryDerivedForAssignee
        ? localEntries.filter(
            (e) =>
              ((e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid') &&
              matchesCategoryFilter(e) &&
              matchesTaskDueFilter(e.paymentDueDate, paymentDueFilter, todayYmd)
          )
        : [],
    [localEntries, matchesCategoryFilter, showEntryDerivedTasks, showEntryDerivedForAssignee, paymentDueFilter, todayYmd]
  );

  const manualTodos = React.useMemo(() => {
    let rows = manual.filter(
      (m) =>
        m.reminderType === 'Manual' ||
        m.reminderType === 'ManualEntryTask' ||
        m.reminderType === 'Custom'
    );
    if (filter === 'incomplete') rows = rows.filter((m) => !m.isComplete);
    rows = rows.filter(matchesReminderFilters);
    return sortRemindersByDueDate(rows, dueDateSort);
  }, [manual, filter, matchesReminderFilters, dueDateSort]);

  const filteredManualTodos = React.useMemo(
    () => manualTodos.filter((m) => matchesTaskDueFilter(m.dueDate, taskDueFilter, todayYmd)),
    [manualTodos, taskDueFilter, todayYmd]
  );

  const cancellationReminders = React.useMemo(() => {
    let rows = manual.filter((m) => m.reminderType === 'CancellationDeadline');
    if (filter === 'incomplete') rows = rows.filter((m) => !m.isComplete);
    return rows.filter(matchesReminderFilters);
  }, [manual, filter, matchesReminderFilters]);

  React.useEffect(() => {
    const id = planView?.focusedReminderId;
    if (!id || viewMode !== 'list') return;
    scrollToReminderRow(id);
  }, [planView?.focusedReminderId, manualTodos, cancellationReminders, taskSectionFilter, viewMode]);

  const missingAmountEntries = React.useMemo(() => {
    return localEntries
      .filter((e) => entryAmountMissing(e.amount))
      .filter((e) => matchesCategoryFilter(e))
      .filter((e) => missingAmountFilter === 'all' || !dismissedMissing.has(e.id))
      .sort((a, b) => {
        const da = tripDays.find((d) => d.id === a.dayId)?.dayNumber ?? 0;
        const db = tripDays.find((d) => d.id === b.dayId)?.dayNumber ?? 0;
        if (da !== db) return da - db;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [localEntries, tripDays, missingAmountFilter, dismissedMissing, matchesCategoryFilter]);

  const dayName = React.useCallback((dayId?: string) => tripDays.find((d) => d.id === dayId)?.displayTitle || '', [tripDays]);

  const openEntryInItineraryRead = React.useCallback(
    (entryId: string, dayId: string): void => {
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
      requestSidebarDayFocus(dayId);
    },
    [
      setEditingCardId,
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
    for (const m of [...manualTodos, ...cancellationReminders].filter((x) => !x.isComplete && x.dueDate)) {
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
    for (const e of bookingTasks) {
      if (e.bookingDueDate) {
        out.push({
          id: `book-${e.id}`,
          date: e.bookingDueDate,
          title: `Book: ${e.title || 'Untitled'}`,
          kind: 'booking',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    for (const e of paymentTasks) {
      if (e.paymentDueDate) {
        out.push({
          id: `pay-${e.id}`,
          date: e.paymentDueDate,
          title: paymentDueTaskTitle(e),
          kind: 'payment',
          entryId: e.id,
          dayId: e.dayId
        });
      }
    }
    return out;
  }, [manualTodos, cancellationReminders, bookingTasks, paymentTasks]);

  const showMissingCosts = variant === 'missing_costs';
  const showStandardSections = !showMissingCosts;
  const customRange = React.useMemo(
    () => ({ start: customRangeStart, end: customRangeEnd }),
    [customRangeStart, customRangeEnd]
  );

  const startEditReminder = React.useCallback((m: TripReminder): void => {
    setEditingReminderId(m.id);
    const raw = (m.reminderText || m.title || '').trim();
    setEditTitle(raw.replace(/^(Task|Reminder):\s*/i, ''));
    setEditDueDate(m.dueDate ? m.dueDate.slice(0, 10) : '');
    setEditNote((m.taskNote || '').trim());
    setEditAssignedTo((m.assignedTo || '').trim());
    setEditTaskCategory(reminderTaskCategory(m) || 'Other');
  }, []);

  const saveEditReminder = React.useCallback(
    (m: TripReminder): void => {
      const trimmed = editTitle.trim();
      if (!trimmed) return;
      const isReminder = m.reminderType === 'Custom' || m.reminderType === 'CancellationDeadline';
      const title = isReminder
        ? trimmed.startsWith('Reminder:')
          ? trimmed
          : `Reminder: ${trimmed}`
        : trimmed.startsWith('Task:')
          ? trimmed
          : `Task: ${trimmed}`;
      svc
        .update(m.id, {
          title,
          reminderText: trimmed,
          taskNote: editNote.trim(),
          taskCategory: editTaskCategory,
          assignedTo: editAssignedTo.trim() || undefined,
          dueDate: editDueDate ? `${editDueDate}T00:00:00.000Z` : undefined
        })
        .then(() => {
          if (trip?.id && editAssignedTo.trim()) rememberTripAssignee(trip.id, editAssignedTo);
          setEditingReminderId(null);
          refresh();
        })
        .catch(console.error);
    },
    [editDueDate, editNote, editTitle, editTaskCategory, editAssignedTo, refresh, svc, trip?.id]
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
            dueLine: m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString('en-NZ')}` : '',
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
    <section className={styles.root} id="trip-tasks-print-root">
      <div className={`${styles.filterBar} ${styles.noPrint}`}>
        <div className={styles.filterBarMain}>
          <h2 className={styles.title}>Tasks &amp; reminders</h2>
          {showStandardSections ? (
            <select className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value as TaskFilter)}>
              <option value="incomplete">Incomplete only</option>
              <option value="all">All</option>
            </select>
          ) : null}
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
        {viewMode === 'list' && showStandardSections ? (
          <div className={styles.filterBarActions}>
            <button className={dayHeaderStyles.journalButton} type="button" onClick={printTasks}>
              Print
            </button>
          </div>
        ) : null}
      </div>

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
            Items where the main amount is zero or blank. Mark as cost not required when no amount is needed, or open the item to
            add a cost.
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
            missingAmountEntries.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.missingTitle}>{entry.title || 'Untitled'}</div>
                  <div className={styles.meta}>
                    {entry.category ? `${entry.category} · ` : null}
                    {dayName(entry.dayId) || 'Day'}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}>
                    Open in itinerary
                  </button>
                  {dismissedMissing.has(entry.id) ? (
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => {
                        if (!trip?.id) return;
                        setDismissedMissing(restoreMissingAmountEntry(trip.id, entry.id, dismissedMissing));
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
                        setDismissedMissing(dismissMissingAmountEntry(trip.id, entry.id, dismissedMissing));
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
            <h3 className={styles.composeHeading}>Add new task or reminder</h3>
            <div className={`${styles.filters} ${styles.addRow}`}>
              <select className={styles.select} value={createKind} onChange={(e) => setCreateKind(e.target.value as CreateKind)}>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
              </select>
              <input
                className={styles.input}
                placeholder={createKind === 'task' ? 'Task description' : 'Reminder text'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              {createKind === 'task' ? (
                <select
                  className={styles.select}
                  value={createTaskCategory}
                  onChange={(e) => setCreateTaskCategory(e.target.value)}
                  aria-label="Task category"
                >
                  {CATEGORY_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
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
                  svc
                    .create({
                      title,
                      tripId: trip.id,
                      reminderType: createKind === 'task' ? 'Manual' : 'Custom',
                      reminderText: trimmed,
                      taskCategory: createKind === 'task' ? createTaskCategory : undefined,
                      assignedTo: createAssignedTo.trim() || undefined,
                      isComplete: false,
                      dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
                      dayId: '',
                      entryId: ''
                    })
                    .then(() => {
                      if (createAssignedTo.trim()) rememberTripAssignee(trip.id, createAssignedTo);
                      setText('');
                      setDueDate('');
                      setCreateAssignedTo('');
                      refresh();
                    })
                    .catch(console.error);
                }}
              >
                Add {createKind === 'task' ? 'task' : 'reminder'}
              </button>
            </div>
            <div className={styles.todoHeadingRow}>
              <h3 className={styles.todoHeading}>To do</h3>
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
            <div className={styles.dueFilterRow} role="group" aria-label="Filter tasks by due date">
              {(['all', 'overdue', 'today', 'tomorrow'] as TaskDueFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={taskDueFilter === key ? styles.dueFilterChipActive : styles.dueFilterChip}
                  onClick={() => setTaskDueFilter(key)}
                >
                  {key === 'all' ? 'All' : key === 'overdue' ? 'Overdue' : key === 'today' ? 'Due today' : 'Due tomorrow'}
                </button>
              ))}
            </div>
            {filteredManualTodos.map((m) => {
              const target = resolveReminderItineraryTarget(m, localEntries);
              const isEditing = editingReminderId === m.id;
              return (
                <div
                  key={m.id}
                  data-reminder-id={m.id}
                  className={`${styles.item} ${planView?.focusedReminderId === m.id ? styles.itemFocused : ''}`}
                >
                  {!isEditing ? (
                    <input
                      className={styles.completeCheck}
                      type="checkbox"
                      checked={m.isComplete}
                      aria-label={m.isComplete ? 'Mark incomplete' : 'Mark complete'}
                      onChange={() => svc.update(m.id, { isComplete: !m.isComplete }).then(refresh).catch(console.error)}
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
                            {CATEGORY_LIST.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
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
                        <div>{reminderDisplayTitle(m)}</div>
                        <div className={styles.meta}>
                          {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString('en-NZ')}` : 'No due date'}
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
                      </>
                    )}
                  </div>
                  <div className={`${styles.iconActions} ${styles.noPrint}`}>
                    {isEditing ? (
                      <>
                        <button className={styles.iconBtn} type="button" title="Save" onClick={() => saveEditReminder(m)}>
                          ✓
                        </button>
                        <button className={styles.iconBtn} type="button" title="Cancel" onClick={() => setEditingReminderId(null)}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button className={styles.iconBtn} type="button" title="Edit" onClick={() => startEditReminder(m)}>
                          ✎
                        </button>
                        {target ? (
                          <button
                            className={styles.iconBtn}
                            type="button"
                            title="Open in itinerary"
                            onClick={() => openEntryInItineraryRead(target.openEntryId, target.openDayId)}
                          >
                            ↗
                          </button>
                        ) : null}
                        <button
                          className={styles.iconBtn}
                          type="button"
                          title="Delete"
                          onClick={() => {
                            void (async () => {
                              if (!(await confirmUserAction('Delete this task?'))) return;
                              svc.delete(m.id).then(refresh).catch(console.error);
                            })();
                          }}
                        >
                          🗑
                        </button>
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
            <h3 className={styles.title}>Bookings needed</h3>
            {bookingTasks.length === 0 ? (
              <p className={styles.sectionHelp}>No items need booking right now.</p>
            ) : null}
            {bookingTasks.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <input
                  className={styles.completeCheck}
                  type="checkbox"
                  aria-label="Mark booked"
                  onChange={() => updateEntry({ ...entry, bookingStatus: 'Booked' })}
                />
                <div className={styles.itemBody}>
                  <div>Book: {entry.title}</div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                  <label className={styles.dueLabel}>
                    Book by{' '}
                    <input
                      className={styles.input}
                      type="date"
                      value={entry.bookingDueDate?.slice(0, 10) || ''}
                      onChange={(e) => updateEntry({ ...entry, bookingDueDate: e.target.value || undefined })}
                    />
                  </label>
                </div>
                <div className={`${styles.iconActions} ${styles.noPrint}`}>
                  <button
                    className={styles.iconBtn}
                    type="button"
                    title="Open in itinerary"
                    onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}
                  >
                    ↗
                  </button>
                  <button
                    className={styles.iconBtn}
                    type="button"
                    title="Mark booked"
                    onClick={() => updateEntry({ ...entry, bookingStatus: 'Booked' })}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
          ) : null}

          {showTaskSection('payments') ? (
          <div className={styles.group}>
            <h3 className={styles.title}>Payments due</h3>
            <div className={styles.dueFilterRow} role="group" aria-label="Filter payments by due date">
              {(['all', 'overdue', 'today', 'tomorrow'] as TaskDueFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={paymentDueFilter === key ? styles.dueFilterChipActive : styles.dueFilterChip}
                  onClick={() => setPaymentDueFilter(key)}
                >
                  {key === 'all' ? 'All' : key === 'overdue' ? 'Overdue' : key === 'today' ? 'Due today' : 'Due tomorrow'}
                </button>
              ))}
            </div>
            {paymentTasks.length === 0 ? (
              <p className={styles.sectionHelp}>No outstanding payments.</p>
            ) : null}
            {paymentTasks.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <input
                  className={styles.completeCheck}
                  type="checkbox"
                  aria-label="Mark paid"
                  onChange={() => updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}
                />
                <div className={styles.itemBody}>
                  <div>
                    {entry.paymentStatus === 'Part paid'
                      ? `Pay balance: ${entry.title}`
                      : paymentDueTaskTitle(entry)}{' '}
                    ({Math.max(0, entry.amount - (entry.amountPaid || 0)).toFixed(2)})
                  </div>
                  <div className={styles.meta}>{dayName(entry.dayId)}</div>
                  <label className={styles.dueLabel}>
                    Pay by{' '}
                    <input
                      className={styles.input}
                      type="date"
                      value={entry.paymentDueDate?.slice(0, 10) || ''}
                      onChange={(e) => updateEntry({ ...entry, paymentDueDate: e.target.value || undefined })}
                    />
                  </label>
                  <label className={styles.dueLabel}>
                    Payment timing{' '}
                    <select
                      className={styles.input}
                      value={entry.paymentDueType || 'Manual'}
                      onChange={(e) =>
                        updateEntry({
                          ...entry,
                          paymentDueType: e.target.value as typeof entry.paymentDueType
                        })
                      }
                    >
                      <option value="Manual">Manual payment</option>
                      <option value="Automatic">Auto-charge</option>
                    </select>
                  </label>
                  <div className={styles.meta}>{paymentDueDateHint(entry)}</div>
                </div>
                <div className={`${styles.iconActions} ${styles.noPrint}`}>
                  <button
                    className={styles.iconBtn}
                    type="button"
                    title="Open in itinerary"
                    onClick={() => openEntryInItineraryRead(entry.id, entry.dayId)}
                  >
                    ↗
                  </button>
                  <button
                    className={styles.iconBtn}
                    type="button"
                    title="Mark paid"
                    onClick={() => updateEntry({ ...entry, paymentStatus: 'Fully paid', amountPaid: entry.amount })}
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
            <h3 className={styles.title}>Cancellation deadline reminders</h3>
            {cancellationReminders.length === 0 ? (
              <p className={styles.sectionHelp}>No cancellation reminders.</p>
            ) : (
              cancellationReminders.map((m) => {
                const target = resolveReminderItineraryTarget(m, localEntries);
                return (
                  <div
                    key={m.id}
                    data-reminder-id={m.id}
                    className={`${styles.item} ${planView?.focusedReminderId === m.id ? styles.itemFocused : ''}`}
                  >
                    <input
                      className={styles.completeCheck}
                      type="checkbox"
                      checked={m.isComplete}
                      aria-label={m.isComplete ? 'Mark incomplete' : 'Mark complete'}
                      onChange={() => svc.update(m.id, { isComplete: !m.isComplete }).then(refresh).catch(console.error)}
                    />
                    <div className={styles.itemBody}>
                      <div>{reminderDisplayTitle(m)}</div>
                      <div className={styles.meta}>
                        {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleString('en-NZ')}` : 'No due date'}
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
                          className={styles.iconBtn}
                          type="button"
                          title="Open in itinerary"
                          onClick={() => openEntryInItineraryRead(target.openEntryId, target.openDayId)}
                        >
                          ↗
                        </button>
                      ) : null}
                      <button
                        className={styles.iconBtn}
                        type="button"
                        title="Edit"
                        onClick={() => startEditReminder(m)}
                      >
                        ✎
                      </button>
                      <button
                        className={styles.iconBtn}
                        type="button"
                        title="Delete"
                        onClick={() => {
                          void (async () => {
                            if (!(await confirmUserAction('Delete this reminder?'))) return;
                            svc.delete(m.id).then(refresh).catch(console.error);
                          })();
                        }}
                      >
                        🗑
                      </button>
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

