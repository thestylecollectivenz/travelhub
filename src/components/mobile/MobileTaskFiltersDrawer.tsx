import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePlanView } from '../../context/PlanViewContext';
import { useShellMode } from '../../hooks/useShellMode';
import type { TaskDueFilter } from '../../utils/taskDueBuckets';
import type { TaskSectionKey } from '../../context/PlanViewContext';
import { TASK_FILTER_UNCATEGORISED, type TaskCompletionFilter, taskCompletionFilterLabel } from '../../utils/taskFilters';
import styles from './MobilePackingFilters.module.css';

export interface MobileTaskFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  travellers: string[];
  allCategories: string[];
  hasUncategorised: boolean;
}

const DUE_OPTIONS: Array<{ key: TaskDueFilter; label: string }> = [
  { key: 'all', label: 'All dates' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'tomorrow', label: 'Due tomorrow' }
];

const SECTION_OPTIONS: Array<{ key: TaskSectionKey | null; label: string }> = [
  { key: null, label: 'All sections' },
  { key: 'todo', label: 'To do' },
  { key: 'bookings', label: 'Bookings needed' },
  { key: 'payments', label: 'Payments due' },
  { key: 'cancellations', label: 'Cancellations' }
];

/** Right slide-out advanced filters for mobile tasks. */
export const MobileTaskFiltersDrawer: React.FC<MobileTaskFiltersDrawerProps> = ({
  open,
  onClose,
  travellers,
  allCategories,
  hasUncategorised
}) => {
  const plan = usePlanView();
  const shellMode = useShellMode();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const completion = plan?.taskCompletionFilter ?? 'all';
  const assignee = plan?.taskAssigneeFilter ?? null;
  const category = plan?.taskCategoryFilter ?? null;
  const due = plan?.taskDueFilter ?? 'all';
  const section = plan?.taskSectionFilter ?? null;
  const hideManual = plan?.hideManualPaymentTasks ?? false;

  const panel = (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close filters" onClick={onClose} />
      <aside
        className={styles.drawer}
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-filters-title"
      >
        <div className={styles.header}>
          <h2 id="task-filters-title" className={styles.title}>
            Filters
          </h2>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <p className={styles.sectionTitle}>Show tasks</p>
            <ul className={styles.statusList}>
              {(['all', 'incomplete', 'completed'] as TaskCompletionFilter[]).map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => plan?.setTaskCompletionFilter(key)}
                  >
                    <span>{taskCompletionFilterLabel(key)}</span>
                    <span className={`${styles.radio} ${completion === key ? styles.radioOn : ''}`} aria-hidden>
                      {completion === key ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={styles.sectionTitle}>Due date</p>
            <ul className={styles.statusList}>
              {DUE_OPTIONS.map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => plan?.setTaskDueFilter(opt.key)}
                  >
                    <span>{opt.label}</span>
                    <span className={`${styles.radio} ${due === opt.key ? styles.radioOn : ''}`} aria-hidden>
                      {due === opt.key ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={styles.sectionTitle}>Section</p>
            <ul className={styles.statusList}>
              {SECTION_OPTIONS.map((opt) => (
                <li key={opt.key ?? 'all'}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => plan?.setTaskSectionFilter(opt.key)}
                  >
                    <span>{opt.label}</span>
                    <span className={`${styles.radio} ${section === opt.key ? styles.radioOn : ''}`} aria-hidden>
                      {section === opt.key ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={styles.sectionTitle}>Assigned to</p>
            <ul className={styles.statusList}>
              <li>
                <button
                  type="button"
                  className={styles.statusRow}
                  onClick={() => plan?.setTaskAssigneeFilter(null)}
                >
                  <span>All travellers</span>
                  <span className={`${styles.radio} ${assignee === null ? styles.radioOn : ''}`} aria-hidden>
                    {assignee === null ? '✓' : ''}
                  </span>
                </button>
              </li>
              {travellers.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => plan?.setTaskAssigneeFilter(name)}
                  >
                    <span>{name}</span>
                    <span className={`${styles.radio} ${assignee === name ? styles.radioOn : ''}`} aria-hidden>
                      {assignee === name ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {allCategories.length > 0 || hasUncategorised ? (
            <section>
              <p className={styles.sectionTitle}>Category</p>
              <ul className={styles.statusList}>
                <li>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => plan?.setTaskCategoryFilter(null)}
                  >
                    <span>All categories</span>
                    <span className={`${styles.radio} ${category === null ? styles.radioOn : ''}`} aria-hidden>
                      {category === null ? '✓' : ''}
                    </span>
                  </button>
                </li>
                {hasUncategorised ? (
                  <li>
                    <button
                      type="button"
                      className={styles.statusRow}
                      onClick={() => plan?.setTaskCategoryFilter(TASK_FILTER_UNCATEGORISED)}
                    >
                      <span>Uncategorised</span>
                      <span
                        className={`${styles.radio} ${category === TASK_FILTER_UNCATEGORISED ? styles.radioOn : ''}`}
                        aria-hidden
                      >
                        {category === TASK_FILTER_UNCATEGORISED ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                ) : null}
                {allCategories.map((cat) => (
                  <li key={cat}>
                    <button
                      type="button"
                      className={styles.statusRow}
                      onClick={() => plan?.setTaskCategoryFilter(cat)}
                    >
                      <span>{cat}</span>
                      <span className={`${styles.radio} ${category === cat ? styles.radioOn : ''}`} aria-hidden>
                        {category === cat ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className={styles.sectionTitle}>Payments view</p>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Hide manual same-day payments</span>
              <button
                type="button"
                className={`${styles.switch} ${hideManual ? styles.switchOn : ''}`}
                role="switch"
                aria-checked={hideManual}
                aria-label="Hide manual same-day payments"
                onClick={() => plan?.setHideManualPaymentTasks(!hideManual)}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => {
              plan?.setTaskCompletionFilter('all');
              plan?.setTaskDueFilter('all');
              plan?.setTaskSectionFilter(null);
              plan?.setTaskAssigneeFilter(null);
              plan?.setTaskCategoryFilter(null);
              plan?.setHideManualPaymentTasks(false);
            }}
          >
            Reset
          </button>
          <button type="button" className={styles.applyBtn} onClick={onClose}>
            Apply filters
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
};
