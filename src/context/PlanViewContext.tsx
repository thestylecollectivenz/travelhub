import * as React from 'react';

export type PlanTab = 'tasks' | 'packing' | 'missing_costs';

export interface PlanViewContextValue {
  planTab: PlanTab;
  setPlanTab: (tab: PlanTab) => void;
  packingCategory: string;
  setPackingCategory: (category: string) => void;
}

const PlanViewContext = React.createContext<PlanViewContextValue | undefined>(undefined);

export const PlanViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [planTab, setPlanTab] = React.useState<PlanTab>('tasks');
  const [packingCategory, setPackingCategory] = React.useState('Clothing');

  const value = React.useMemo(
    () => ({ planTab, setPlanTab, packingCategory, setPackingCategory }),
    [planTab, packingCategory]
  );

  return <PlanViewContext.Provider value={value}>{children}</PlanViewContext.Provider>;
};

export function usePlanView(): PlanViewContextValue | undefined {
  return React.useContext(PlanViewContext);
}
