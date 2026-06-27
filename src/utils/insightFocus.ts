export type InsightPane = 'tasks' | 'files' | 'budget';

export const INSIGHT_FOCUS_EVENT = 'travelhub-insight-focus';

export interface InsightFocusDetail {
  pane: InsightPane;
  focus: string;
}

export function requestInsightFocus(pane: InsightPane, focus: string): void {
  window.dispatchEvent(
    new CustomEvent<InsightFocusDetail>(INSIGHT_FOCUS_EVENT, {
      detail: { pane, focus }
    })
  );
}

export function clearInsightFocus(pane: InsightPane): void {
  requestInsightFocus(pane, '');
}
