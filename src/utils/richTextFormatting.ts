import { plainTextToEditorHtml, richTextToPlainText } from './journalRichText';

export interface RichTextFormatPaint {
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
}

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

function rangeIntersectsNode(range: Range, node: Node): boolean {
  const nodeRange = document.createRange();
  try {
    nodeRange.selectNodeContents(node);
  } catch {
    return false;
  }
  return (
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
  );
}

function listItemsInRange(range: Range): HTMLLIElement[] {
  const root =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement;
  if (!root) return [];
  const items: HTMLLIElement[] = [];
  root.querySelectorAll('li').forEach((li) => {
    if (rangeIntersectsNode(range, li)) items.push(li);
  });
  return items;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function normalizeLinkHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function wrapRangeContents(range: Range, apply: (span: HTMLSpanElement) => void): void {
  if (range.collapsed) return;
  const extracted = range.extractContents();
  const span = document.createElement('span');
  apply(span);
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

function blocksInRange(range: Range): HTMLElement[] {
  const root =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement;
  if (!root) return [];
  const blocks: HTMLElement[] = [];
  root.querySelectorAll('p, li, div, h1, h2, h3, h4, h5, h6').forEach((el) => {
    if (rangeIntersectsNode(range, el)) blocks.push(el as HTMLElement);
  });
  if (!blocks.length) {
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== root) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (['P', 'LI', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].indexOf(tag) >= 0) {
          blocks.push(node as HTMLElement);
          break;
        }
      }
      node = node.parentNode;
    }
  }
  return blocks;
}

/** Apply inline style to every paragraph/list block touched by the selection. */
function applyInlineStyleToRange(
  range: Range,
  applyToBlock: (el: HTMLElement) => void,
  applyToSpan: (span: HTMLSpanElement) => void
): void {
  const blocks = blocksInRange(range);
  if (blocks.length > 0) {
    blocks.forEach(applyToBlock);
    return;
  }
  const items = listItemsInRange(range);
  if (items.length > 0) {
    items.forEach(applyToBlock);
    return;
  }
  wrapRangeContents(range, applyToSpan);
}

export function applyFontSizeToRange(range: Range, fontSizePt: number): void {
  const size = `${fontSizePt}pt`;
  if (range.collapsed) {
    document.execCommand('insertHTML', false, `<span style="font-size:${size}">&#8203;</span>`);
    return;
  }
  applyInlineStyleToRange(
    range,
    (el) => {
      el.style.fontSize = size;
    },
    (span) => {
      span.style.fontSize = size;
    }
  );
}

/** Wrap the current selection (or insert at caret) as a clickable link. */
export function insertLinkInRange(range: Range, url: string, linkText?: string): void {
  const href = normalizeLinkHref(url);
  if (!href) return;

  if (range.collapsed) {
    const text = (linkText || href).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    );
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  try {
    range.surroundContents(anchor);
  } catch {
    const fragment = range.extractContents();
    anchor.appendChild(fragment);
    range.insertNode(anchor);
  }
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(anchor);
  next.collapse(false);
  sel.addRange(next);
}

export function removeLinkFromSelection(): void {
  document.execCommand('unlink');
}

export function applyForeColorToRange(range: Range, color: string): void {
  if (range.collapsed) {
    document.execCommand('foreColor', false, color);
    return;
  }
  applyInlineStyleToRange(
    range,
    (el) => {
      el.style.color = color;
    },
    (span) => {
      span.style.color = color;
    }
  );
}

export function applyFontSizeToEditor(editor: HTMLElement, fontSizePt: number): void {
  const size = `${fontSizePt}pt`;
  editor.style.fontSize = size;
  editor.querySelectorAll('li, p, span, font, div').forEach((el) => {
    (el as HTMLElement).style.fontSize = size;
  });
}

export function applyForeColorToEditor(editor: HTMLElement, color: string): void {
  editor.style.color = color;
  editor.querySelectorAll('li, p, span, font, div').forEach((el) => {
    (el as HTMLElement).style.color = color;
  });
}

function formatElementFromNode(node: Node): HTMLElement | null {
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement;
  if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement;
  return null;
}

export function captureFormatFromSelection(): RichTextFormatPaint | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const el = formatElementFromNode(
    range.collapsed ? range.startContainer : range.commonAncestorContainer
  );
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    color: cs.color,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    textDecoration: cs.textDecorationLine || cs.textDecoration
  };
}

export function applyFormatPaintToRange(range: Range, paint: RichTextFormatPaint): void {
  if (range.collapsed || !paint) return;
  const applyToBlock = (el: HTMLElement): void => {
    if (paint.color) el.style.color = paint.color;
    if (paint.fontSize) el.style.fontSize = paint.fontSize;
    if (paint.fontWeight && (paint.fontWeight === 'bold' || Number(paint.fontWeight) >= 600)) {
      el.style.fontWeight = 'bold';
    }
    if (paint.fontStyle === 'italic') el.style.fontStyle = 'italic';
    if (paint.textDecoration?.includes('underline')) el.style.textDecoration = 'underline';
  };
  applyInlineStyleToRange(range, applyToBlock, (span) => applyToBlock(span));
}
