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
import {
  clearPersistedTripNav,
  loadPersistedMobileNav,
  persistMobileNav
} from '../../../../utils/mobileNavPersistence';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip' | 'terms';

function initialViewFromSession(): { view: AppView; tripId: string; tab?: MobileTab } {
  const nav = loadPersistedMobileNav();
  if (nav.view === 'singleTrip' && (nav.tripId || '').trim()) {
    return {
      view: 'singleTrip',
      tripId: nav.tripId!.trim(),
      tab: (nav.tripTab as MobileTab | undefined) || undefined
    };
  }
  return { view: 'multiTrip', tripId: '' };
}

export const AppRouter: React.FC = () => {
  const shellMode = useShellMode();
  const boot = React.useMemo(() => initialViewFromSession(), []);
  const [view, setView] = React.useState<AppView>(boot.view);
  const [selectedTripId, setSelectedTripId] = React.useState<string>(boot.tripId);
  const [initialMobileTab, setInitialMobileTab] = React.useState<MobileTab | undefined>(boot.tab);
  const [configOpen, setConfigOpen] = React.useState(false);

  React.useEffect(() => {
    const openSettings = (): void => setConfigOpen(true);
    window.addEventListener('travelhub-open-settings', openSettings);
    return () => window.removeEventListener('travelhub-open-settings', openSettings);
  }, []);

  // Restore trip after SharePoint / Safari remount when returning from an external site.
  React.useEffect(() => {
    const restore = (): void => {
      const nav = loadPersistedMobileNav();
      if (nav.view === 'singleTrip' && (nav.tripId || '').trim()) {
        setSelectedTripId(nav.tripId!.trim());
        setInitialMobileTab((nav.tripTab as MobileTab | undefined) || undefined);
        setView('singleTrip');
      }
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const goToTrip = (id: string, tab?: MobileTab): void => {
    setSelectedTripId(id);
    setInitialMobileTab(tab);
    setView('singleTrip');
    persistMobileNav({ view: 'singleTrip', tripId: id, tripTab: tab || 'today' });
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
          clearPersistedTripNav();
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
