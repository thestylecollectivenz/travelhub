export interface DayPlannerPrintEntry {
  title: string;
  timeLabel: string;
  duration: string;
  category?: string;
  subItems?: string[];
  details?: string[];
}

export interface DayPlannerPrintDay {
  dayLabel: string;
  timed: DayPlannerPrintEntry[];
  unscheduled: DayPlannerPrintEntry[];
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PLANNER_PRINT_STYLES = `
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0e3d5e; background: #fff; }
.toolbar { position: sticky; top: 0; z-index: 2; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.toolbar button { border: none; border-radius: 8px; padding: 8px 16px; background: #1a6399; color: #fff; font-weight: 600; cursor: pointer; }
.th-planner-print { padding: 16px 20px 40px; max-width: 72rem; margin: 0 auto; }
.th-planner-print h1 { font-size: 1.35rem; margin: 0 0 1rem; }
.print-day { margin-bottom: 1.5rem; page-break-inside: avoid; }
.print-day h2 { font-size: 1.05rem; margin: 0 0 0.5rem; padding-bottom: 4px; border-bottom: 2px solid #1a6399; }
.print-unsched { margin: 0.5rem 0 0.75rem; padding: 8px 10px; background: #f0ebe0; border-radius: 8px; }
.print-unsched h3 { margin: 0 0 6px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #5c4f3a; }
.print-entry { display: grid; grid-template-columns: 4.5rem 1fr; gap: 4px 12px; padding: 6px 0; border-bottom: 1px solid #e8e4dc; font-size: 0.9rem; }
.print-entry:last-child { border-bottom: none; }
.print-time { font-weight: 600; color: #1a6399; }
.print-title { font-weight: 600; }
.print-meta { grid-column: 2; font-size: 0.8rem; color: #5c4f3a; }
.print-details { grid-column: 2; margin: 2px 0 0; font-size: 0.8rem; color: #5c4f3a; line-height: 1.35; }
.print-details div { margin-top: 2px; }
.print-subs { grid-column: 2; margin: 2px 0 0; padding-left: 1rem; font-size: 0.8rem; color: #3a3025; }
@media print {
  .toolbar { display: none !important; }
  .th-planner-print { padding: 0; max-width: none; }
}
`;

function renderEntryBlock(e: DayPlannerPrintEntry): string {
  const meta = [e.duration, e.category].filter(Boolean).join(' · ');
  let html = '<div class="print-entry">\n'
    + '    <div class="print-time">' + esc(e.timeLabel) + '</div>\n'
    + '    <div class="print-title">' + esc(e.title) + '</div>';
  if (meta) {
    html += '<div class="print-meta">' + esc(meta) + '</div>';
  }
  if (e.details?.length) {
    html += '<div class="print-details">' + e.details.map((d) => '<div>' + esc(d) + '</div>').join('') + '</div>';
  }
  if (e.subItems?.length) {
    html += '<ul class="print-subs">' + e.subItems.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>';
  }
  html += '</div>';
  return html;
}

function renderDay(day: DayPlannerPrintDay): string {
  let html = `<section class="print-day"><h2>${esc(day.dayLabel)}</h2>`;
  for (const e of day.timed) html += renderEntryBlock(e);
  if (day.unscheduled.length) {
    html += `<div class="print-unsched"><h3>Unscheduled</h3>`;
    for (const e of day.unscheduled) {
      html += renderEntryBlock({ ...e, timeLabel: '—' });
    }
    html += '</div>';
  }
  html += '</section>';
  return html;
}

export function buildDayPlannerPrintDocument(title: string, days: DayPlannerPrintDay[]): string {
  const body = days.map(renderDay).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)} — Day planner</title><style>${PLANNER_PRINT_STYLES}</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print();return false;">Print / Save PDF</button></div>
<div class="th-planner-print"><h1>${esc(title)}</h1>${body}</div>
</body></html>`;
}

export function openDayPlannerPrintPreview(title: string, days: DayPlannerPrintDay[], autoPrint = true): boolean {
  if (!days.length) return false;
  const doc = buildDayPlannerPrintDocument(title, days);
  const popup = window.open('', '_blank', 'width=960,height=720,scrollbars=yes');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(doc);
  popup.document.close();
  if (autoPrint) {
    const trigger = (): void => {
      try {
        popup.focus();
        popup.print();
      } catch {
        /* ignore */
      }
    };
    if (popup.document.readyState === 'complete') {
      window.setTimeout(trigger, 350);
    } else {
      popup.addEventListener('load', () => window.setTimeout(trigger, 350), { once: true });
    }
  }
  return true;
}
