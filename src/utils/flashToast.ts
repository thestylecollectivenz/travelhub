/** Lightweight flash toast — works in Safari / SharePoint / Teams WebViews (no window.alert). */

let host: HTMLDivElement | null = null;
let hideTimer = 0;

export type FlashToastTone = 'info' | 'warn';

function ensureHost(tone: FlashToastTone): HTMLDivElement {
  if (host && document.body.contains(host)) {
    applyTone(host, tone);
    return host;
  }
  host = document.createElement('div');
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', tone === 'warn' ? 'assertive' : 'polite');
  host.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:calc(5.5rem + env(safe-area-inset-bottom, 0px))',
    'transform:translateX(-50%)',
    /* Above SharePoint / Teams chrome and offline banner (11000). */
    'z-index:12050',
    'max-width:min(92vw, 24rem)',
    'padding:0.65rem 1rem',
    'border-radius:12px',
    'font:600 0.9rem/1.35 -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    'text-align:center',
    'box-shadow:0 8px 24px rgba(0,0,0,0.28)',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 160ms ease',
    'webkit-font-smoothing:antialiased'
  ].join(';');
  applyTone(host, tone);
  document.body.appendChild(host);
  return host;
}

function applyTone(el: HTMLDivElement, tone: FlashToastTone): void {
  el.setAttribute('aria-live', tone === 'warn' ? 'assertive' : 'polite');
  if (tone === 'warn') {
    el.style.background = 'rgba(120, 53, 15, 0.96)';
    el.style.color = '#fff7ed';
    el.style.border = '1px solid rgba(251, 191, 36, 0.55)';
  } else {
    el.style.background = 'rgba(28, 36, 48, 0.94)';
    el.style.color = '#ffffff';
    el.style.border = '1px solid rgba(255,255,255,0.12)';
  }
}

/** Show a short toast. Use tone `warn` for offline / blocked-write messages. */
export function flashToast(
  message: string,
  durationMs = 2200,
  options?: { tone?: FlashToastTone }
): void {
  const text = (message || '').trim();
  if (!text || typeof document === 'undefined') return;
  const tone = options?.tone || 'info';
  const el = ensureHost(tone);
  el.textContent = text;
  // Force reflow so opacity transition runs even when reusing the node.
  void el.offsetWidth;
  el.style.opacity = '1';
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    el.style.opacity = '0';
  }, Math.max(1200, durationMs));
}
