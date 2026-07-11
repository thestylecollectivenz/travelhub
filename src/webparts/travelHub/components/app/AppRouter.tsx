import * as React from 'react';
import { TripBrowser } from '../multiTrip/TripBrowser';
import { CreateTripPanel } from '../multiTrip/CreateTripPanel';
import { TripWorkspace } from '../../../../components/workspace/TripWorkspace';
import { ConfigPanel } from '../../../../components/workspace/ConfigPanel';
import { TermsAndConditions } from './TermsAndConditions';
import { AppFooter } from './AppFooter';
import { useShellMode, isCompactTouchShell } from '../../../../hooks/useShellMode';
import { MobileHomeShell } from '../../../../components/mobile/MobileHomeShell';
import { IpadLandscapePlaceholder } from '../../../../components/ipad/IpadLandscapePlaceholder';
import type { MobileTab } from '../../../../components/mobile/mobileTypes';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip' | 'terms';

export const AppRouter: React.FC = () => {
  const shellMode = useShellMode();
  const [view, setView] = React.useState<AppView>('multiTrip');
  const [selectedTripId, setSelectedTripId] = React.useState<string>('');
  const [initialMobileTab, setInitialMobileTab] = React.useState<MobileTab | undefined>(undefined);
  const [configOpen, setConfigOpen] = React.useState(false);

  React.useEffect(() => {
    const openSettings = (): void => setConfigOpen(true);
    window.addEventListener('travelhub-open-settings', openSettings);
    return () => window.removeEventListener('travelhub-open-settings', openSettings);
  }, []);

  const goToTrip = (id: string, tab?: MobileTab): void => {
    setSelectedTripId(id);
    setInitialMobileTab(tab);
    setView('singleTrip');
  };

  let content: React.ReactNode;
  if (view === 'terms') {
    content = <TermsAndConditions onBack={() => setView(selectedTripId ? 'singleTrip' : 'multiTrip')} />;
  } else if (view === 'singleTrip') {
    content = (
      <TripWorkspace
        tripId={selectedTripId}
        onBack={() => {
          setInitialMobileTab(undefined);
          setView('multiTrip');
        }}
        initialMobileTab={initialMobileTab}
      />
    );
  } else if (shellMode === 'ipad-landscape') {
    content = <IpadLandscapePlaceholder context="home" />;
  } else if (isCompactTouchShell(shellMode)) {
    content = (
      <MobileHomeShell
        onSelectTrip={goToTrip}
        onCreateTrip={() => setView('createTrip')}
        onOpenSettings={() => setConfigOpen(true)}
        shellMode={shellMode === 'ipad-portrait' ? 'ipad-portrait' : 'phone'}
      />
    );
  } else {
    content = (
      <TripBrowser
        onSelectTrip={(id) => goToTrip(id)}
        onCreateTrip={() => setView('createTrip')}
        onOpenSettings={() => setConfigOpen(true)}
      />
    );
  }

  const hideFooter =
    isCompactTouchShell(shellMode) || shellMode === 'ipad-landscape'
      ? view === 'singleTrip' || view === 'multiTrip'
      : false;

  return (
    <>
      {content}
      <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
      {!hideFooter ? <AppFooter onOpenTerms={() => setView('terms')} /> : null}
      {view === 'createTrip' ? (
        <CreateTripPanel
          onCreated={(newTripId) => goToTrip(newTripId)}
          onCancel={() => setView('multiTrip')}
        />
      ) : null}
    </>
  );
};
