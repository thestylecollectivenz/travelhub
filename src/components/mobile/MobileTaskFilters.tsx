import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService } from '../../services/ReminderService';
import { TASK_FILTER_UNCATEGORISED, type TaskCompletionFilter, taskCompletionFilterLabel } from '../../utils/taskFilters';
import chrome from './MobileTabChrome.module.css';

export interface MobileTaskFiltersProps {
  travellers: string[];
}

/** Assignee + category filters for mobile tasks (mirrors desktop sidebar). */
export const MobileTaskFilters: React.FC<MobileTaskFiltersProps> = ({ travellers }) => {
  const plan = usePlanView();
  const { trip, localEntries } = useTripWorkspace();
  const spContext = useSpContext();
  const [manualCategories, setManualCategories] = React.useState<string[]>([]);
  const [hasUncategorised, setHasUncategorised] = React.useState(false);

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

  if (!plan) return null;

  const assignee = plan.taskAssigneeFilter ?? null;
  const category = plan.taskCategoryFilter ?? null;
  const completion = plan.taskCompletionFilter;

  const completionKeys: TaskCompletionFilter[] = ['all', 'incomplete', 'completed'];

  return (
    <div className={chrome.filterPanel}>
      <div>
        <p className={chrome.filterGroupTitle}>Show tasks</p>
        <div className={chrome.chipRow}>
          {completionKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={`${chrome.chip} ${completion === key ? chrome.chipActive : ''}`}
              onClick={() => plan.setTaskCompletionFilter(key)}
            >
              {taskCompletionFilterLabel(key)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={chrome.filterGroupTitle}>Assigned to</p>
        <div className={chrome.chipRow}>
          <button
            type="button"
            className={`${chrome.chip} ${assignee === null ? chrome.chipActive : ''}`}
            onClick={() => plan.setTaskAssigneeFilter(null)}
          >
            All
          </button>
          {travellers.map((name) => (
            <button
              key={name}
              type="button"
              className={`${chrome.chip} ${assignee === name ? chrome.chipActive : ''}`}
              onClick={() => plan.setTaskAssigneeFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {allCategories.length > 0 || hasUncategorised ? (
        <div>
          <p className={chrome.filterGroupTitle}>Category</p>
          <div className={chrome.chipRow}>
            <button
              type="button"
              className={`${chrome.chip} ${category === null ? chrome.chipActive : ''}`}
              onClick={() => plan.setTaskCategoryFilter(null)}
            >
              All categories
            </button>
            {hasUncategorised ? (
              <button
                type="button"
                className={`${chrome.chip} ${category === TASK_FILTER_UNCATEGORISED ? chrome.chipActive : ''}`}
                onClick={() => plan.setTaskCategoryFilter(TASK_FILTER_UNCATEGORISED)}
              >
                Uncategorised
              </button>
            ) : null}
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${chrome.chip} ${category === cat ? chrome.chipActive : ''}`}
                onClick={() => plan.setTaskCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
