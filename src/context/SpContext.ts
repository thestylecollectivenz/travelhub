import * as React from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export const SpContext = React.createContext<WebPartContext | null>(null);

export function useSpContext(): WebPartContext {
  const ctx = React.useContext(SpContext);
  if (!ctx) throw new Error('useSpContext must be used within SpContext.Provider');
  return ctx;
}
