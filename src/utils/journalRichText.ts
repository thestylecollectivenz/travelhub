/** Detect stored journal body that uses HTML tags (rich text). */
export function isLikelyJournalHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text.trim());
}

/** Plain text / legacy entries → safe HTML for the rich editor. */
export function plainTextToEditorHtml(text: string): string {
  const t = text.trim();
  if (!t) return '<p><br></p>';
  if (isLikelyJournalHtml(text)) return text;
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const parts = esc.split('\n').map((line) => line || '<br>');
  return `<p>${parts.join('</p><p>')}</p>`;
}

export function isRichTextEditorEmpty(html: string): boolean {
  if (typeof document === 'undefined') return !html.trim();
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\u00a0/g, ' ').trim().length === 0;
}

/** Remove blank spacer paragraphs so manual extra Enters do not create huge gaps. */
export function collapseEmptyRichTextParagraphs(html: string): string {
  return (html || '').replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
}

/** Strip editor HTML to plain text for APIs / search. */
export function richTextToPlainText(html: string): string {
  if (typeof document === 'undefined') return (html || '').trim();
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\u00a0/g, ' ').trim();
}

/** Append a bullet list item to rich-text HTML (Notes / tips). */
export function appendBulletToRichTextHtml(existing: string | undefined, tip: string): string {
  const bullet = (tip || '').trim();
  if (!bullet) return existing || '';
  const esc = bullet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const li = `<li>${esc}</li>`;
  const raw = (existing || '').trim();
  if (!raw) return `<ul>${li}</ul>`;
  if (/<\/ul>/i.test(raw)) return raw.replace(/<\/ul>/i, `${li}</ul>`);
  return `${raw}<ul>${li}</ul>`;
}
