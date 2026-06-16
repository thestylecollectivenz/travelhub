import * as XLSX from 'xlsx';
import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
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
  locationFor?: (entry: ItineraryEntry, subItem?: ItinerarySubItem) => string;
}): void {
  const { trip, entries, tripDays, homeCurrency, convertToHomeCurrency, dayLabelFor, locationFor } = options;
  const resolveLocation =
    locationFor ?? ((entry, sub) => (sub?.location || entry.location || '').trim());
  const workbook = XLSX.utils.book_new();
  const rows: Array<Record<string, string | number>> = [];

  for (const category of BUDGET_CATEGORY_ORDER) {
    const lines = buildBudgetDetailLines(
      entries,
      category,
      convertToHomeCurrency,
      dayLabelFor,
      tripDays,
      resolveLocation
    );
    if (!lines.length) continue;
    const totals = sumBudgetLines(lines);
    rows.push({
      Category: category,
      Item: '(category totals)',
      Location: '',
      Dates: '',
      'Total budget': totals.total,
      'Spent so far': totals.spent,
      Remaining: totals.remaining,
      Certainty: ''
    });
    for (const line of lines) {
      rows.push({
        Category: category,
        Item: line.isSubItem ? `${line.title} (${line.parentTitle || 'Card'})` : line.title,
        Location: line.locationLine ?? '',
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
  locationFor?: (entry: ItineraryEntry, subItem?: ItinerarySubItem) => string;
}): string {
  const resolveLocation =
    options.locationFor ?? ((entry, sub) => (sub?.location || entry.location || '').trim());
  const fmt = (n: number): string => formatCurrency(n, options.homeCurrency);
  let body = '';
  for (const category of BUDGET_CATEGORY_ORDER) {
    const lines = buildBudgetDetailLines(
      options.entries,
      category,
      options.convertToHomeCurrency,
      options.dayLabelFor,
      options.tripDays,
      resolveLocation
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
      const meta = [line.locationLine, ...line.dateLines, line.spanLabel].filter(Boolean).join(' · ');
      const displayTitle = line.isSubItem ? `${line.title} (${line.parentTitle || 'Card'})` : line.title;
      body += `<tr class="${rowClass}"><td class="td-details"><strong>${displayTitle}</strong>${certainty}<br/><small>${meta}</small></td>`;
      body += `<td class="td-money">${fmt(line.total)}</td><td class="td-money">${fmt(line.spent)}</td><td class="td-money">${fmt(line.remaining)}</td></tr>`;
    }
    body += '</tbody></table>';
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${options.tripTitle} — Budget</title>
<style>
body{font-family:Segoe UI,sans-serif;font-size:12px;color:#1a3a52;margin:1rem}
h1{font-size:18px;margin:0 0 4px}
.summary{display:flex;gap:1rem;margin:1rem 0;flex-wrap:wrap}
.summary div{border:1px solid #ddd;padding:8px 12px;border-radius:6px}
.budget-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem}
.row-estimated{background:#fff8e1}
.td-money,.th-money{text-align:right;white-space:nowrap}
</style></head><body>
<h1>${options.tripTitle} — Trip budget</h1>
<p>${options.tripDayCount} trip days · All figures in ${options.homeCurrency}</p>
<div class="summary">
<div><strong>Total budget</strong><br/>${fmt(options.totalBudget)}</div>
<div><strong>Spent so far</strong><br/>${fmt(options.spentSoFar)}</div>
<div><strong>Remaining</strong><br/>${fmt(options.remaining)}</div>
<div><strong>Avg per day</strong><br/>${fmt(options.averagePerDay)}</div>
</div>
${body}
</body></html>`;
}
