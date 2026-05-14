/**
 * Prints a clone of #th-print-root attached to document.body. Chrome often shows a blank
 * print preview for iframe or separate-window approaches when SPFx styles load asynchronously;
 * cloning keeps class names while @media print rules hide all other body children.
 */
export function openDayPlannerPrintWindow(): void {
  const root = document.getElementById('th-print-root');
  if (!root) {
    // eslint-disable-next-line no-console
    console.warn('Day planner print: #th-print-root not found');
    return;
  }

  const clone = root.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.classList.add('th-print-clone-host');
  clone.setAttribute('aria-hidden', 'true');

  const onAfterPrint = (): void => {
    window.removeEventListener('afterprint', onAfterPrint);
    window.setTimeout(() => {
      if (clone.isConnected) {
        clone.remove();
      }
    }, 100);
  };

  const cleanup = (): void => {
    window.removeEventListener('afterprint', onAfterPrint);
    if (clone.isConnected) {
      clone.remove();
    }
  };

  document.body.appendChild(clone);

  window.addEventListener('afterprint', onAfterPrint, { once: true });

  const trigger = (): void => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Day planner print: print() failed', e);
      cleanup();
      return;
    }
    window.setTimeout(() => {
      if (clone.isConnected) {
        cleanup();
      }
    }, 120_000);
  };

  window.setTimeout(trigger, 150);
}
