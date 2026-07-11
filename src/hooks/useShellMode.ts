import * as React from 'react';

/** Viewport shell — controls which component tree renders (phone / iPad / desktop). */
export type ShellMode = 'phone' | 'ipad-portrait' | 'ipad-landscape' | 'desktop';

export const PHONE_MAX_WIDTH_PX = 767;
/** Max width treated as tablet (iPad Pro 12.9″ landscape). Wider → desktop. */
export const TABLET_MAX_WIDTH_PX = 1366;

export function isCompactTouchShell(mode: ShellMode): boolean {
  return mode === 'phone' || mode === 'ipad-portrait';
}

function isIpadLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return true;
  // iPadOS 13+ may report as Mac; multi-touch indicates tablet.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

function isTabletViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  if (w <= PHONE_MAX_WIDTH_PX || w > TABLET_MAX_WIDTH_PX) return false;
  if (isIpadLikeDevice()) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function resolveShellMode(): ShellMode {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= PHONE_MAX_WIDTH_PX) return 'phone';
  if (w > TABLET_MAX_WIDTH_PX) return 'desktop';
  if (isTabletViewport()) {
    return h > w ? 'ipad-portrait' : 'ipad-landscape';
  }
  return 'desktop';
}

export function useShellMode(): ShellMode {
  const [mode, setMode] = React.useState<ShellMode>(() => resolveShellMode());

  React.useEffect(() => {
    const refresh = (): void => setMode(resolveShellMode());
    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    const coarse = window.matchMedia('(pointer: coarse)');
    if (typeof coarse.addEventListener === 'function') {
      coarse.addEventListener('change', refresh);
    } else {
      coarse.addListener(refresh);
    }
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      if (typeof coarse.removeEventListener === 'function') {
        coarse.removeEventListener('change', refresh);
      } else {
        coarse.removeListener(refresh);
      }
    };
  }, []);

  return mode;
}
