import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { CreateTripPanel } from '../multiTrip/CreateTripPanel';
import { TripWorkspace } from '../../../../components/workspace/TripWorkspace';
import { ConfigPanel } from '../../../../components/workspace/ConfigPanel';
import { TermsAndConditions } from './TermsAndConditions';
import { AppFooter } from './AppFooter';
import { useMobileMode } from '../../../../hooks/useMobileMode';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip' | 'terms';

export const AppRouter: React.FC = () => {
  const isMobile = useMobileMode();
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');
  const [configOpen, setConfigOpen] = React.useState(false);

  React.useEffect(() => {
    const openSettings = (): void => setConfigOpen(true);
    window.addEventListener('travelhub-open-settings', openSettings);
    return () => window.removeEventListener('travelhub-open-settings', openSettings);
  }, []);

  const goToTrip = (id: string): void => {
    setSelectedTripId(id);
    setView('singleTrip');
  };

  let content: React.ReactNode;
  if (view === 'terms') {
    content = <TermsAndConditions onBack={() => setView(selectedTripId ? 'singleTrip' : 'multiTrip')} />;
  } else if (view === 'singleTrip') {
    content = (
      <TripWorkspace
        tripId={selectedTripId}
        onBack={() => setView('multiTrip')}
      />
    );
  } else {
    // createTrip view is handled by panel overlay.
    content = (
      <TripBrowser
        onSelectTrip={goToTrip}
        onCreateTrip={() => setView('createTrip')}
        onOpenSettings={() => setConfigOpen(true)}
      />
    );
  }

  return (
    <>
      {content}
      <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
      {!(isMobile && view === 'singleTrip') ? (
        <AppFooter onOpenTerms={() => setView('terms')} />
      ) : null}
      {view === 'createTrip' ? (
        <CreateTripPanel
          onCreated={(newTripId) => goToTrip(newTripId)}
          onCancel={() => setView('multiTrip')}
        />
      ) : null}
    </>
  );
};
