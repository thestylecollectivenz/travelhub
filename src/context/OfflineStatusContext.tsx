import * as React from 'react';

export const OFFLINE_EDIT_MESSAGE =
  "You're offline. You can view the last saved trip, but changes can't be saved until you're back online.";

export const OFFLINE_WRITE_MESSAGE =
  "You're offline. That action needs a connection — try again when you're back online.";

export interface OfflineStatusContextValue {
  isOnline: boolean;
  isOffline: boolean;
  /** True when the open trip was hydrated from local cache after a failed network load. */
  viewingCachedTrip: boolean;
  setViewingCachedTrip: (value: boolean) => void;
  lastCachedAt: string | null;
  setLastCachedAt: (iso: string | null) => void;
  /**
   * If offline, show a warning and return true (caller should abort).
   * If online, return false.
   */
  warnIfOffline: (kind?: 'edit' | 'write') => boolean;
}

const OfflineStatusContext = React.createContext<OfflineStatusContextValue | undefined>(undefined);

export const OfflineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const [viewingCachedTrip, setViewingCachedTrip] = React.useState(false);
  const [lastCachedAt, setLastCachedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    const on = (): void => setIsOnline(true);
    const off = (): void => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  React.useEffect(() => {
    if (isOnline) setViewingCachedTrip(false);
  }, [isOnline]);

  const warnIfOffline = React.useCallback(
    (kind: 'edit' | 'write' = 'edit'): boolean => {
      if (isOnline) return false;
      window.alert(kind === 'write' ? OFFLINE_WRITE_MESSAGE : OFFLINE_EDIT_MESSAGE);
      return true;
    },
    [isOnline]
  );

  const value = React.useMemo(
    (): OfflineStatusContextValue => ({
      isOnline,
      isOffline: !isOnline,
      viewingCachedTrip,
      setViewingCachedTrip,
      lastCachedAt,
      setLastCachedAt,
      warnIfOffline
    }),
    [isOnline, viewingCachedTrip, lastCachedAt, warnIfOffline]
  );

  return <OfflineStatusContext.Provider value={value}>{children}</OfflineStatusContext.Provider>;
};

export function useOfflineStatus(): OfflineStatusContextValue {
  const ctx = React.useContext(OfflineStatusContext);
  if (!ctx) {
    // Safe fallback when provider missing (tests / partial trees)
    return {
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
      isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
      viewingCachedTrip: false,
      setViewingCachedTrip: () => undefined,
      lastCachedAt: null,
      setLastCachedAt: () => undefined,
      warnIfOffline: () => false
    };
  }
  return ctx;
}
