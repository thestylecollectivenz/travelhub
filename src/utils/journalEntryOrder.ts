/** ISO timestamp between two neighbours (for journal entry ordering). */
export function timestampBetween(before: string | null | undefined, after: string | null | undefined): string {
  const now = Date.now();
  if (!before && !after) return new Date(now).toISOString();
  if (!before && after) {
    const afterMs = new Date(after).getTime();
    return new Date(afterMs - 1000).toISOString();
  }
  if (before && !after) {
    const beforeMs = new Date(before).getTime();
    return new Date(beforeMs + 1000).toISOString();
  }
  const b = new Date(before as string).getTime();
  const a = new Date(after as string).getTime();
  if (Number.isNaN(b) || Number.isNaN(a)) return new Date(now).toISOString();
  if (b >= a) return new Date(b + 500).toISOString();
  return new Date(b + (a - b) / 2).toISOString();
}
