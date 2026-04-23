import * as React from 'react';
import { useSpContext } from './SpContext';
import { ConfigService, DEFAULT_USER_CONFIG, UserConfig } from '../services/ConfigService';

export interface ConfigContextValue {
  config: UserConfig;
  userId: string;
  saveConfig: (next: UserConfig) => Promise<void>;
}

const ConfigContext = React.createContext<ConfigContextValue | undefined>(undefined);

export interface ConfigProviderProps {
  children: React.ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const spContext = useSpContext();
  const userId = spContext.pageContext.user.loginName;
  const [config, setConfig] = React.useState<UserConfig>(DEFAULT_USER_CONFIG);

  React.useEffect(() => {
    let mounted = true;
    const svc = new ConfigService(spContext);
    svc
      .getConfig(userId)
      .then((loaded) => {
        if (mounted) {
          setConfig(loaded);
        }
      })
      .catch(() => {
        // Fall back silently to defaults.
      });
    return () => {
      mounted = false;
    };
  }, [spContext, userId]);

  const saveConfig = React.useCallback(
    async (next: UserConfig): Promise<void> => {
      setConfig(next);
      const svc = new ConfigService(spContext);
      try {
        await svc.saveConfig(userId, next);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ConfigContext.saveConfig', err);
      }
    },
    [spContext, userId]
  );

  const value = React.useMemo<ConfigContextValue>(
    () => ({
      config,
      userId,
      saveConfig
    }),
    [config, userId, saveConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export function useConfig(): ConfigContextValue {
  const ctx = React.useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return ctx;
}
