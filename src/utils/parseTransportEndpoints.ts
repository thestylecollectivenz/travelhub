const ARROW_SPLIT = /\s*(?:→|->)\s*/;
const FLY_TO = /^fly\s+(.+?)\s+to\s+(.+)$/i;
const GENERIC_TO = /^(.+?)\s+to\s+(.+?)(?:\s*\([^)]*\))?$/i;

/** Best-effort From/To when transportFrom/transportTo are empty but title has a route. */
export function parseTransportEndpointsFromTitle(title?: string): { from?: string; to?: string } {
  const raw = (title || '').trim();
  if (!raw) return {};

  const arrowParts = raw.split(ARROW_SPLIT);
  if (arrowParts.length === 2) {
    const from = arrowParts[0].trim();
    const right = arrowParts[1].trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (from || right) return { from: from || undefined, to: right || undefined };
  }

  const fly = raw.match(FLY_TO);
  if (fly) {
    return { from: fly[1].trim() || undefined, to: fly[2].trim() || undefined };
  }

  const generic = raw.match(GENERIC_TO);
  if (generic) {
    const from = generic[1].trim();
    const to = generic[2].trim();
    if (from && to && from.length < 80 && to.length < 80) {
      return { from, to };
    }
  }

  return {};
}

export function resolveTransportFromTo(entry: {
  transportFrom?: string;
  transportTo?: string;
  title?: string;
}): { from: string; to: string } {
  const fromField = (entry.transportFrom || '').trim();
  const toField = (entry.transportTo || '').trim();
  if (fromField || toField) {
    return { from: fromField || '—', to: toField || '—' };
  }
  const parsed = parseTransportEndpointsFromTitle(entry.title);
  return {
    from: (parsed.from || '').trim() || '—',
    to: (parsed.to || '').trim() || '—'
  };
}
