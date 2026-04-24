import * as React from 'react';
import styles from './RichTextEditor.module.css';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
}

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
        <button
          type="button"
          className={styles.sizeBtn}
          disabled={disabled}
          title="Small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => applyFontSizeToSelection('var(--font-size-sm)'))}
        >
          S
        </button>
        <button
          type="button"
          className={styles.sizeBtn}
          disabled={disabled}
          title="Normal"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => applyFontSizeToSelection('var(--font-size-base)'))}
        >
          N
        </button>
        <button
          type="button"
          className={styles.sizeBtn}
          disabled={disabled}
          title="Large"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(() => applyFontSizeToSelection('var(--font-size-lg)'))}
        >
          L
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

function applyFontSizeToSelection(fontSize: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const span = document.createElement('span');
  span.setAttribute('style', `font-size:${fontSize}`);
  try {
    range.surroundContents(span);
  } catch {
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
}
