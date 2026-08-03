import * as React from 'react';
import { isLikelyNetworkError } from '../utils/networkError';

export const OFFLINE_EDIT_MESSAGE =
  "You're offline. You can view the last saved trip, but changes can't be saved until you're back online.";

export const OFFLINE_WRITE_MESSAGE =
  "You're offline. That action needs a connection — try again when you're back online.";

export interface OfflineStatusContextValue {
  isOnline: boolean;
  isOffline: boolean;
  /** True when trip/home data was hydrated from local cache after a failed network load. */
  viewingCachedTrip: boolean;
  setViewingCachedTrip: (value: boolean) => void;
  lastCachedAt: string | null;
  setLastCachedAt: (iso: string | null) => void;
  /**
   * If offline or cache-only, show a warning and return true (caller should abort).
   * If online with live data, return false.
   */
  warnIfOffline: (kind?: 'edit' | 'write') => boolean;
  /** Mark connectivity lost after a failed network call (Safari often still reports navigator.onLine). */
  reportNetworkFailure: (err?: unknown) => void;
  clearForcedOffline: () => void;
}

const OfflineStatusContext = React.createContext<OfflineStatusContextValue | undefined>(undefined);

function readBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export const OfflineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [browserOnline, setBrowserOnline] = React.useState(readBrowserOnline);
  const [forcedOffline, setForcedOffline] = React.useState(false);
  const [viewingCachedTrip, setViewingCachedTrip] = React.useState(false);
  const [lastCachedAt, setLastCachedAt] = React.useState<string | null>(null);

  const isOnline = browserOnline && !forcedOffline;

  React.useEffect(() => {
    const on = (): void => {
      setBrowserOnline(true);
      setForcedOffline(false);
    };
    const off = (): void => {
      setBrowserOnline(false);
      setForcedOffline(true);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const onVis = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (!readBrowserOnline()) {
        setBrowserOnline(false);
        setForcedOffline(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const reportNetworkFailure = React.useCallback((err?: unknown): void => {
    if (err !== undefined && !isLikelyNetworkError(err) && readBrowserOnline()) {
      return;
    }
    setForcedOffline(true);
    if (!readBrowserOnline()) setBrowserOnline(false);
  }, []);

  const clearForcedOffline = React.useCallback((): void => {
    setForcedOffline(false);
    setBrowserOnline(readBrowserOnline());
  }, []);

  const warnIfOffline = React.useCallback(
    (kind: 'edit' | 'write' = 'edit'): boolean => {
      const offlineNow = !readBrowserOnline() || forcedOffline;
      if (!offlineNow && !viewingCachedTrip) return false;
      window.alert(kind === 'write' ? OFFLINE_WRITE_MESSAGE : OFFLINE_EDIT_MESSAGE);
      return true;
    },
    [forcedOffline, viewingCachedTrip]
  );

  const value = React.useMemo(
    (): OfflineStatusContextValue => ({
      isOnline,
      isOffline: !isOnline,
      viewingCachedTrip,
      setViewingCachedTrip,
      lastCachedAt,
      setLastCachedAt,
      warnIfOffline,
      reportNetworkFailure,
      clearForcedOffline
    }),
    [isOnline, viewingCachedTrip, lastCachedAt, warnIfOffline, reportNetworkFailure, clearForcedOffline]
  );

  return <OfflineStatusContext.Provider value={value}>{children}</OfflineStatusContext.Provider>;
};

export function useOfflineStatus(): OfflineStatusContextValue {
  const ctx = React.useContext(OfflineStatusContext);
  if (!ctx) {
    return {
      isOnline: readBrowserOnline(),
      isOffline: !readBrowserOnline(),
      viewingCachedTrip: false,
      setViewingCachedTrip: () => undefined,
      lastCachedAt: null,
      setLastCachedAt: () => undefined,
      warnIfOffline: () => false,
      reportNetworkFailure: () => undefined,
      clearForcedOffline: () => undefined
    };
  }
  return ctx;
}
