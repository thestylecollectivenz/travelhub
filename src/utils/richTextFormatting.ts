import { plainTextToEditorHtml, richTextToPlainText } from './journalRichText';

export function clearRichTextSelection(): void {
  document.execCommand('removeFormat');
  document.execCommand('unlink');
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const fragment = range.extractContents();
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    el.removeAttribute('style');
    el.removeAttribute('color');
    el.removeAttribute('face');
    el.removeAttribute('size');
    if (el.tagName === 'FONT') {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
      parent?.removeChild(el);
    }
    node = walker.nextNode();
  }
  range.insertNode(fragment);
}

export function clearRichTextAll(editor: HTMLElement): string {
  const plain = richTextToPlainText(editor.innerHTML);
  return plainTextToEditorHtml(plain);
}

export function applyFontSizeToRange(range: Range, fontSizePt: number): void {
  const size = `${fontSizePt}pt`;
  if (range.collapsed) {
    document.execCommand('insertHTML', false, `<span style="font-size:${size}">&#8203;</span>`);
    return;
  }
  const extracted = range.extractContents();
  const span = document.createElement('span');
  span.style.fontSize = size;
  span.appendChild(extracted);
  range.insertNode(span);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(span);
  next.collapse(false);
  sel.addRange(next);
}
