import * as React from 'react';
import { useSpContext } from './SpContext';
import { AppConfigService } from '../services/AppConfigService';

export interface AppConfigContextValue {
  /** In-memory map for the session — keys match SharePoint AppConfig.ConfigKey. */
  appConfig: Map<string, string>;
  getAppConfig(key: string): string | undefined;
  reloadAppConfig: () => Promise<void>;
  saveAppConfigValue: (key: string, value: string) => Promise<void>;
}

const AppConfigContext = React.createContext<AppConfigContextValue | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const spContext = useSpContext();
  const [appConfig, setAppConfig] = React.useState<Map<string, string>>(() => new Map());

  const reloadAppConfig = React.useCallback(async (): Promise<void> => {
    const svc = new AppConfigService(spContext);
    const m = await svc.getAll();
    setAppConfig(m);
  }, [spContext]);

  React.useEffect(() => {
    void reloadAppConfig().catch(console.error);
  }, [reloadAppConfig]);

  const getAppConfig = React.useCallback(
    (key: string): string | undefined => {
      const v = appConfig.get(key);
      return v !== undefined && v !== '' ? v : undefined;
    },
    [appConfig]
  );

  const saveAppConfigValue = React.useCallback(
    async (key: string, value: string): Promise<void> => {
      const svc = new AppConfigService(spContext);
      await svc.setValue(key, value);
      await reloadAppConfig();
    },
    [spContext, reloadAppConfig]
  );

  const value = React.useMemo<AppConfigContextValue>(
    () => ({ appConfig, getAppConfig, reloadAppConfig, saveAppConfigValue }),
    [appConfig, getAppConfig, reloadAppConfig, saveAppConfigValue]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export function useAppConfig(): AppConfigContextValue {
  const ctx = React.useContext(AppConfigContext);
  if (!ctx) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return ctx;
}
