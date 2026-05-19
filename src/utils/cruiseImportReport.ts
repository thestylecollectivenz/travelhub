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
  if (options.mapPinMisses.length) {
    lines.push('');
    lines.push('Locations without a map pin (day titles and cruise stops were still added):');
    for (const m of options.mapPinMisses) {
      const when = m.date ? formatCruiseImportDate(m.date) : 'unmatched date';
      lines.push(`• ${m.port} — ${when}`);
    }
    lines.push('');
    lines.push(
      'You can set these manually from each day’s Locations panel. Scenic sailing days (e.g. Antarctic Experience) often have no real-world pin.'
    );
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
