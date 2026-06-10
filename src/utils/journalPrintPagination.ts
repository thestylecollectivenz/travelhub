/** Split journal print HTML into fixed-height pages with explicit N / Total footers. */

const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 22;
const MARGIN_BOTTOM_MM = 30;
const MARGIN_SIDE_MM = 19;
const PAGE_INNER_HEIGHT_PX = (PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM_TO_PX;
const PAGE_CONTENT_WIDTH_PX = (210 - MARGIN_SIDE_MM * 2) * MM_TO_PX;

function measureBlock(doc: Document, node: HTMLElement): number {
  const ruler = doc.createElement('div');
  ruler.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${PAGE_CONTENT_WIDTH_PX}px`,
    'visibility:hidden',
    'pointer-events:none'
  ].join(';');
  ruler.appendChild(node.cloneNode(true));
  doc.body.appendChild(ruler);
  const height = ruler.getBoundingClientRect().height;
  doc.body.removeChild(ruler);
  return height;
}

export function paginateJournalPrintDocument(doc: Document): void {
  const source = doc.querySelector<HTMLElement>('.print-paginate-source');
  if (!source) return;

  const oneDayPerPage = source.dataset.oneDayPerPage === 'true';
  const units = Array.from(source.querySelectorAll<HTMLElement>(':scope > .print-paginate-unit'));
  if (!units.length) return;

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

  for (const unit of units) {
    if (oneDayPerPage && unit.classList.contains('print-day-intro')) {
      flush();
    }

    const blockHeight = measureBlock(doc, unit);

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
  doc.querySelector('.print-page-number-footer')?.remove();
}
