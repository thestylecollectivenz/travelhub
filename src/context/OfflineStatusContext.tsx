import * as React from 'react';
import { isLikelyNetworkError } from '../utils/networkError';
import { flashToast } from '../utils/flashToast';
import { useSpContext } from './SpContext';

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

/** iOS Safari / WKWebView often leave navigator.onLine true in airplane mode. */
function readBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  // Explicit false only — undefined / missing treated as online for SSR safety.
  return navigator.onLine !== false;
}

/**
 * Lightweight reachability check. Any HTTP response (including 401/403) means the
 * radio path works; abort / TypeError means offline for our purposes.
 */
async function probeSharePointReachable(webAbsoluteUrl: string): Promise<boolean> {
  const base = (webAbsoluteUrl || '').replace(/\/$/, '');
  if (!base || typeof fetch === 'undefined') return readBrowserOnline();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer =
    ctrl && typeof window !== 'undefined'
      ? window.setTimeout(() => {
          try {
            ctrl.abort();
          } catch {
            /* ignore */
          }
        }, 4500)
      : 0;
  try {
    const resp = await fetch(`${base}/_api/web/title`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=nometadata' },
      signal: ctrl?.signal
    });
    // Any status proves the network path is up (auth failures still count as online).
    return resp.status > 0;
  } catch {
    return false;
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

function showOfflineWarning(message: string): void {
  // Prefer in-DOM toast: window.alert is suppressed or delayed in many SharePoint /
  // Teams iOS WebViews (especially older iPhones).
  flashToast(message, 4200, { tone: 'warn' });
}

export const OfflineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const webUrl = React.useMemo(
    () => (spContext.pageContext.web.absoluteUrl || '').replace(/\/$/, ''),
    [spContext.pageContext.web.absoluteUrl]
  );

  const [browserOnline, setBrowserOnline] = React.useState(readBrowserOnline);
  const [forcedOffline, setForcedOffline] = React.useState(false);
  const [viewingCachedTrip, setViewingCachedTrip] = React.useState(false);
  const [lastCachedAt, setLastCachedAt] = React.useState<string | null>(null);
  const probeInFlight = React.useRef(false);
  const lastProbeAt = React.useRef(0);

  const isOnline = browserOnline && !forcedOffline;

  const markOffline = React.useCallback((): void => {
    setForcedOffline(true);
    if (!readBrowserOnline()) setBrowserOnline(false);
  }, []);

  const markOnline = React.useCallback((): void => {
    setForcedOffline(false);
    setBrowserOnline(true);
  }, []);

  const runProbe = React.useCallback(
    async (reason: string): Promise<void> => {
      if (!webUrl) return;
      const now = Date.now();
      // Throttle probes — older radios + SharePoint app thrash easily.
      if (probeInFlight.current) return;
      if (reason !== 'force' && now - lastProbeAt.current < 8000) return;
      lastProbeAt.current = now;
      probeInFlight.current = true;
      let reachable = false;
      try {
        reachable = await probeSharePointReachable(webUrl);
      } catch {
        reachable = false;
      }
      // eslint-disable-next-line require-atomic-updates -- ref gate cleared after probe completes
      probeInFlight.current = false;
      if (reachable) {
        markOnline();
      } else {
        markOffline();
        if (!readBrowserOnline()) setBrowserOnline(false);
      }
    },
    [webUrl, markOnline, markOffline]
  );

  React.useEffect(() => {
    const on = (): void => {
      setBrowserOnline(true);
      // Verify — iOS sometimes fires "online" while still unreachable.
      runProbe('online-event').catch(() => undefined);
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
        return;
      }
      runProbe('visibility').catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    window.addEventListener('focus', onVis);

    // Periodic probe: older iOS often never fires offline until a request fails.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      runProbe('interval').catch(() => undefined);
    }, 20000);

    // First paint probe shortly after mount.
    const boot = window.setTimeout(() => {
      runProbe('boot').catch(() => undefined);
    }, 1200);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
      window.removeEventListener('focus', onVis);
      window.clearInterval(interval);
      window.clearTimeout(boot);
    };
  }, [runProbe]);

  const reportNetworkFailure = React.useCallback(
    (err?: unknown): void => {
      if (err !== undefined && !isLikelyNetworkError(err) && readBrowserOnline()) {
        return;
      }
      markOffline();
    },
    [markOffline]
  );

  const clearForcedOffline = React.useCallback((): void => {
    setForcedOffline(false);
    setBrowserOnline(readBrowserOnline());
    runProbe('force').catch(() => undefined);
  }, [runProbe]);

  const warnIfOffline = React.useCallback(
    (kind: 'edit' | 'write' = 'edit'): boolean => {
      const offlineNow = !readBrowserOnline() || forcedOffline || !isOnline;
      if (!offlineNow && !viewingCachedTrip) {
        // Kick a background probe so the next attempt / banner catch up on stale onLine.
        runProbe('pre-write').catch(() => undefined);
        return false;
      }
      showOfflineWarning(kind === 'write' ? OFFLINE_WRITE_MESSAGE : OFFLINE_EDIT_MESSAGE);
      return true;
    },
    [forcedOffline, isOnline, viewingCachedTrip, runProbe]
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
      // Outside provider: still show a toast so callers never silently no-op.
      warnIfOffline: (kind = 'edit') => {
        if (readBrowserOnline()) return false;
        showOfflineWarning(kind === 'write' ? OFFLINE_WRITE_MESSAGE : OFFLINE_EDIT_MESSAGE);
        return true;
      },
      reportNetworkFailure: () => undefined,
      clearForcedOffline: () => undefined
    };
  }
  return ctx;
}
