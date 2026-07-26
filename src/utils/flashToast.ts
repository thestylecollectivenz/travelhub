/** Lightweight non-blocking flash toast for mobile list add success. */

let host: HTMLDivElement | null = null;
let hideTimer = 0;

function ensureHost(): HTMLDivElement {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:calc(5.5rem + env(safe-area-inset-bottom, 0px))',
    'transform:translateX(-50%)',
    'z-index:80',
    'max-width:min(92vw, 22rem)',
    'padding:0.55rem 0.9rem',
    'border-radius:999px',
    'background:rgba(28, 36, 48, 0.92)',
    'color:#fff',
    'font:600 0.85rem/1.3 system-ui, sans-serif',
    'text-align:center',
    'box-shadow:0 6px 20px rgba(0,0,0,0.22)',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 160ms ease'
  ].join(';');
  document.body.appendChild(host);
  return host;
}

/** Show a short success toast, e.g. `"Umbrella added"`. */
export function flashToast(message: string, durationMs = 2200): void {
  const text = (message || '').trim();
  if (!text || typeof document === 'undefined') return;
  const el = ensureHost();
  el.textContent = text;
  el.style.opacity = '1';
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    el.style.opacity = '0';
  }, durationMs);
}
