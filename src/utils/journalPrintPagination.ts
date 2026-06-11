/** Split journal print HTML into fixed-height pages with explicit N / Total footers. */

import {
  JOURNAL_PAGE_CONTENT_HEIGHT_PX,
  JOURNAL_PAGE_CONTENT_WIDTH_PX
} from './journalPrintLayout';

function createMeasureHost(doc: Document): HTMLDivElement {
  const host = doc.createElement('div');
  host.className = 'th-journal-print print-root print-paginate-measure-host';
  host.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${JOURNAL_PAGE_CONTENT_WIDTH_PX}px`,
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

export function paginateJournalPrintDocument(doc: Document): void {
  if (doc.querySelector('.print-pages')) return;

  const source = doc.querySelector<HTMLElement>('.print-paginate-source');
  if (!source) return;

  const oneDayPerPage = source.dataset.oneDayPerPage === 'true';
  const units = Array.from(source.querySelectorAll<HTMLElement>(':scope > .print-paginate-unit'));
  if (!units.length) return;

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

      if (blockHeight > JOURNAL_PAGE_CONTENT_HEIGHT_PX) {
        flush();
        pageGroups.push([unit]);
        continue;
      }

      if (currentHeight + blockHeight > JOURNAL_PAGE_CONTENT_HEIGHT_PX && current.length) {
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

    const footer = doc.createElement('footer');
    footer.className = 'print-page-footer';
    footer.setAttribute('aria-hidden', 'true');

    const label = doc.createElement('div');
    label.className = 'print-page-number';
    label.textContent = `${index + 1} / ${totalPages}`;
    footer.appendChild(label);

    sheet.appendChild(content);
    sheet.appendChild(footer);
    container.appendChild(sheet);
  });

  source.replaceWith(container);
}
