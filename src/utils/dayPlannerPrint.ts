import { openDayPlannerPrintPreview, type DayPlannerPrintDay } from './dayPlannerPrintHtml';

export type { DayPlannerPrintDay, DayPlannerPrintEntry } from './dayPlannerPrintHtml';

/** Print day planner using self-contained HTML (reliable in SharePoint). */
export function printDayPlannerData(title: string, days: DayPlannerPrintDay[]): boolean {
  return openDayPlannerPrintPreview(title, days, false);
}

/** @deprecated DOM clone print — use printDayPlannerData instead. */
export function printDayPlannerFromPage(): boolean {
  return false;
}

/** @deprecated DOM clone print — use printDayPlannerData instead. */
export function printDayPlannerElement(_source: HTMLElement): boolean {
  return false;
}
