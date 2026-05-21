import * as XLSX from 'xlsx';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import { BUDGET_CATEGORY_ORDER, formatCurrency } from './financialUtils';
import { buildBudgetDetailLines, bucketCategory, sumBudgetLines } from './budgetDetailLines';
import type { TripDay } from '../models/TripDay';

export function exportFullBudgetToExcel(options: {
  trip: Trip;
  entries: ItineraryEntry[];
  tripDays: TripDay[];
  homeCurrency: string;
  convertToHomeCurrency: (amount: number, currency: string) => number;
  dayLabelFor: (dayId: string) => string;
}): void {
  const { trip, entries, tripDays, homeCurrency, convertToHomeCurrency, dayLabelFor } = options;
  const workbook = XLSX.utils.book_new();
  const rows: Array<Record<string, string | number>> = [];

  for (const category of BUDGET_CATEGORY_ORDER) {
    const lines = buildBudgetDetailLines(entries, category, convertToHomeCurrency, dayLabelFor, tripDays);
    if (!lines.length) continue;
    const totals = sumBudgetLines(lines);
    rows.push({
      Category: category,
      Item: '(category totals)',
      Dates: '',
      'Total budget': totals.total,
      'Spent so far': totals.spent,
      Remaining: totals.remaining,
      Certainty: ''
    });
    for (const line of lines) {
      rows.push({
        Category: category,
        Item: line.isSubItem ? `  → ${line.title}` : line.title,
        Dates: [...line.dateLines, line.spanLabel].filter(Boolean).join(' · '),
        'Total budget': line.total,
        'Spent so far': line.spent,
        Remaining: line.remaining,
        Certainty: line.costCertainty
      });
    }
  }

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Full budget');
  const summary = [
    { Field: 'Trip', Value: trip.title },
    { Field: 'Currency', Value: homeCurrency },
    { Field: 'Exported', Value: new Date().toISOString().slice(0, 10) }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Info');
  XLSX.writeFile(workbook, `${trip.title.replace(/[^\w-]+/g, '_') || 'trip'}-budget.xlsx`);
}

export function buildBudgetPrintHtml(options: {
  tripTitle: string;
  homeCurrency: string;
  tripDayCount: number;
  totalBudget: number;
  spentSoFar: number;
  remaining: number;
  averagePerDay: number;
  entries: ItineraryEntry[];
  tripDays: TripDay[];
  convertToHomeCurrency: (amount: number, currency: string) => number;
  dayLabelFor: (dayId: string) => string;
}): string {
  const fmt = (n: number): string => formatCurrency(n, options.homeCurrency);
  let body = '';
  for (const category of BUDGET_CATEGORY_ORDER) {
    const lines = buildBudgetDetailLines(
      options.entries,
      category,
      options.convertToHomeCurrency,
      options.dayLabelFor,
      options.tripDays
    );
    if (!lines.length) continue;
    const totals = sumBudgetLines(lines);
    body += `<h2>${category}</h2><table class="budget-table" border="1" cellpadding="6" cellspacing="0">`;
    body += `<colgroup><col class="col-details"/><col class="col-money"/><col class="col-money"/><col class="col-money"/></colgroup>`;
    body += `<thead><tr><th class="th-details">Details</th><th class="th-money">Total budget</th><th class="th-money">Spent so far</th><th class="th-money">Remaining</th></tr>`;
    body += `<tr class="totals-row"><td>Totals</td><td class="td-money">${fmt(totals.total)}</td><td class="td-money">${fmt(totals.spent)}</td><td class="td-money">${fmt(totals.remaining)}</td></tr></thead><tbody>`;
    for (const line of lines) {
      const certainty = line.costCertainty === 'Estimated' ? ' (est.)' : '';
      const rowClass = line.costCertainty === 'Estimated' ? 'row-estimated' : '';
      body += `<tr class="${rowClass}"><td class="td-details"><strong>${line.isSubItem ? '→ ' : ''}${line.title}</strong>${certainty}<br/><small>${line.dateLines.join(' · ')}${line.spanLabel ? ` · ${line.spanLabel}` : ''}</small></td>`;
      body += `<td class="td-money">${fmt(line.total)}</td><td class="td-money">${fmt(line.spent)}</td><td class="td-money">${fmt(line.remaining)}</td></tr>`;
    }
    body += '</tbody></table>';
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${options.tripTitle} — Budget</title>
<style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#1a3a5c}h1{font-size:22px}h2{font-size:16px;margin-top:1.5em}
.summary{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.chip{border:1px solid #d4c4a8;padding:10px 16px;border-radius:8px;text-align:center}
.chip strong{display:block;font-size:18px}.chip span{font-size:11px;text-transform:uppercase;color:#666}
.budget-table{width:100%;border-collapse:collapse;margin-bottom:1.5em;font-size:13px;table-layout:fixed}
.col-details{width:52%}.col-money{width:16%}
.th-details,.td-details{text-align:left;vertical-align:top;word-wrap:break-word}
.th-money,.td-money{text-align:right;vertical-align:top;white-space:nowrap}
.totals-row{font-weight:bold;background:#f5f0e8}
.row-estimated{background:#ebe4d8}</style></head><body>
<h1>${options.tripTitle} — Trip budget</h1>
<p>${options.tripDayCount} trip days · All figures in ${options.homeCurrency}</p>
<div class="summary">
<div class="chip"><strong>${fmt(options.totalBudget)}</strong><span>Total budget</span></div>
<div class="chip"><strong>${fmt(options.spentSoFar)}</strong><span>Spent so far</span></div>
<div class="chip"><strong>${fmt(options.remaining)}</strong><span>Remaining</span></div>
<div class="chip"><strong>${fmt(options.averagePerDay)}</strong><span>Avg per day</span></div>
</div>
<p><span style="display:inline-block;width:12px;height:12px;background:#e8dfd0;border:1px solid #999;margin-right:6px"></span> Estimated &nbsp;
<span style="display:inline-block;width:12px;height:12px;background:#fff;border:1px solid #999;margin-right:6px"></span> Confirmed</p>
${body}
</body></html>`;
}
