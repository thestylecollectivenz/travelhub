import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { CreateTripPanel } from '../multiTrip/CreateTripPanel';
import { TripWorkspace } from '../../../../components/workspace/TripWorkspace';
import { TermsAndConditions } from './TermsAndConditions';
import { AppFooter } from './AppFooter';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip' | 'terms';

export const AppRouter: React.FC = () => {
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');

  const goToTrip = (id: string): void => {
    setSelectedTripId(id);
    setView('singleTrip');
  };

  if (view === 'terms') {
    return <TermsAndConditions onBack={() => setView(selectedTripId ? 'singleTrip' : 'multiTrip')} />;
  }

  if (view === 'singleTrip') {
    return (
      <TripWorkspace
        tripId={selectedTripId}
        onBack={() => setView('multiTrip')}
        onOpenTerms={() => setView('terms')}
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
        onOpenTerms={() => setView('terms')}
      />
      <AppFooter onOpenTerms={() => setView('terms')} />
      {view === 'createTrip' && (
        <CreateTripPanel
          onCreated={(newTripId) => goToTrip(newTripId)}
          onCancel={() => setView('multiTrip')}
        />
      )}
    </>
  );
};
