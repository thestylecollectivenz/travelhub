import * as React from 'react';
import { useSpContext } from './SpContext';
import { AppConfigService } from '../services/AppConfigService';

export interface AppConfigContextValue {
  /** In-memory map for the session — keys match SharePoint AppConfig.ConfigKey. */
  appConfig: Map<string, string>;
  getAppConfig(key: string): string | undefined;
}

const AppConfigContext = React.createContext<AppConfigContextValue | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const [appConfig, setAppConfig] = React.useState<Map<string, string>>(() => new Map());

  React.useEffect(() => {
    let cancelled = false;
    const svc = new AppConfigService(spContext);
    svc
      .getAll()
      .then((m) => {
        if (!cancelled) setAppConfig(m);
      })
      .catch(() => {
        if (!cancelled) setAppConfig(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [spContext]);

  const getAppConfig = React.useCallback(
    (key: string): string | undefined => {
      const v = appConfig.get(key);
      return v !== undefined && v !== '' ? v : undefined;
    },
    [appConfig]
  );

  const value = React.useMemo<AppConfigContextValue>(() => ({ appConfig, getAppConfig }), [appConfig, getAppConfig]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export function useAppConfig(): AppConfigContextValue {
  const ctx = React.useContext(AppConfigContext);
  if (!ctx) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return ctx;
}
