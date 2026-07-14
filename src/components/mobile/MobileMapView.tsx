import * as React from 'react';
import { TripMap } from '../maps/TripMap';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useShellMode } from '../../hooks/useShellMode';

export const MobileMapView: React.FC = () => {
  const shellMode = useShellMode();

  return (
    <ErrorBoundary fallbackTitle="Map could not load">
      <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
        <TripMap mobileLayout />
      </div>
    </ErrorBoundary>
  );
};
