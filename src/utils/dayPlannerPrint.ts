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
  .th-day-planner-print-backdrop,
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
    height: auto !important;
  }
  .trackInner {
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

const PRINT_STYLE_PROPS = [
  'display',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'padding',
  'border',
  'border-radius',
  'box-sizing',
  'overflow',
  'visibility',
  'opacity',
  'flex',
  'flex-direction',
  'flex-wrap',
  'flex-shrink',
  'flex-grow',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'grid',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'grid-area',
  'font-size',
  'font-weight',
  'line-height',
  'color',
  'background',
  'background-color',
  'text-align',
  'white-space',
  'z-index',
  'transform'
];

function applyComputedStyles(source: Element, target: Element): void {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
  const computed = window.getComputedStyle(source);
  const parts: string[] = [];
  for (let i = 0; i < PRINT_STYLE_PROPS.length; i++) {
    const prop = PRINT_STYLE_PROPS[i];
    const val = computed.getPropertyValue(prop);
    if (val) parts.push(`${prop}:${val}`);
  }
  if (parts.length) {
    const prev = target.getAttribute('style') || '';
    target.setAttribute('style', `${prev}${parts.join(';')}`);
  }
  const srcChildren = source.children;
  const tgtChildren = target.children;
  for (let i = 0; i < srcChildren.length; i++) {
    if (tgtChildren[i]) applyComputedStyles(srcChildren[i], tgtChildren[i]);
  }
}

/** Deep-clone a subtree with computed layout styles inlined (needed for SPFx / CSS modules print). */
export function cloneForPrint(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  applyComputedStyles(source, clone);
  return clone;
}

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

function waitForPrintDocument(doc: Document, win: Window, onReady: () => void): void {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  if (!links.length) {
    window.setTimeout(onReady, 80);
    return;
  }
  let pending = links.length;
  const done = (): void => {
    pending -= 1;
    if (pending <= 0) window.setTimeout(onReady, 120);
  };
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as HTMLLinkElement;
    if (link.sheet) {
      done();
    } else {
      link.addEventListener('load', done);
      link.addEventListener('error', done);
    }
  }
  win.addEventListener(
    'load',
    () => {
      window.setTimeout(onReady, 120);
    },
    { once: true }
  );
}

/** Print a DOM subtree in a hidden iframe (works in SPFx / Chromium hosts). */
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
    if (options?.onAfter) options.onAfter();
    return;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><base href="${document.baseURI}" />${collectDocumentStyles()}<style>${PRINT_EXTRA_CSS}</style></head><body>${root.outerHTML}</body></html>`;

  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
    if (options?.onAfter) options.onAfter();
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

  waitForPrintDocument(doc, win, doPrint);
}
