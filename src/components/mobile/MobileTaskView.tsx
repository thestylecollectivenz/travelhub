import * as React from 'react';
import { PlanViewProvider, usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { useTripRole } from '../../context/TripRoleContext';
import { ReminderService } from '../../services/ReminderService';
import {
  dueYmdBucket,
  isAllTaskDueFilters,
  localTodayYmd,
  ymdFromIso,
  type TaskDueFilter
} from '../../utils/taskDueBuckets';
import { isDayIdeaReminder } from '../../utils/dayIdeas';
import { isJotterIdeaReminder } from '../../utils/tripJotterIdeas';
import { isSavedSpotReminder } from '../../utils/tripSavedSpots';
import type { TaskCompletionFilter } from '../../utils/taskFilters';
import { TripTasksView } from '../tasks/TripTasksView';
import { useOfflineStatus } from '../../context/OfflineStatusContext';
import { loadTripOfflineCache, patchTripOfflineExtrasCache } from '../../utils/tripOfflineCache';
import { isLikelyNetworkError } from '../../utils/networkError';
import { MobileTaskFiltersDrawer } from './MobileTaskFiltersDrawer';
import { useShellMode } from '../../hooks/useShellMode';
import chrome from './MobileTabChrome.module.css';

function StatIcon({ children, tone }: { children: React.ReactNode; tone: 'olive' | 'rust' | 'navy' | 'tan' }): React.ReactElement {
  const cls =
    tone === 'olive' ? chrome.statIconOlive : tone === 'rust' ? chrome.statIconRust : tone === 'tan' ? chrome.statIconTan : chrome.statIconNavy;
  return <span className={`${chrome.statIcon} ${cls}`}>{children}</span>;
}

type StatKey = 'open' | 'overdue' | 'today' | 'done';

const NO_DUE_FILTERS: TaskDueFilter[] = [];

/** Stat cards only light up for the single-bucket selections they set. */
function activeStat(completion: TaskCompletionFilter, due: TaskDueFilter[]): StatKey | null {
  if (completion === 'completed') return 'done';
  if (completion !== 'incomplete') return null;
  if (isAllTaskDueFilters(due)) return 'open';
  if (due.length !== 1) return null;
  if (due[0] === 'overdue') return 'overdue';
  if (due[0] === 'today') return 'today';
  return null;
}

const MobileTaskBody: React.FC<{ hideChrome?: boolean }> = ({ hideChrome }) => {
  const { trip, localEntries } = useTripWorkspace();
  const spContext = useSpContext();
  const { reportNetworkFailure } = useOfflineStatus();
  const shellMode = useShellMode();
  const planView = usePlanView();
  const { role } = useTripRole();
  const { members, travellers } = useTripMembers(trip?.id);
  useCompanionListDefaults(planView, role, members);

  const [openCount, setOpenCount] = React.useState(0);
  const [overdueCount, setOverdueCount] = React.useState(0);
  const [dueTodayCount, setDueTodayCount] = React.useState(0);
  const [doneCount, setDoneCount] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [manualCategories, setManualCategories] = React.useState<string[]>([]);
  const [hasUncategorised, setHasUncategorised] = React.useState(false);

  const completion = planView?.taskCompletionFilter ?? 'all';
  const due = planView?.taskDueFilters ?? NO_DUE_FILTERS;
  const selected = activeStat(completion, due);
  const filtersActive =
    completion !== 'all' ||
    !isAllTaskDueFilters(due) ||
    Boolean(planView?.taskAssigneeFilter) ||
    (planView?.taskCategoryFilters.length ?? 0) > 0 ||
    Boolean(planView?.taskSectionFilter) ||
    Boolean(planView?.hideManualPaymentTasks);

  const entryCategories = React.useMemo(() => {
    if (!trip) return [];
    const set = new Set<string>();
    for (const e of localEntries) {
      if (e.tripId !== trip.id) continue;
      const c = (e.category || 'Other').trim();
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [localEntries, trip]);

  React.useEffect(() => {
    if (!trip?.id) {
      setManualCategories([]);
      setHasUncategorised(false);
      return;
    }
    const svc = new ReminderService(spContext);
    void svc
      .getForTrip(trip.id)
      .then((rows) => {
        const manual = rows.filter(
          (r) => r.reminderType === 'Manual' || r.reminderType === 'ManualEntryTask' || r.reminderType === 'Custom'
        );
        const cats = new Set<string>();
        let uncategorised = false;
        for (const m of manual) {
          const eid = (m.entryId || '').trim();
          const entry = eid ? localEntries.find((e) => e.id === eid) : undefined;
          const cat = (m.taskCategory || entry?.category || '').trim();
          if (cat) cats.add(cat);
          else uncategorised = true;
        }
        setManualCategories(Array.from(cats));
        setHasUncategorised(uncategorised);
      })
      .catch(() => {
        setManualCategories([]);
        setHasUncategorised(false);
      });
  }, [trip?.id, spContext, localEntries]);

  const allCategories = React.useMemo(() => {
    const set = new Set([...entryCategories, ...manualCategories]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entryCategories, manualCategories]);

  const applyStat = (key: StatKey): void => {
    if (!planView) return;
    if (selected === key) {
      planView.setTaskCompletionFilter('all');
      planView.setTaskDueFilters([]);
      return;
    }
    if (key === 'open') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilters([]);
      return;
    }
    if (key === 'overdue') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilters(['overdue']);
      return;
    }
    if (key === 'today') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilters(['today']);
      return;
    }
    planView.setTaskCompletionFilter('completed');
    planView.setTaskDueFilters([]);
  };

  React.useEffect(() => {
    if (!trip?.id) return;
    const today = localTodayYmd();
    const load = (): void => {
      const svc = new ReminderService(spContext);
      const applyRows = (rows: Awaited<ReturnType<ReminderService['getForTrip']>>): void => {
        const manual = rows.filter(
          (r) =>
            !isDayIdeaReminder(r) &&
            !isSavedSpotReminder(r) &&
            !isJotterIdeaReminder(r) &&
            (r.reminderType === 'Manual' ||
              r.reminderType === 'ManualEntryTask' ||
              r.reminderType === 'Custom' ||
              r.reminderType === 'CancellationDeadline')
        );
        let open = 0;
        let overdue = 0;
        let dueToday = 0;
        let done = 0;
        for (const m of manual) {
          if (m.isComplete) {
            done += 1;
            continue;
          }
          open += 1;
          const bucket = dueYmdBucket(ymdFromIso(m.dueDate), today);
          if (bucket === 'overdue') overdue += 1;
          if (bucket === 'today') dueToday += 1;
        }
        for (const e of localEntries) {
          if (e.bookingRequired && e.bookingStatus === 'Not booked') {
            open += 1;
            const bucket = dueYmdBucket(ymdFromIso(e.bookingDueDate), today);
            if (bucket === 'overdue') overdue += 1;
            if (bucket === 'today') dueToday += 1;
          } else if (e.bookingRequired && e.bookingStatus === 'Booked') {
            done += 1;
          }
          if ((e.paymentStatus === 'Not paid' && e.amount > 0) || e.paymentStatus === 'Part paid') {
            open += 1;
            const bucket = dueYmdBucket(ymdFromIso(e.paymentDueDate), today);
            if (bucket === 'overdue') overdue += 1;
            if (bucket === 'today') dueToday += 1;
          } else if (e.paymentStatus === 'Fully paid' && e.amount > 0) {
            done += 1;
          }
        }
        setOpenCount(open);
        setOverdueCount(overdue);
        setDueTodayCount(dueToday);
        setDoneCount(done);
      };
      void svc
        .getForTrip(trip.id)
        .then((rows) => {
          void patchTripOfflineExtrasCache(trip.id, { reminders: rows });
          applyRows(rows);
        })
        .catch(async (err) => {
          if (isLikelyNetworkError(err)) reportNetworkFailure(err);
          const cached = await loadTripOfflineCache(trip.id);
          if (cached?.reminders) applyRows(cached.reminders);
        });
    };
    load();
    window.addEventListener('trip-reminders-updated', load);
    window.addEventListener('trip-itinerary-updated', load);
    return () => {
      window.removeEventListener('trip-reminders-updated', load);
      window.removeEventListener('trip-itinerary-updated', load);
    };
  }, [trip?.id, spContext, localEntries, reportNetworkFailure]);

  return (
    <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
      {hideChrome ? null : (
        <>
          <h1 className={chrome.pageTitle}>Tasks</h1>
          <p className={chrome.pageSub}>Reminders, bookings, and payments</p>
        </>
      )}

      <div className={chrome.statRow}>
        <button
          type="button"
          className={`${chrome.statCard} ${chrome.statCardBtn} ${selected === 'open' ? chrome.statCardActive : ''}`}
          onClick={() => applyStat('open')}
        >
          <StatIcon tone="navy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </StatIcon>
          <span className={chrome.statValue}>{openCount}</span>
          <span className={chrome.statLabel}>Open</span>
        </button>
        <button
          type="button"
          className={`${chrome.statCard} ${chrome.statCardBtn} ${selected === 'overdue' ? chrome.statCardActive : ''} ${overdueCount ? chrome.statCardAlert : ''}`}
          onClick={() => applyStat('overdue')}
        >
          <StatIcon tone="rust">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </StatIcon>
          <span className={`${chrome.statValue} ${overdueCount ? chrome.statValueAlert : ''}`}>{overdueCount}</span>
          <span className={`${chrome.statLabel} ${overdueCount ? chrome.statValueAlert : ''}`}>Overdue</span>
        </button>
        <button
          type="button"
          className={`${chrome.statCard} ${chrome.statCardBtn} ${selected === 'today' ? chrome.statCardActive : ''}`}
          onClick={() => applyStat('today')}
        >
          <StatIcon tone="tan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </StatIcon>
          <span className={chrome.statValue}>{dueTodayCount}</span>
          <span className={chrome.statLabel}>Due today</span>
        </button>
        <button
          type="button"
          className={`${chrome.statCard} ${chrome.statCardBtn} ${selected === 'done' ? chrome.statCardActive : ''}`}
          onClick={() => applyStat('done')}
        >
          <StatIcon tone="olive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </StatIcon>
          <span className={chrome.statValue}>{doneCount}</span>
          <span className={chrome.statLabel}>Done</span>
        </button>
      </div>

      <MobileTaskFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        travellers={travellers}
        allCategories={allCategories}
        hasUncategorised={hasUncategorised}
      />
      <TripTasksView
        variant="tasks"
        mobileLayout
        onOpenFilters={() => setFiltersOpen(true)}
        filtersActive={filtersActive}
        filtersOpen={filtersOpen}
      />
    </div>
  );
};

export const MobileTaskView: React.FC<{ hideChrome?: boolean }> = ({ hideChrome }) => {
  if (hideChrome) {
    return <MobileTaskBody hideChrome />;
  }
  return (
    <PlanViewProvider>
      <MobileTaskBody hideChrome={hideChrome} />
    </PlanViewProvider>
  );
};
