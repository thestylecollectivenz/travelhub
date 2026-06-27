import * as React from 'react';
import { TripMap } from '../maps/TripMap';
import { ErrorBoundary } from '../shared/ErrorBoundary';

export const MobileMapView: React.FC = () => (
  <ErrorBoundary fallbackTitle="Map could not load">
    <TripMap />
  </ErrorBoundary>
);
