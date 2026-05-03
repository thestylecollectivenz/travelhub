/**
 * Opens a document containing a clone of #th-print-root plus the host page's
 * stylesheets and document style tags, then triggers print(). Same strategy as
 * journalPrintPreview.ts: avoids SharePoint page print quirks (blank preview).
 */
export function openDayPlannerPrintWindow(): void {
  const root = document.getElementById('th-print-root');
  if (!root) {
    // eslint-disable-next-line no-console
    console.warn('Day planner print: #th-print-root not found');
    return;
  }

  const previewWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
  if (!previewWindow) {
    // eslint-disable-next-line no-console
    console.warn('Day planner print: popup blocked');
    return;
  }

  const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  let headMarkup = '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Day planner</title>';

  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
    const link = node as HTMLLinkElement;
    const href = link.href?.trim();
    if (!href) continue;
    headMarkup += `<link rel="stylesheet" href="${escapeAttr(href)}"/>`;
  }

  for (const node of Array.from(document.querySelectorAll('style'))) {
    const text = node.textContent ?? '';
    if (!text.trim()) continue;
    headMarkup += `<style>${text}</style>`;
  }

  headMarkup += `<style>
    body { margin: 0; padding: 12px; background: var(--color-surface-raised, #fff); box-sizing: border-box; }
    @media print { body { padding: 0; } }
  </style>`;

  previewWindow.document.open();
  previewWindow.document.write(`<!DOCTYPE html><html><head>${headMarkup}</head><body></body></html>`);
  previewWindow.document.close();

  const clone = root.cloneNode(true) as HTMLElement;
  previewWindow.document.body.appendChild(clone);

  const schedulePrint = (): void => {
    previewWindow.focus();
    previewWindow.print();
  };

  const run = (): void => {
    window.setTimeout(schedulePrint, 400);
  };

  if (previewWindow.document.readyState === 'complete') {
    run();
  } else {
    previewWindow.addEventListener('load', run, { once: true });
  }
}
