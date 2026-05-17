const PRINT_EXTRA_CSS = `
  html, body { margin: 0; padding: 0; background: #fff; }
  body { padding: 12px; box-sizing: border-box; }
  @page { margin: 10mm; }
  .filterBar,
  .rangeToolbar,
  .customRange,
  .inactivePrompt,
  .mobileNav,
  .previewBackdrop,
  .th-print-ui-only,
  [class*="previewBackdrop"],
  [class*="editOverlay"] {
    display: none !important;
  }
  .plannerFrame {
    border: none !important;
    border-radius: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .trackScroll {
    overflow: visible !important;
    min-height: 0 !important;
  }
  .dayHead,
  .timeAxis {
    position: static !important;
    top: auto !important;
    left: auto !important;
    box-shadow: none !important;
  }
`;

function collectDocumentStyles(): string {
  const chunks: string[] = [];
  for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    const href = (link as HTMLLinkElement).href;
    if (href) chunks.push(`<link rel="stylesheet" href="${href}" />`);
  }
  for (const style of Array.from(document.querySelectorAll('style'))) {
    const text = style.textContent;
    if (text?.trim()) chunks.push(`<style>${text}</style>`);
  }
  return chunks.join('\n');
}

/** Print a cloned DOM subtree in a hidden iframe (works in SPFx / Chromium hosts). */
export function printHtmlElement(root: HTMLElement, options?: { onAfter?: () => void }): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Day planner print');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    options?.onAfter?.();
    return;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><base href="${document.baseURI}" />${collectDocumentStyles()}<style>${PRINT_EXTRA_CSS}</style></head><body>${root.innerHTML}</body></html>`;

  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
    options?.onAfter?.();
  };

  const doPrint = (): void => {
    try {
      win.focus();
      win.print();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('dayPlannerPrint: print failed', e);
      cleanup();
    }
  };

  win.addEventListener('afterprint', cleanup, { once: true });
  doc.open();
  doc.write(html);
  doc.close();

  const schedule = (): void => {
    window.setTimeout(doPrint, 320);
  };
  if (doc.readyState === 'complete') schedule();
  else win.addEventListener('load', schedule, { once: true });
}
