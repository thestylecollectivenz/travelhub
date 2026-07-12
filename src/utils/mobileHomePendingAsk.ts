const KEY = 'travelhub-pending-home-ask-ai';

export function setPendingMobileHomeAsk(prompt: string): void {
  const p = prompt.trim();
  if (!p) return;
  try {
    window.sessionStorage.setItem(KEY, p);
  } catch {
    /* ignore */
  }
}

export function consumePendingMobileHomeAsk(): string | null {
  try {
    const p = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return p?.trim() || null;
  } catch {
    return null;
  }
}
