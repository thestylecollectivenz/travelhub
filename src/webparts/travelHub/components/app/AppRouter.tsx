import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { CreateTripPanel } from '../multiTrip/CreateTripPanel';
import { TripWorkspace } from '../../../../components/workspace/TripWorkspace';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip';

export const AppRouter: React.FC = () => {
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');

  const goToTrip = (id: string): void => {
    setSelectedTripId(id);
    setView('singleTrip');
  };

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
    <>
      <TripBrowser
        onSelectTrip={goToTrip}
        onCreateTrip={() => setView('createTrip')}
      />
      {view === 'createTrip' && (
        <CreateTripPanel
          onCreated={(newTripId) => goToTrip(newTripId)}
          onCancel={() => setView('multiTrip')}
        />
      )}
    </>
  );
};
