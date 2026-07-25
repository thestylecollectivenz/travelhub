/** Registered by ItineraryCardEdit so mobile header Back can flush the open form. */
type FlushFn = () => void | Promise<void>;

let flushHandler: FlushFn | null = null;

export function registerItineraryEditFlush(fn: FlushFn): () => void {
  flushHandler = fn;
  return () => {
    if (flushHandler === fn) flushHandler = null;
  };
}

/** Runs the open edit form's save (or cancel for blank drafts). Returns true if a handler ran. */
export async function flushItineraryEdit(): Promise<boolean> {
  // iPad/Safari often keep contentEditable / input values out of React state until blur.
  const ae = document.activeElement as HTMLElement | null;
  if (ae && typeof ae.blur === 'function' && ae !== document.body) {
    ae.blur();
  }
  if (!flushHandler) return false;
  await flushHandler();
  return true;
}
