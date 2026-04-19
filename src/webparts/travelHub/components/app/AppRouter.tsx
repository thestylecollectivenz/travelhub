import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { TripWorkspace } from '../trip/TripWorkspace';

type AppView = 'multiTrip' | 'singleTrip';

export const AppRouter: React.FC = () => {
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');

  if (view === 'singleTrip') {
    return (
      <TripWorkspace
        tripId={selectedTripId}
        onBack={() => {
          setView('multiTrip');
        }}
      />
    );
  }

  return (
    <TripBrowser
      onSelectTrip={(id) => {
        setSelectedTripId(id);
        setView('singleTrip');
      }}
    />
  );
};
