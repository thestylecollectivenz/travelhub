import * as React from 'react';
import { TripMap } from '../maps/TripMap';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useShellMode } from '../../hooks/useShellMode';
import chrome from './MobileTabChrome.module.css';

export const MobileMapView: React.FC = () => {
  const shellMode = useShellMode();

  return (
    <ErrorBoundary fallbackTitle="Map could not load">
      <div data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}>
        <h1 className={chrome.pageTitle}>Map</h1>
        <p className={chrome.pageSub}>Transport stops and your route across the trip</p>
        <TripMap mobileLayout />
      </div>
    </ErrorBoundary>
  );
};
