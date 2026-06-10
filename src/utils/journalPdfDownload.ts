/** Build a journal PDF with URL + page numbers in the footer (no date/time). */

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function sanitizeFileName(name: string): string {
  const base = (name || 'journal').replace(/[<>:"/\\|?*]+/g, '-').trim();
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function truncateUrl(url: string, maxLen: number): string {
  const trimmed = url.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export async function downloadJournalPdf(
  iframe: HTMLIFrameElement,
  fileName: string,
  sourceUrl: string
): Promise<void> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc?.body || !win) {
    throw new Error('Preview is not ready yet.');
  }

  await waitForImages(doc);

  const { jsPDF } = await import(/* webpackChunkName: 'journal-pdf' */ 'jspdf');

  const marginMm = 15;
  const footerMm = 10;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginMm * 2;

  await pdf.html(doc.body, {
    x: marginMm,
    y: marginMm,
    width: contentWidth,
    windowWidth: doc.documentElement.scrollWidth || 800,
    autoPaging: 'text',
    html2canvas: {
      scale: Math.min(2, win.devicePixelRatio || 1),
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    }
  });

  const total = pdf.getNumberOfPages();
  const footerY = pageHeight - footerMm;

  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(truncateUrl(sourceUrl, 95), marginMm, footerY);
    pdf.text(`${i} / ${total}`, pageWidth - marginMm, footerY, { align: 'right' });
  }

  pdf.save(sanitizeFileName(fileName));
}
