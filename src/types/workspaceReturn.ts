import type { MainWorkspaceTab } from '../context/TripWorkspaceContext';

export type PlanReturnMode = 'tasks' | 'missing_costs' | 'packing';

export interface WorkspaceReturnState {
  tab: MainWorkspaceTab;
  planMode?: PlanReturnMode;
  tasksViewMode?: 'list' | 'calendar';
  label: string;
}
