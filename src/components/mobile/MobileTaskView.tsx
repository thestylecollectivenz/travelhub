import * as React from 'react';
import { PlanViewProvider, usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useCompanionListDefaults } from '../../hooks/useCompanionListDefaults';
import { useTripRole } from '../../context/TripRoleContext';
import { ReminderService } from '../../services/ReminderService';
import { dueYmdBucket, localTodayYmd, ymdFromIso, type TaskDueFilter } from '../../utils/taskDueBuckets';
import { isDayIdeaReminder } from '../../utils/dayIdeas';
import { isJotterIdeaReminder } from '../../utils/tripJotterIdeas';
import { isSavedSpotReminder } from '../../utils/tripSavedSpots';
import type { TaskCompletionFilter } from '../../utils/taskFilters';
import { TripTasksView } from '../tasks/TripTasksView';
import { MobileTaskFilters } from './MobileTaskFilters';
import { MobileFilterDisclosure } from './MobileFilterDisclosure';
import { useShellMode } from '../../hooks/useShellMode';
import chrome from './MobileTabChrome.module.css';

function StatIcon({ children, tone }: { children: React.ReactNode; tone: 'olive' | 'rust' | 'navy' | 'tan' }): React.ReactElement {
  const cls =
    tone === 'olive' ? chrome.statIconOlive : tone === 'rust' ? chrome.statIconRust : tone === 'tan' ? chrome.statIconTan : chrome.statIconNavy;
  return <span className={`${chrome.statIcon} ${cls}`}>{children}</span>;
}

type StatKey = 'open' | 'overdue' | 'today' | 'done';

function activeStat(
  completion: TaskCompletionFilter,
  due: TaskDueFilter
): StatKey | null {
  if (completion === 'completed') return 'done';
  if (completion === 'incomplete' && due === 'overdue') return 'overdue';
  if (completion === 'incomplete' && due === 'today') return 'today';
  if (completion === 'incomplete' && due === 'all') return 'open';
  return null;
}

const MobileTaskBody: React.FC<{ hideChrome?: boolean }> = ({ hideChrome }) => {
  const { trip } = useTripWorkspace();
  const spContext = useSpContext();
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

  const completion = planView?.taskCompletionFilter ?? 'all';
  const due = planView?.taskDueFilter ?? 'all';
  const selected = activeStat(completion, due);

  const applyStat = (key: StatKey): void => {
    if (!planView) return;
    if (selected === key) {
      planView.setTaskCompletionFilter('all');
      planView.setTaskDueFilter('all');
      return;
    }
    if (key === 'open') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilter('all');
      return;
    }
    if (key === 'overdue') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilter('overdue');
      return;
    }
    if (key === 'today') {
      planView.setTaskCompletionFilter('incomplete');
      planView.setTaskDueFilter('today');
      return;
    }
    planView.setTaskCompletionFilter('completed');
    planView.setTaskDueFilter('all');
  };

  React.useEffect(() => {
    if (!trip?.id) return;
    const today = localTodayYmd();
    const load = (): void => {
      const svc = new ReminderService(spContext);
      void svc.getForTrip(trip.id).then((rows) => {
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
        setOpenCount(open);
        setOverdueCount(overdue);
        setDueTodayCount(dueToday);
        setDoneCount(done);
      });
    };
    load();
    window.addEventListener('trip-reminders-updated', load);
    return () => window.removeEventListener('trip-reminders-updated', load);
  }, [trip?.id, spContext]);

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

      <MobileFilterDisclosure open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
        <MobileTaskFilters travellers={travellers} />
      </MobileFilterDisclosure>
      <TripTasksView variant="tasks" mobileLayout />
    </div>
  );
};

export const MobileTaskView: React.FC<{ hideChrome?: boolean }> = ({ hideChrome }) => (
  <PlanViewProvider>
    <MobileTaskBody hideChrome={hideChrome} />
  </PlanViewProvider>
);
