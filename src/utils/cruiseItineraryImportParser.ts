export interface ParsedCruiseRow {
  dayNumber: number;
  port: string;
  arrive: string;
  depart: string;
  date?: string;
}

function normalizeTime(value: string): string {
  const s = value.trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return '';
  let hh = Number(m[1]);
  const mm = m[2];
  const ap = (m[4] || '').toUpperCase();
  if (ap === 'PM' && hh < 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(hh)}:${mm}`;
}

function parseHollandAmerica(html: string): ParsedCruiseRow[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const rows: ParsedCruiseRow[] = [];
  for (const table of tables) {
    const headerCells = Array.from(table.querySelectorAll('thead tr th, thead tr td')).map((c) => c.textContent?.trim() ?? '');
    if (!headerCells.length) continue;
    const lower = headerCells.map((h) => h.toLowerCase());
    const dayIdx = lower.findIndex((h) => h.includes('day'));
    const portIdx = lower.findIndex((h) => h.includes('port'));
    const arrIdx = lower.findIndex((h) => h.includes('arriv'));
    const depIdx = lower.findIndex((h) => h.includes('depart'));
    if (portIdx < 0 || arrIdx < 0 || depIdx < 0) continue;
    const bodyRows = table.querySelectorAll('tbody tr');
    bodyRows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((c) => c.textContent?.trim() ?? '');
      if (!cells.length) return;
      const dayNum = dayIdx >= 0 ? Number((cells[dayIdx] || '').replace(/\D+/g, '')) : rows.length + 1;
      const port = cells[portIdx] || '';
      if (!port || port.toLowerCase().includes('at sea')) return;
      rows.push({
        dayNumber: Number.isFinite(dayNum) && dayNum > 0 ? dayNum : rows.length + 1,
        port,
        arrive: normalizeTime(cells[arrIdx] || ''),
        depart: normalizeTime(cells[depIdx] || '')
      });
    });
  }
  return rows;
}

function parseGenericText(text: string): ParsedCruiseRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedCruiseRow[] = [];
  for (const line of lines) {
    const m = line.match(
      /Day\s*(\d+)[\s:,]+(.+?)(?:\s*[\u2013]\s*|\s+-\s+|\s+)(?:Arrive|Arrival)?\s*([\d:APM \t]+)?\s*(?:Depart|Departure)?\s*([\d:APM \t]+)?/i
    );
    if (!m) continue;
    rows.push({
      dayNumber: Number(m[1]),
      port: m[2].trim(),
      arrive: normalizeTime(m[3] || ''),
      depart: normalizeTime(m[4] || '')
    });
  }
  return rows;
}

export function parseCruiseItineraryFromHtml(url: string, html: string): ParsedCruiseRow[] {
  if (url.toLowerCase().includes('hollandamerica.com')) {
    const ha = parseHollandAmerica(html);
    if (ha.length) return ha;
  }
  return parseGenericText(html.replace(/<[^>]+>/g, '\n'));
}

export function parseCruiseItineraryFromText(text: string): ParsedCruiseRow[] {
  return parseGenericText(text);
}
