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
  installExternalNavigationTracker,
  loadPersistedMobileNav,
  persistMobileNav,
  shouldRestoreMobileNav
} from '../../../../utils/mobileNavPersistence';

type AppView = 'multiTrip' | 'singleTrip' | 'createTrip' | 'terms';

function initialViewFromSession(): { view: AppView; tripId: string; tab?: MobileTab } {
  // Restore the last screen when the URL carries the deep-state marker
  // (in-trip reloads, external-site returns). A fresh visit starts at Home.
  if (!shouldRestoreMobileNav()) return { view: 'multiTrip', tripId: '' };
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

  // Track external link clicks so the boot restore above knows this reload
  // came from returning off-site rather than a plain refresh.
  React.useEffect(() => installExternalNavigationTracker(), []);

  // Restore trip after a bfcache resurrection (pageshow persisted) when
  // returning from an external site. Focus/visibility restores were removed:
  // they hijacked normal in-app navigation on every tab switch.
  React.useEffect(() => {
    const onPageShow = (ev: PageTransitionEvent): void => {
      if (!ev.persisted || !shouldRestoreMobileNav()) return;
      const nav = loadPersistedMobileNav();
      if (nav.view === 'singleTrip' && (nav.tripId || '').trim()) {
        setSelectedTripId(nav.tripId!.trim());
        setInitialMobileTab((nav.tripTab as MobileTab | undefined) || undefined);
        setView('singleTrip');
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
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
