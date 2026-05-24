export type TasksPrintRow = {
  title: string;
  dueLine: string;
  contextLine: string;
  note?: string;
  complete: boolean;
};

export type TasksPrintSection = {
  heading: string;
  rows: TasksPrintRow[];
};

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLES = `
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0e3d5e; background: #fff; }
.th-tasks-print { padding: 16px 20px 40px; max-width: 52rem; margin: 0 auto; }
.th-tasks-print h1 { font-size: 1.35rem; margin: 0 0 1rem; }
.print-section { margin-bottom: 1.25rem; }
.print-section h2 { font-size: 1rem; margin: 0 0 0.5rem; border-bottom: 2px solid #1a6399; padding-bottom: 4px; }
.print-task { padding: 8px 0; border-bottom: 1px solid #e8e4dc; font-size: 0.9rem; }
.print-task:last-child { border-bottom: none; }
.print-task-title { font-weight: 600; }
.print-task-meta { font-size: 0.8rem; color: #5c4f3a; margin-top: 2px; }
.print-task-note { font-size: 0.8rem; color: #3a3025; margin-top: 4px; font-style: italic; }
.print-done { text-decoration: line-through; color: #64748b; }
`;

export function buildTasksPrintDocument(title: string, sections: TasksPrintSection[]): string {
  let body = '';
  for (const sec of sections) {
    if (!sec.rows.length) continue;
    body += `<section class="print-section"><h2>${esc(sec.heading)}</h2>`;
    for (const row of sec.rows) {
      body += `<div class="print-task${row.complete ? ' print-done' : ''}">`
        + `<div class="print-task-title">${esc(row.title)}</div>`
        + (row.dueLine ? `<div class="print-task-meta">${esc(row.dueLine)}</div>` : '')
        + (row.contextLine ? `<div class="print-task-meta">${esc(row.contextLine)}</div>` : '')
        + (row.note ? `<div class="print-task-note">${esc(row.note)}</div>` : '')
        + '</div>';
    }
    body += '</section>';
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)} — Tasks</title><style>${STYLES}</style></head><body>
<div class="th-tasks-print"><h1>${esc(title)}</h1>${body || '<p>No tasks to print.</p>'}</div>
</body></html>`;
}

export function openTasksPrintPreview(title: string, sections: TasksPrintSection[]): boolean {
  const doc = buildTasksPrintDocument(title, sections);
  const popup = window.open('', '_blank', 'width=960,height=720,scrollbars=yes');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(doc);
  popup.document.close();
  const trigger = (): void => {
    try {
      popup.focus();
      popup.print();
    } catch {
      /* ignore */
    }
  };
  if (popup.document.readyState === 'complete') {
    trigger();
  } else {
    popup.addEventListener('load', trigger);
  }
  return true;
}
