export function itineraryNotesPreview(
  notes: string | undefined,
  maxLines = 2
): { preview: string; truncated: boolean } {
  const text = (notes || '').trim();
  if (!text) return { preview: '', truncated: false };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const truncated = lines.length > maxLines;
  return { preview: lines.slice(0, maxLines).join('\n'), truncated };
}
