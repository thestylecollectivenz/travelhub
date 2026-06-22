import * as React from 'react';
import styles from './RichTextEditor.module.css';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
}

const FONT_SIZE_PT = [8, 10, 12, 14] as const;

function readCssColor(varName: string): string {
  if (typeof document === 'undefined') return '#1a365d';
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '#1a365d';
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, disabled, minHeight = '7rem' }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastExternal = React.useRef<string>(value);

  const palette = React.useMemo(
    () => [
      readCssColor('--color-primary'),
      readCssColor('--color-blue-800'),
      readCssColor('--color-warning'),
      readCssColor('--color-sand-600'),
      readCssColor('--color-sand-800'),
      '#0d9488',
      '#7c3aed',
      '#b45309'
    ],
    []
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el === document.activeElement) return;
    if (value !== lastExternal.current || el.innerHTML !== value) {
      el.innerHTML = value || '<p><br></p>';
      lastExternal.current = value;
    }
  }, [value]);

  const emit = React.useCallback((): void => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML);
    lastExternal.current = el.innerHTML;
  }, [onChange]);

  const run = React.useCallback(
    (fn: () => void): void => {
      if (disabled) return;
      ref.current?.focus();
      fn();
      emit();
    },
    [disabled, emit]
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} aria-label="Formatting">
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Bold"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => document.execCommand('bold'))}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Italic"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => document.execCommand('italic'))}
        >
          <em>I</em>
        </button>
        <div className={styles.swatches} role="list" aria-label="Text colour">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.swatch}
              style={{ background: c }}
              title={c}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(() => document.execCommand('foreColor', false, c))}
            />
          ))}
        </div>
        <div className={styles.sizeGroup} aria-label="Font size">
          {FONT_SIZE_PT.map((pt) => (
            <button
              key={pt}
              type="button"
              className={styles.sizeBtn}
              disabled={disabled}
              title={`${pt} pt`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(() => applyFontSizeToSelection(pt))}
            >
              {pt}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Bullet list"
          disabled={disabled}
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => document.execCommand('insertUnorderedList'))}
        >
          •
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Numbered list"
          disabled={disabled}
          title="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => document.execCommand('insertOrderedList'))}
        >
          1.
        </button>
      </div>
      <div
        ref={ref}
        className={styles.editor}
        style={{ minHeight }}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
};

function applyFontSizeToSelection(fontSizePt: number): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
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

  const next = document.createRange();
  next.selectNodeContents(span);
  next.collapse(false);
  sel.removeAllRanges();
  sel.addRange(next);
}
