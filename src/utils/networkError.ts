/** Safari / WebKit often surfaces airplane-mode failures as TypeError: Load failed. */
export function isLikelyNetworkError(err: unknown): boolean {
  if (err == null) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('network error') ||
    msg.includes('internet connection appears to be offline') ||
    msg.includes('the network connection was lost') ||
    msg.includes('offline') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network_changed')
  ) {
    return true;
  }
  return err instanceof TypeError && (msg.includes('load') || msg.includes('fetch') || msg.includes('network'));
}
