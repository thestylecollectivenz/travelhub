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
  packingCategory: string;
  setPackingCategory: (category: string) => void;
  /** When set, tasks view shows only items in this itinerary category. */
  taskCategoryFilter: string | null;
  setTaskCategoryFilter: (category: string | null) => void;
  /** When set, tasks view shows only items assigned to this person. */
  taskAssigneeFilter: string | null;
  setTaskAssigneeFilter: (name: string | null) => void;
  /** When set, tasks view shows only the selected section. */
  taskSectionFilter: TaskSectionKey | null;
  setTaskSectionFilter: (section: TaskSectionKey | null) => void;
  /** Open only, all tasks, or completed tasks/reminders. */
  taskCompletionFilter: TaskCompletionFilter;
  setTaskCompletionFilter: (filter: TaskCompletionFilter) => void;
  /** Quick due filter from summary stats / chips. */
  taskDueFilter: TaskDueFilter;
  setTaskDueFilter: (filter: TaskDueFilter) => void;
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
  shoppingCategory: string;
  setShoppingCategory: (category: string) => void;
  shoppingMonthFilter: string | null;
  setShoppingMonthFilter: (month: string | null) => void;
  shoppingStatusFilter: ShoppingStatusQuickFilter;
  setShoppingStatusFilter: (filter: ShoppingStatusQuickFilter) => void;
}

const PlanViewContext = React.createContext<PlanViewContextValue | undefined>(undefined);

export const PlanViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planTab, setPlanTab] = React.useState<PlanTab>('tasks');
  const [packingCategory, setPackingCategory] = React.useState('__all__');
  const [taskCategoryFilter, setTaskCategoryFilter] = React.useState<string | null>(null);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = React.useState<string | null>(null);
  const [taskSectionFilter, setTaskSectionFilter] = React.useState<TaskSectionKey | null>(null);
  const [taskCompletionFilter, setTaskCompletionFilter] = React.useState<TaskCompletionFilter>('all');
  const [taskDueFilter, setTaskDueFilter] = React.useState<TaskDueFilter>('all');
  const [tasksViewMode, setTasksViewMode] = React.useState<'list' | 'calendar'>('list');
  const [packingTraveller, setPackingTraveller] = React.useState<string | null>(null);
  const [packingPackedFilter, setPackingPackedFilter] = React.useState<PackingPackedQuickFilter>('all');
  const [focusedReminderId, setFocusedReminderId] = React.useState<string | null>(null);
  const [shoppingTraveller, setShoppingTraveller] = React.useState<string | null>(null);
  const [shoppingCategory, setShoppingCategory] = React.useState('__all__');
  const [shoppingMonthFilter, setShoppingMonthFilter] = React.useState<string | null>(null);
  const [shoppingStatusFilter, setShoppingStatusFilter] = React.useState<ShoppingStatusQuickFilter>('all');

  const value = React.useMemo(
    () => ({
      planTab,
      setPlanTab,
      packingCategory,
      setPackingCategory,
      taskCategoryFilter,
      setTaskCategoryFilter,
      taskAssigneeFilter,
      setTaskAssigneeFilter,
      taskSectionFilter,
      setTaskSectionFilter,
      taskCompletionFilter,
      setTaskCompletionFilter,
      taskDueFilter,
      setTaskDueFilter,
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
      shoppingCategory,
      setShoppingCategory,
      shoppingMonthFilter,
      setShoppingMonthFilter,
      shoppingStatusFilter,
      setShoppingStatusFilter
    }),
    [
      planTab,
      packingCategory,
      taskCategoryFilter,
      taskAssigneeFilter,
      taskSectionFilter,
      taskCompletionFilter,
      taskDueFilter,
      tasksViewMode,
      packingTraveller,
      packingPackedFilter,
      focusedReminderId,
      shoppingTraveller,
      shoppingCategory,
      shoppingMonthFilter,
      shoppingStatusFilter
    ]
  );

  return <PlanViewContext.Provider value={value}>{children}</PlanViewContext.Provider>;
};

export function usePlanView(): PlanViewContextValue | undefined {
  return React.useContext(PlanViewContext);
}
