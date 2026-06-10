/** Split journal print HTML into fixed-height pages with explicit N / Total footers. */

const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 22;
const MARGIN_BOTTOM_MM = 30;
const MARGIN_SIDE_MM = 19;
const PAGE_INNER_HEIGHT_PX = (PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM_TO_PX;
const PAGE_CONTENT_WIDTH_PX = (210 - MARGIN_SIDE_MM * 2) * MM_TO_PX;

function createMeasureHost(doc: Document): HTMLDivElement {
  const host = doc.createElement('div');
  host.className = 'th-journal-print print-root print-paginate-measure-host';
  host.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${PAGE_CONTENT_WIDTH_PX}px`,
    'visibility:hidden',
    'pointer-events:none',
    'box-sizing:border-box'
  ].join(';');
  doc.body.appendChild(host);
  return host;
}

function measureBlock(host: HTMLDivElement, node: HTMLElement): number {
  host.replaceChildren(node.cloneNode(true));
  return host.getBoundingClientRect().height;
}

function wrapPaginateUnit(doc: Document, tagName: string, className: string, innerHtml: string): HTMLElement {
  const el = doc.createElement(tagName);
  el.className = className;
  el.innerHTML = innerHtml;
  return el;
}

function trySplitUnit(doc: Document, host: HTMLDivElement, unit: HTMLElement): HTMLElement[] {
  if (measureBlock(host, unit) <= PAGE_INNER_HEIGHT_PX) {
    return [unit];
  }

  const photoGrid = unit.querySelector(':scope .photoGrid');
  if (!photoGrid) {
    return [unit];
  }

  const parts: HTMLElement[] = [];
  const textClone = unit.cloneNode(true) as HTMLElement;
  textClone.querySelector(':scope .photoGrid')?.remove();

  const textOnly = wrapPaginateUnit(
    doc,
    unit.tagName.toLowerCase() === 'article' ? 'article' : 'div',
    unit.className,
    textClone.innerHTML
  );
  if (measureBlock(host, textOnly) > 4) {
    parts.push(textOnly);
  }

  const figures = Array.from(photoGrid.querySelectorAll('figure'));
  for (let i = 0; i < figures.length; i += 3) {
    const row = figures.slice(i, i + 3);
    parts.push(
      wrapPaginateUnit(
        doc,
        'div',
        'print-paginate-unit print-entry-photos',
        `<div class="photoGrid">${row.map((f) => f.outerHTML).join('')}</div>`
      )
    );
  }

  return parts.length > 1 ? parts : [unit];
}

function expandUnits(doc: Document, rawUnits: HTMLElement[]): HTMLElement[] {
  const host = createMeasureHost(doc);
  const expanded: HTMLElement[] = [];
  try {
    for (const unit of rawUnits) {
      expanded.push(...trySplitUnit(doc, host, unit));
    }
  } finally {
    host.remove();
  }
  return expanded;
}

export function paginateJournalPrintDocument(doc: Document): void {
  if (doc.querySelector('.print-pages')) return;

  const source = doc.querySelector<HTMLElement>('.print-paginate-source');
  if (!source) return;

  const oneDayPerPage = source.dataset.oneDayPerPage === 'true';
  const rawUnits = Array.from(source.querySelectorAll<HTMLElement>(':scope > .print-paginate-unit'));
  if (!rawUnits.length) return;

  const units = expandUnits(doc, rawUnits);
  const host = createMeasureHost(doc);

  const pageGroups: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let currentHeight = 0;

  const flush = (): void => {
    if (current.length) {
      pageGroups.push(current);
      current = [];
      currentHeight = 0;
    }
  };

  try {
    for (const unit of units) {
      if (oneDayPerPage && unit.classList.contains('print-day-intro')) {
        flush();
      }

      const blockHeight = measureBlock(host, unit);

      if (blockHeight > PAGE_INNER_HEIGHT_PX) {
        flush();
        pageGroups.push([unit]);
        continue;
      }

      if (currentHeight + blockHeight > PAGE_INNER_HEIGHT_PX && current.length) {
        flush();
      }

      current.push(unit);
      currentHeight += blockHeight;
    }
  } finally {
    host.remove();
  }

  flush();

  const totalPages = pageGroups.length || 1;
  const container = doc.createElement('div');
  container.className = 'print-pages th-journal-print';

  pageGroups.forEach((group, index) => {
    const sheet = doc.createElement('section');
    sheet.className = 'print-page-sheet';

    const content = doc.createElement('div');
    content.className = 'print-page-content';
    group.forEach((unit) => content.appendChild(unit));

    const label = doc.createElement('div');
    label.className = 'print-page-number';
    label.textContent = `${index + 1} / ${totalPages}`;

    sheet.appendChild(content);
    sheet.appendChild(label);
    container.appendChild(sheet);
  });

  source.replaceWith(container);
}
