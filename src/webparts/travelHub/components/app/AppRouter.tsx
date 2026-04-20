import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { TripWorkspace } from '../../../../components/workspace/TripWorkspace';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip';

export const AppRouter: React.FC = () => {
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');

  if (view === 'singleTrip') {
    return (
      <TripWorkspace
        tripId={selectedTripId}
        onBack={() => setView('multiTrip')}
      />
    );
  }

  // createTrip view will be implemented in Task 3.3
  // For now render TripBrowser with a placeholder — view state is ready
  return (
    <TripBrowser
      onSelectTrip={(id) => {
        setSelectedTripId(id);
        setView('singleTrip');
      }}
      onCreateTrip={() => setView('createTrip')}
    />
  );
};
