import * as React from 'react';
import { PlanViewProvider } from '../../context/PlanViewContext';
import { TripTasksView } from '../tasks/TripTasksView';

export const MobileTaskView: React.FC = () => (
  <PlanViewProvider>
    <TripTasksView variant="tasks" />
  </PlanViewProvider>
);
