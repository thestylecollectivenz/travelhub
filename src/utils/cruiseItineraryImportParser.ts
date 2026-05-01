import { splitCruiseShipMeta } from './cruisePortSanitize';

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

const DATE_LINE = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/;
const EMBEDDED_DATE_LINE = /^(?:(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+)?([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})(.*)$/i;
const AD_TIME = /^(?:ARRIVES|DEPARTS)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;
const AD_STUCK = /^(?:ARRIVES|DEPARTS)(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;
const MONTH_TO_NUM: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12'
};

function isNoiseLine(line: string): boolean {
  const u = line.toUpperCase();
  if (!line.trim()) return true;
  if (u.startsWith('VISA')) return true;
  if (u.includes('WHEELCHAIR')) return true;
  if (u === 'CRUISING ONLY') return true;
  if (u === 'OVERNIGHT') return true;
  if (u.startsWith('TENDER')) return true;
  if (/\b(FRENCH|VERANDA|BALCONY|SUITE|STATEROOM|CABIN|ROOM)\b/i.test(u) && /\b\d{2,4}\b/.test(u)) return true;
  if (/^\d+\s*(?:M2|SQM|SQ FT|SQFT)\b/i.test(u)) return true;
  if (/^DECK\s+\d+/i.test(u)) return true;
  return false;
}

/** Holland America / similar: date line, port line, ARRIVES/DEPARTS (with or without space before time). */
function parseCruiseBlockPlainText(text: string): ParsedCruiseRow[] {
  const raw = text.split(/\r?\n/).map((l) => l.trim());
  const rows: ParsedCruiseRow[] = [];
  let curDate = '';
  let curPort = '';
  let arrive = '';
  let depart = '';
  let dayCounter = 0;

  const flush = (): void => {
    if (!curPort) return;
    dayCounter += 1;
    rows.push({
      dayNumber: dayCounter,
      port: splitCruiseShipMeta(curPort).clean,
      arrive,
      depart,
      date: curDate || undefined
    });
    curPort = '';
    arrive = '';
    depart = '';
  };

  for (const line of raw) {
    if (!line) continue;
    const dm = line.match(DATE_LINE);
    if (dm) {
      flush();
      const mon = dm[1];
      const dayPart = dm[2];
      const yr = dm[3];
      const monNum = MONTH_TO_NUM[mon.toLowerCase()];
      const dayNum = Number(dayPart);
      if (!monNum || !Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
        curDate = '';
      } else {
        const dayIso = dayNum < 10 ? `0${dayNum}` : String(dayNum);
        // Keep the literal itinerary date; avoid Date/UTC conversion shifting by timezone.
        curDate = `${yr}-${monNum}-${dayIso}`;
      }
      continue;
    }
    const em = line.match(EMBEDDED_DATE_LINE);
    if (em) {
      flush();
      const mon = em[1];
      const dayPart = em[2];
      const yr = em[3];
      const tail = (em[4] || '').trim();
      const monNum = MONTH_TO_NUM[mon.toLowerCase()];
      const dayNum = Number(dayPart);
      if (!monNum || !Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
        curDate = '';
      } else {
        const dayIso = dayNum < 10 ? `0${dayNum}` : String(dayNum);
        curDate = `${yr}-${monNum}-${dayIso}`;
      }
      if (tail) {
        // Examples: "Embark in Amsterdam on Viking Tialfi", "Kinderdijk, The Netherlands"
        curPort = splitCruiseShipMeta(
          tail
            .replace(/^[-:\u2013]\s*/, '')
            .replace(/^Embark(?:\s+in)?\s+/i, '')
            .replace(/^Disembark(?:\s+in)?\s+/i, '')
            .trim()
        ).clean;
      }
      continue;
    }
    let m = line.match(AD_TIME);
    if (!m) m = line.match(AD_STUCK);
    if (m) {
      const t = normalizeTime(m[1] || '');
      if (/^DEPARTS/i.test(line)) depart = t || depart;
      else arrive = t || arrive;
      continue;
    }
    if (isNoiseLine(line)) continue;
    if (/^DAYS?\s+AT\s+SEA/i.test(line) || /^DAY\s+AT\s+SEA/i.test(line)) {
      flush();
      curPort = line.replace(/\s+/g, ' ');
      continue;
    }
    if (/^SCENIC/i.test(line) || /^CROSSING\s+THE/i.test(line)) {
      flush();
      curPort = line;
      continue;
    }
    flush();
    curPort = splitCruiseShipMeta(line.replace(/^[-:\u2013]\s*/, '').trim()).clean;
  }
  flush();
  return rows;
}

function parseGenericText(text: string): ParsedCruiseRow[] {
  const block = parseCruiseBlockPlainText(text);
  if (block.length) return block;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedCruiseRow[] = [];
  for (const line of lines) {
    const m = line.match(
      /Day\s*(\d+)[\s:,]+(.+?)(?:\s*[\u2013]\s*|\s+-\s+|\s+)(?:Arrive|Arrival)?\s*([\d:APM \t]+)?\s*(?:Depart|Departure)?\s*([\d:APM \t]+)?/i
    );
    if (!m) continue;
    rows.push({
      dayNumber: Number(m[1]),
      port: splitCruiseShipMeta(m[2].trim()).clean,
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
