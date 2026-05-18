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
  .trackInner { min-height: 0 !important; }
  .dayHead, .timeAxis {
    position: static !important;
    top: auto !important;
    left: auto !important;
    box-shadow: none !important;
  }
`;

const PRINT_STYLE_PROPS = [
  'display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height',
  'min-width', 'min-height', 'max-width', 'max-height', 'margin', 'padding', 'border',
  'border-radius', 'box-sizing', 'overflow', 'visibility', 'opacity', 'flex',
  'flex-direction', 'flex-wrap', 'flex-shrink', 'flex-grow', 'align-items', 'align-self',
  'justify-content', 'gap', 'grid', 'grid-template-columns', 'grid-template-rows',
  'grid-column', 'grid-row', 'grid-area', 'font-size', 'font-weight', 'line-height',
  'color', 'background', 'background-color', 'text-align', 'white-space', 'z-index', 'transform'
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

export function cloneForPrint(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  applyComputedStyles(source, clone);
  return clone;
}

/** Inline accessible stylesheet rules (SPFx often blocks linked CSS in pop-ups). */
function collectDocumentStyles(): string {
  const chunks: string[] = [];
  for (const style of Array.from(document.querySelectorAll('style'))) {
    const text = style.textContent;
    if (text?.trim()) chunks.push(`<style>${text}</style>`);
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules?.length) continue;
      let text = '';
      for (let i = 0; i < rules.length; i++) {
        text += rules[i].cssText;
      }
      if (text.trim()) chunks.push(`<style>${text}</style>`);
    } catch {
      const href = sheet.href;
      if (href) chunks.push(`<link rel="stylesheet" href="${href}" />`);
    }
  }
  return chunks.join('\n');
}

function buildPrintHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><base href="${document.baseURI}" /><title>Day planner</title>${collectDocumentStyles()}<style>${PRINT_EXTRA_CSS}</style></head><body>${bodyHtml}</body></html>`;
}

let printHostEl: HTMLElement | null = null;

function teardownPrintHost(): void {
  document.documentElement.classList.remove('th-day-planner-print-active');
  if (printHostEl) {
    printHostEl.remove();
    printHostEl = null;
  }
}

/**
 * Print using a temporary on-page surface (inherits live SPFx styles).
 * More reliable in SharePoint than a blank pop-up window.
 */
export function printPlannerInPlace(source: HTMLElement): boolean {
  teardownPrintHost();

  const clone = cloneForPrint(source);
  clone.removeAttribute('id');

  const host = document.createElement('div');
  host.id = 'th-print-host-temp';
  host.className = 'th-day-planner-print-backdrop';
  host.style.pointerEvents = 'none';

  const surface = document.createElement('div');
  surface.className = 'th-day-planner-print-surface';
  surface.appendChild(clone);
  host.appendChild(surface);
  document.body.appendChild(host);
  printHostEl = host;

  document.documentElement.classList.add('th-day-planner-print-active');

  const cleanup = (): void => teardownPrintHost();
  window.addEventListener('afterprint', cleanup, { once: true });

  window.setTimeout(() => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('dayPlannerPrint: in-place print failed', e);
      cleanup();
    }
    window.setTimeout(() => {
      if (printHostEl) cleanup();
    }, 2000);
  }, 150);

  return true;
}

/**
 * Opens the planner in a new browser tab/window and triggers print (fallback).
 */
export function printPlannerInNewWindow(source: HTMLElement): boolean {
  const popup = window.open('', '_blank');
  if (!popup) return false;

  const clone = cloneForPrint(source);
  clone.removeAttribute('id');
  const html = buildPrintHtml(clone.outerHTML);

  popup.document.open();
  popup.document.write(html);
  popup.document.close();

  const trigger = (): void => {
    try {
      popup.focus();
      popup.print();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('dayPlannerPrint: print failed', e);
    }
  };

  if (popup.document.readyState === 'complete') {
    window.setTimeout(trigger, 400);
  } else {
    popup.addEventListener('load', () => window.setTimeout(trigger, 400), { once: true });
  }
  return true;
}

/** Print from the live planner root element (#th-print-root). */
export function printDayPlannerFromPage(): boolean {
  const src = document.getElementById('th-print-root');
  if (!src) return false;
  if (printPlannerInPlace(src)) return true;
  return printPlannerInNewWindow(src);
}

/** Print a specific planner subtree (e.g. full-screen clone). */
export function printDayPlannerElement(source: HTMLElement): boolean {
  if (printPlannerInPlace(source)) return true;
  return printPlannerInNewWindow(source);
}
