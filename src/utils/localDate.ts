/** Calendar date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString). */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const mm = m < 10 ? `0${m}` : String(m);
  const dd = day < 10 ? `0${day}` : String(day);
  return `${y}-${mm}-${dd}`;
}

export function parseYmd(ymd: string): Date | undefined {
  const s = (ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export function formatYmdDisplay(ymd?: string): string {
  const dt = parseYmd(ymd || '');
  if (!dt) return '';
  return dt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function nightsBetween(startYmd?: string, endYmd?: string): number {
  if (!startYmd || !endYmd) return 0;
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function inclusiveDaysBetween(startYmd?: string, endYmd?: string): number {
  if (!startYmd || !endYmd) return 0;
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}
