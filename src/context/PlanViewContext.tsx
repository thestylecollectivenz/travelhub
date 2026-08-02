import * as React from 'react';
import type { TaskDueFilter } from '../utils/taskDueBuckets';

export type PlanTab = 'tasks' | 'shopping' | 'packing' | 'packing_templates' | 'missing_costs' | 'day_ideas';

export type TaskSectionKey = 'todo' | 'bookings' | 'payments' | 'cancellations';

export type TaskCompletionFilter = 'incomplete' | 'all' | 'completed';

export type PackingPackedQuickFilter = 'all' | 'packed' | 'unpacked';

export type ShoppingStatusQuickFilter = 'all' | 'tobuy' | 'purchased';

export interface PlanViewContextValue {
  planTab: PlanTab;
  setPlanTab: (tab: PlanTab) => void;
  /** Empty array = every packing category. */
  packingCategories: string[];
  setPackingCategories: (categories: string[]) => void;
  /** Empty array = every task category. May include TASK_FILTER_UNCATEGORISED. */
  taskCategoryFilters: string[];
  setTaskCategoryFilters: (categories: string[]) => void;
  /** When set, tasks view shows only items assigned to this person. */
  taskAssigneeFilter: string | null;
  setTaskAssigneeFilter: (name: string | null) => void;
  /** When set, tasks view shows only the selected section. */
  taskSectionFilter: TaskSectionKey | null;
  setTaskSectionFilter: (section: TaskSectionKey | null) => void;
  /** Open only, all tasks, or completed tasks/reminders. */
  taskCompletionFilter: TaskCompletionFilter;
  setTaskCompletionFilter: (filter: TaskCompletionFilter) => void;
  /** Due buckets from summary stats / chips / drawer. Empty array = all dates. */
  taskDueFilters: TaskDueFilter[];
  setTaskDueFilters: (filters: TaskDueFilter[]) => void;
  tasksViewMode: 'list' | 'calendar';
  setTasksViewMode: (mode: 'list' | 'calendar') => void;
  /** null = all packing items for the trip */
  packingTraveller: string | null;
  setPackingTraveller: (name: string | null) => void;
  packingPackedFilter: PackingPackedQuickFilter;
  setPackingPackedFilter: (filter: PackingPackedQuickFilter) => void;
  focusedReminderId: string | null;
  setFocusedReminderId: (id: string | null) => void;
  /** null = all travellers on shopping list */
  shoppingTraveller: string | null;
  setShoppingTraveller: (name: string | null) => void;
  /** Empty array = every shopping category. May include '__uncategorised__'. */
  shoppingCategories: string[];
  setShoppingCategories: (categories: string[]) => void;
  /** Empty array = every month. May include '__unscheduled__'. */
  shoppingMonthFilters: string[];
  setShoppingMonthFilters: (months: string[]) => void;
  shoppingStatusFilter: ShoppingStatusQuickFilter;
  setShoppingStatusFilter: (filter: ShoppingStatusQuickFilter) => void;
  packingHasNotesOnly: boolean;
  setPackingHasNotesOnly: (value: boolean) => void;
  packingHasQtyGt1: boolean;
  setPackingHasQtyGt1: (value: boolean) => void;
  shoppingHasNotesOnly: boolean;
  setShoppingHasNotesOnly: (value: boolean) => void;
  /** Hide manual same-day payment rows from the payments task list. */
  hideManualPaymentTasks: boolean;
  setHideManualPaymentTasks: (value: boolean) => void;
}

const PlanViewContext = React.createContext<PlanViewContextValue | undefined>(undefined);

export const PlanViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planTab, setPlanTab] = React.useState<PlanTab>('tasks');
  const [packingCategories, setPackingCategories] = React.useState<string[]>([]);
  const [taskCategoryFilters, setTaskCategoryFilters] = React.useState<string[]>([]);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = React.useState<string | null>(null);
  const [taskSectionFilter, setTaskSectionFilter] = React.useState<TaskSectionKey | null>(null);
  const [taskCompletionFilter, setTaskCompletionFilter] = React.useState<TaskCompletionFilter>('all');
  const [taskDueFilters, setTaskDueFilters] = React.useState<TaskDueFilter[]>([]);
  const [tasksViewMode, setTasksViewMode] = React.useState<'list' | 'calendar'>('list');
  const [packingTraveller, setPackingTraveller] = React.useState<string | null>(null);
  const [packingPackedFilter, setPackingPackedFilter] = React.useState<PackingPackedQuickFilter>('all');
  const [focusedReminderId, setFocusedReminderId] = React.useState<string | null>(null);
  const [shoppingTraveller, setShoppingTraveller] = React.useState<string | null>(null);
  const [shoppingCategories, setShoppingCategories] = React.useState<string[]>([]);
  const [shoppingMonthFilters, setShoppingMonthFilters] = React.useState<string[]>([]);
  const [shoppingStatusFilter, setShoppingStatusFilter] = React.useState<ShoppingStatusQuickFilter>('all');
  const [packingHasNotesOnly, setPackingHasNotesOnly] = React.useState(false);
  const [packingHasQtyGt1, setPackingHasQtyGt1] = React.useState(false);
  const [shoppingHasNotesOnly, setShoppingHasNotesOnly] = React.useState(false);
  const [hideManualPaymentTasks, setHideManualPaymentTasks] = React.useState(false);

  const value = React.useMemo(
    () => ({
      planTab,
      setPlanTab,
      packingCategories,
      setPackingCategories,
      taskCategoryFilters,
      setTaskCategoryFilters,
      taskAssigneeFilter,
      setTaskAssigneeFilter,
      taskSectionFilter,
      setTaskSectionFilter,
      taskCompletionFilter,
      setTaskCompletionFilter,
      taskDueFilters,
      setTaskDueFilters,
      tasksViewMode,
      setTasksViewMode,
      packingTraveller,
      setPackingTraveller,
      packingPackedFilter,
      setPackingPackedFilter,
      focusedReminderId,
      setFocusedReminderId,
      shoppingTraveller,
      setShoppingTraveller,
      shoppingCategories,
      setShoppingCategories,
      shoppingMonthFilters,
      setShoppingMonthFilters,
      shoppingStatusFilter,
      setShoppingStatusFilter,
      packingHasNotesOnly,
      setPackingHasNotesOnly,
      packingHasQtyGt1,
      setPackingHasQtyGt1,
      shoppingHasNotesOnly,
      setShoppingHasNotesOnly,
      hideManualPaymentTasks,
      setHideManualPaymentTasks
    }),
    [
      planTab,
      packingCategories,
      taskCategoryFilters,
      taskAssigneeFilter,
      taskSectionFilter,
      taskCompletionFilter,
      taskDueFilters,
      tasksViewMode,
      packingTraveller,
      packingPackedFilter,
      focusedReminderId,
      shoppingTraveller,
      shoppingCategories,
      shoppingMonthFilters,
      shoppingStatusFilter,
      packingHasNotesOnly,
      packingHasQtyGt1,
      shoppingHasNotesOnly,
      hideManualPaymentTasks
    ]
  );

  return <PlanViewContext.Provider value={value}>{children}</PlanViewContext.Provider>;
};

export function usePlanView(): PlanViewContextValue | undefined {
  return React.useContext(PlanViewContext);
}
