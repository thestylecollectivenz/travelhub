import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlanView } from '../../context/PlanViewContext';
import { useSpContext } from '../../context/SpContext';
import { ReminderService } from '../../services/ReminderService';
import { getCategorySlug } from '../../utils/categoryUtils';
import { TASK_FILTER_UNCATEGORISED } from '../../utils/taskFilters';
import styles from './TripSidebar.module.css';

export const SidebarTaskCategories: React.FC<{ hideHeading?: boolean }> = ({ hideHeading = false }) => {
  const { trip, localEntries } = useTripWorkspace();
  const planView = usePlanView();
  const spContext = useSpContext();
  const filter = planView?.taskCategoryFilter ?? null;
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
    svc
      .getForTrip(trip.id)
      .then((rows) => {
        const manual = rows.filter(
          (r) => r.reminderType === 'Manual' || r.reminderType === 'ManualEntryTask'
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

  if (!planView) return null;

  const body =
    allCategories.length === 0 && !hasUncategorised ? (
      <p className={styles.dayListHint}>No task categories yet.</p>
    ) : (
      <ul className={styles.dayList}>
        <li>
          <button
            type="button"
            className={`${styles.packingCatBtn} ${filter === null ? styles.packingCatBtnActive : ''}`}
            onClick={() => planView.setTaskCategoryFilter(null)}
          >
            All categories
          </button>
        </li>
        {hasUncategorised ? (
          <li>
            <button
              type="button"
              className={`${styles.packingCatBtn} ${filter === TASK_FILTER_UNCATEGORISED ? styles.packingCatBtnActive : ''}`}
              onClick={() => planView.setTaskCategoryFilter(TASK_FILTER_UNCATEGORISED)}
            >
              Uncategorised
            </button>
          </li>
        ) : null}
        {allCategories.map((cat) => {
          const slug = getCategorySlug(cat);
          const active = filter === cat;
          return (
            <li key={cat}>
              <button
                type="button"
                className={`${styles.packingCatBtn} th-cat-${slug} ${active ? styles.packingCatBtnActive : ''}`}
                onClick={() => planView.setTaskCategoryFilter(cat)}
              >
                {cat}
              </button>
            </li>
          );
        })}
      </ul>
    );

  if (hideHeading) return body;
  return (
    <div className={styles.dayListSection}>
      <h2 className={styles.dayListHeading}>Filter by category</h2>
      {body}
    </div>
  );
};
