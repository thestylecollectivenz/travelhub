export function formatCruiseImportDate(isoOrYmd: string): string {
  const ymd = (isoOrYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return isoOrYmd || 'that day';
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return ymd;
  }
}

export function buildCruiseImportReport(options: {
  appliedCount: number;
  skippedCount: number;
  mapPinMisses: Array<{ port: string; date: string }>;
  otherNotes: string[];
}): string {
  const lines: string[] = [];
  lines.push('Cruise itinerary import finished.');
  lines.push('');
  lines.push(
    `Added or updated ${options.appliedCount} stop${options.appliedCount === 1 ? '' : 's'} on your trip.`
  );
  if (options.skippedCount > 0) {
    lines.push(`${options.skippedCount} line${options.skippedCount === 1 ? '' : 's'} could not be matched to a trip day.`);
  }
  lines.push('');
  if (options.mapPinMisses.length) {
    const uniquePorts = Array.from(new Set(options.mapPinMisses.map((m) => m.port))).sort();
    lines.push(
      `${options.mapPinMisses.length} port stop${options.mapPinMisses.length === 1 ? '' : 's'} could not be geocoded (${uniquePorts.length} unique location${uniquePorts.length === 1 ? '' : 's'}):`
    );
    for (const port of uniquePorts) {
      const dates = options.mapPinMisses
        .filter((m) => m.port === port)
        .map((m) => (m.date ? formatCruiseImportDate(m.date) : 'date unknown'));
      lines.push(`• ${port}${dates.length ? ` — ${dates.join('; ')}` : ''}`);
    }
    lines.push('');
    lines.push(
      'Day titles and cruise itinerary stops were still added. Set map pins manually from each day’s Locations panel where needed.'
    );
  } else {
    lines.push('All port locations were matched to map coordinates.');
  }
  if (options.otherNotes.length) {
    lines.push('');
    lines.push('Other notes:');
    for (const n of options.otherNotes) {
      lines.push(`• ${n}`);
    }
  }
  return lines.join('\n');
}
