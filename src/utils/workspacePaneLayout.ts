export const PANE_COLLAPSED_WIDTH_PX = 32;
export const LEFT_PANE_MIN_PX = 200;
export const LEFT_PANE_MAX_PX = 400;
export const RIGHT_PANE_MIN_PX = 200;
export const RIGHT_PANE_MAX_PX = 480;
export const DESKTOP_LAYOUT_MIN_PX = 1280;

export const LS_LEFT_COLLAPSED = 'th_leftPaneCollapsed';
export const LS_RIGHT_WIDTH = 'th_rightPaneWidth';
export const LS_RIGHT_COLLAPSED = 'th_rightPaneCollapsed';

export function readBool(key: string, fallback = false): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readPaneWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        return Math.max(min, Math.min(max, Math.round(n)));
      }
    }
  } catch {
    /* ignore */
  }
  return Math.max(min, Math.min(max, fallback));
}

export function writePaneWidth(key: string, width: number): void {
  try {
    localStorage.setItem(key, String(Math.round(width)));
  } catch {
    /* ignore */
  }
}

/** Default right pane width before user customization (px). */
export function defaultRightPaneWidthPx(): number {
  if (typeof window === 'undefined') return 280;
  return Math.max(RIGHT_PANE_MIN_PX, Math.min(RIGHT_PANE_MAX_PX, Math.round(window.innerWidth * 0.18)));
}
