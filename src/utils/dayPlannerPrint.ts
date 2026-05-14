/**
 * Prints #th-print-root using a hidden same-origin iframe. A separate about:blank window
 * often shows a blank Chrome print preview because linked SPFx stylesheets do not paint
 * reliably there; an iframe inherits the page origin and loads the same CSS URLs.
 */
export function openDayPlannerPrintWindow(): void {
  const root = document.getElementById('th-print-root');
  if (!root) {
    // eslint-disable-next-line no-console
    console.warn('Day planner print: #th-print-root not found');
    return;
  }

  const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const escapeText = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const parts: string[] = [];
  parts.push('<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>');
  parts.push(`<title>${escapeText('Day planner')}</title>`);

  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    const link = node as HTMLLinkElement;
    const href = link.href?.trim();
    if (!href) continue;
    parts.push(`<link rel="stylesheet" href="${escapeAttr(href)}"/>`);
  }

  for (const node of Array.from(document.querySelectorAll('style'))) {
    const text = node.textContent ?? '';
    if (!text.trim()) continue;
    parts.push(`<style>${text}</style>`);
  }

  parts.push(`<style>
    body { margin: 0; padding: 12px; background: var(--color-surface-raised, #fff); box-sizing: border-box; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 10mm; }
    }
  </style>`);
  parts.push('</head><body>');
  parts.push(root.outerHTML);
  parts.push('</body></html>');
  const html = parts.join('');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Day planner print');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1'
  });

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    // eslint-disable-next-line no-console
    console.warn('Day planner print: iframe document unavailable');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  /** Some browsers fire afterprint on the opener; use as backup to remove iframe. */
  const onHostAfterPrint = (): void => {
    window.setTimeout(() => {
      if (iframe.isConnected) iframe.remove();
    }, 500);
  };

  const cleanup = (): void => {
    window.removeEventListener('afterprint', onHostAfterPrint);
    if (iframe.isConnected) iframe.remove();
  };

  window.addEventListener('afterprint', onHostAfterPrint, { once: true });

  const trigger = (): void => {
    try {
      win.focus();
      win.print();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Day planner print: print() failed', e);
      cleanup();
      return;
    }
    window.setTimeout(() => {
      if (iframe.isConnected) cleanup();
    }, 120_000);
  };

  if (doc.readyState === 'complete') {
    window.setTimeout(trigger, 250);
  } else {
    win.addEventListener('load', () => window.setTimeout(trigger, 250), { once: true });
  }
}
