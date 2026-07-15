import * as React from 'react';

export interface MobileHeaderChromeValue {
  /** Trip used by the access (members) avatar button. */
  accessTripId?: string;
  /** Open trip access / members panel hosted by the shell. */
  onOpenAccess?: () => void;
  /** Open traveller profile / settings. Falls back to travelhub-open-settings event. */
  onOpenSettings?: () => void;
}

const MobileHeaderChromeContext = React.createContext<MobileHeaderChromeValue>({});

export const MobileHeaderChromeProvider: React.FC<{
  value: MobileHeaderChromeValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <MobileHeaderChromeContext.Provider value={value}>{children}</MobileHeaderChromeContext.Provider>
);

export function useMobileHeaderChrome(): MobileHeaderChromeValue {
  return React.useContext(MobileHeaderChromeContext);
}
