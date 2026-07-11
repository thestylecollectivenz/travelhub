import * as React from 'react';
import { useShellMode, isCompactTouchShell } from './useShellMode';

const MOBILE_MAX_WIDTH_PX = 767;

/** @deprecated Prefer `useShellMode()` — true for phone and iPad portrait compact shells. */
export function useMobileMode(): boolean {
  const mode = useShellMode();
  return isCompactTouchShell(mode);
}

/** True only for phone-width shell (≤767px). */
export function usePhoneMode(): boolean {
  const mode = useShellMode();
  return mode === 'phone';
}

export { MOBILE_MAX_WIDTH_PX };
