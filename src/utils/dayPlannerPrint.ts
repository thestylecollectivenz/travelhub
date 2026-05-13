/**
 * Opens a document containing a clone of #th-print-root plus inlined CSS from the host
 * (same-origin stylesheets only), then triggers print(). External <link> styles often fail
 * to load in a blank popup on SharePoint, which produced empty print previews.
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

  function collectSameOriginStylesheetCss(): string {
    let out = '';
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | undefined;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        try {
          out += `${rule.cssText}\n`;
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  }

  const inlinedHostCss = collectSameOriginStylesheetCss();

  let headMarkup = '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Day planner</title>';

  if (inlinedHostCss.trim()) {
    headMarkup += `<style id="th-dayplanner-inlined-host">${inlinedHostCss}</style>`;
  }

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
    #th-print-root { display: block !important; visibility: visible !important; min-height: 0 !important; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 10mm; }
    }
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
    window.setTimeout(schedulePrint, 500);
  };

  if (previewWindow.document.readyState === 'complete') {
    run();
  } else {
    previewWindow.addEventListener('load', run, { once: true });
  }
}
