/** Open HTML in a new window and print — page counters work reliably vs iframe print. */

export function waitForImages(doc: Document): Promise<void> {
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

export function printHtmlDocument(
  html: string,
  onFallback?: () => void,
  prepare?: (doc: Document) => void | Promise<void>
): void {
  const printWin = window.open('', '_blank');
  if (!printWin) {
    onFallback?.();
    return;
  }

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  printWin.document.title = '';

  const runPrint = (): void => {
    void waitForImages(printWin.document)
      .then(() => (prepare ? prepare(printWin.document) : undefined))
      .then(() => {
        printWin.focus();
        printWin.addEventListener('afterprint', () => printWin.close(), { once: true });
        printWin.print();
      });
  };

  if (printWin.document.readyState === 'complete') {
    runPrint();
  } else {
    printWin.addEventListener('load', runPrint, { once: true });
  }
}
