import type { UserConfig } from '../services/ConfigService';

/** Matches TripSidebar.module.css tab strip (2.25rem tabs + gap + horizontal padding). */
const TAB_WIDTH_PX = 36;
const TAB_GAP_PX = 4;
const TAB_STRIP_PADDING_PX = 16;

const LS_CUSTOMIZED = 'th-sidebar-width-customized';

export function computeSidebarWidthForTabCount(tabCount: number): number {
  if (tabCount <= 0) return 200;
  const tabs = tabCount * TAB_WIDTH_PX + Math.max(0, tabCount - 1) * TAB_GAP_PX;
  return tabs + TAB_STRIP_PADDING_PX * 2;
}

/** Private workspace: itinerary, map, budget, journal, photos, files, plan */
export const PRIVATE_WORKSPACE_TAB_COUNT = 7;

/** Shared preview: map, files, itinerary, journal, photos */
export const SHARED_WORKSPACE_TAB_COUNT = 5;

export function defaultPrivateSidebarWidth(): number {
  return computeSidebarWidthForTabCount(PRIVATE_WORKSPACE_TAB_COUNT);
}

export function isSidebarWidthCustomized(config: UserConfig): boolean {
  if (config.sidebarWidthCustomized === true) return true;
  try {
    return localStorage.getItem(LS_CUSTOMIZED) === '1';
  } catch {
    return false;
  }
}

export function markSidebarWidthCustomized(): void {
  try {
    localStorage.setItem(LS_CUSTOMIZED, '1');
  } catch {
    /* ignore */
  }
}

export function resolveSidebarWidthPx(config: UserConfig, tabCount: number): number {
  if (isSidebarWidthCustomized(config)) {
    const w = config.sidebarWidth || 260;
    return Math.max(180, Math.min(400, w));
  }
  return computeSidebarWidthForTabCount(tabCount);
}
