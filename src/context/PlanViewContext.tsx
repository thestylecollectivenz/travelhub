import * as React from 'react';

export type PlanTab = 'tasks' | 'packing' | 'missing_costs';

export interface PlanViewContextValue {
  planTab: PlanTab;
  setPlanTab: (tab: PlanTab) => void;
  packingCategory: string;
  setPackingCategory: (category: string) => void;
  /** When set, tasks view shows only items in this itinerary category. */
  taskCategoryFilter: string | null;
  setTaskCategoryFilter: (category: string | null) => void;
  tasksViewMode: 'list' | 'calendar';
  setTasksViewMode: (mode: 'list' | 'calendar') => void;
}

const PlanViewContext = React.createContext<PlanViewContextValue | undefined>(undefined);

export const PlanViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planTab, setPlanTab] = React.useState<PlanTab>('tasks');
  const [packingCategory, setPackingCategory] = React.useState('Clothing');
  const [taskCategoryFilter, setTaskCategoryFilter] = React.useState<string | null>(null);
  const [tasksViewMode, setTasksViewMode] = React.useState<'list' | 'calendar'>('list');

  const value = React.useMemo(
    () => ({
      planTab,
      setPlanTab,
      packingCategory,
      setPackingCategory,
      taskCategoryFilter,
      setTaskCategoryFilter,
      tasksViewMode,
      setTasksViewMode
    }),
    [planTab, packingCategory, taskCategoryFilter, tasksViewMode]
  );

  return <PlanViewContext.Provider value={value}>{children}</PlanViewContext.Provider>;
};

export function usePlanView(): PlanViewContextValue | undefined {
  return React.useContext(PlanViewContext);
}
