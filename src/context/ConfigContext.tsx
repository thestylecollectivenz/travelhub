import * as React from 'react';
import { useSpContext } from './SpContext';
import { ConfigService, DEFAULT_USER_CONFIG, UserConfig, resolveUserConfigKey } from '../services/ConfigService';
import { getCurrentUserDisplayName, getCurrentUserEmail } from '../utils/currentUserEmail';

export interface ConfigContextValue {
  config: UserConfig;
  /** Resolved name for journal bylines and new entries: custom JournalAuthorName or M365 display name. */
  journalAuthorName: string;
  /** Greeting first name: journal name → SharePoint display first word → email local-part. */
  greetingName: string;
  userId: string;
  configLoading: boolean;
  saveConfig: (next: UserConfig) => Promise<void>;
}

const ConfigContext = React.createContext<ConfigContextValue | undefined>(undefined);

function firstWord(value: string): string {
  return value.trim().split(/\s+/)[0] || '';
}

function emailLocalPart(email: string): string {
  const local = email.trim().split('@')[0] || '';
  return local.replace(/[._-]+/g, ' ').trim().split(/\s+/)[0] || local || 'traveller';
}

export interface ConfigProviderProps {
  children: React.ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const spContext = useSpContext();
  const userId = resolveUserConfigKey(spContext);
  const [config, setConfig] = React.useState<UserConfig>(DEFAULT_USER_CONFIG);
  const [configLoading, setConfigLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setConfigLoading(true);
    const svc = new ConfigService(spContext);
    svc
      .getConfig(userId)
      .then((loaded) => {
        // eslint-disable-next-line no-console
        console.info('ConfigProvider loaded', {
          userId,
          journalAuthorName: loaded.journalAuthorName,
          hasWeatherKey: Boolean(loaded.weatherApiKey),
          hasGeminiKey: Boolean(loaded.geminiApiKey),
          homeCurrency: loaded.homeCurrency
        });
        if (mounted) setConfig(loaded);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('ConfigProvider.getConfig', err);
      })
      .finally(() => {
        if (mounted) setConfigLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [spContext, userId]);

  const journalAuthorName = React.useMemo(() => {
    const custom = (config.journalAuthorName ?? '').trim();
    const dn = getCurrentUserDisplayName(spContext);
    return custom || dn;
  }, [config.journalAuthorName, spContext]);

  const greetingName = React.useMemo(() => {
    const journal = firstWord(config.journalAuthorName || '');
    if (journal) return journal;
    const display = firstWord(getCurrentUserDisplayName(spContext));
    if (display) return display;
    return emailLocalPart(getCurrentUserEmail(spContext));
  }, [config.journalAuthorName, spContext]);

  const saveConfig = React.useCallback(
    async (next: UserConfig): Promise<void> => {
      const svc = new ConfigService(spContext);
      await svc.saveConfig(userId, next);
      // Prefer the values we just saved; re-read only to pick up any server defaults.
      const roundTrip = await svc.getConfig(userId);
      setConfig({ ...next, ...roundTrip });
    },
    [spContext, userId]
  );

  const value = React.useMemo<ConfigContextValue>(
    () => ({
      config,
      journalAuthorName,
      greetingName,
      userId,
      configLoading,
      saveConfig
    }),
    [config, journalAuthorName, greetingName, userId, configLoading, saveConfig]
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
