import * as React from 'react';
import styles from './RichTextEditor.module.css';
import {
  applyFontSizeToEditor,
  applyFontSizeToRange,
  applyForeColorToEditor,
  applyForeColorToRange,
  applyFormatPaintToRange,
  captureFormatFromSelection,
  clearRichTextAll,
  clearRichTextSelection,
  insertLinkInRange,
  removeLinkFromSelection,
  type RichTextFormatPaint
} from '../../utils/richTextFormatting';

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

function readDefaultTextColor(editor: HTMLElement | null): string {
  if (!editor) return readCssColor('--color-blue-900');
  return getComputedStyle(editor).color || readCssColor('--color-blue-900');
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, disabled, minHeight = '7rem' }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastExternal = React.useRef<string>(value);
  const savedRangeRef = React.useRef<Range | null>(null);
  const undoSnapshotRef = React.useRef<string | null>(null);
  const formatPaintRef = React.useRef<RichTextFormatPaint | null>(null);
  const [formatReady, setFormatReady] = React.useState(false);

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

  const saveSelection = React.useCallback((): void => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = React.useCallback((): void => {
    const sel = window.getSelection();
    if (!sel || !savedRangeRef.current) return;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }, []);

  const pushUndo = React.useCallback((): void => {
    if (ref.current) undoSnapshotRef.current = ref.current.innerHTML;
  }, []);

  const run = React.useCallback(
    (fn: () => void, options?: { skipUndo?: boolean }): void => {
      if (disabled) return;
      if (!options?.skipUndo) pushUndo();
      ref.current?.focus();
      restoreSelection();
      fn();
      emit();
    },
    [disabled, emit, pushUndo, restoreSelection]
  );

  const undoLast = React.useCallback((): void => {
    if (disabled || !ref.current || undoSnapshotRef.current === null) return;
    ref.current.innerHTML = undoSnapshotRef.current;
    undoSnapshotRef.current = null;
    emit();
  }, [disabled, emit]);

  const copyOrApplyFormat = React.useCallback((): void => {
    if (disabled) return;
    ref.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (formatReady && formatPaintRef.current && !range.collapsed) {
      pushUndo();
      applyFormatPaintToRange(range, formatPaintRef.current);
      formatPaintRef.current = null;
      setFormatReady(false);
      emit();
      return;
    }

    const paint = captureFormatFromSelection();
    if (!paint) return;
    formatPaintRef.current = paint;
    setFormatReady(true);
  }, [disabled, emit, formatReady, pushUndo, restoreSelection]);

  const applySize = React.useCallback(
    (pt: number, all: boolean): void => {
      run(() => {
        if (all && ref.current) {
          applyFontSizeToEditor(ref.current, pt);
          return;
        }
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        applyFontSizeToRange(sel.getRangeAt(0), pt);
      });
    },
    [run]
  );

  const insertLink = React.useCallback((): void => {
    run(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const url = window.prompt('Link URL (https://…)');
      if (!url?.trim()) return;
      if (range.collapsed) {
        const text = window.prompt('Link text', url.trim());
        if (text === null) return;
        insertLinkInRange(range, url, text || url.trim());
        return;
      }
      insertLinkInRange(range, url);
    });
  }, [run]);

  const removeLink = React.useCallback((): void => {
    run(() => removeLinkFromSelection());
  }, [run]);

  const applyColor = React.useCallback(
    (color: string, all: boolean): void => {
      run(() => {
        if (all && ref.current) {
          applyForeColorToEditor(ref.current, color);
          return;
        }
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        applyForeColorToRange(sel.getRangeAt(0), color);
      });
    },
    [run]
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} aria-label="Formatting">
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Bold"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => run(() => document.execCommand('bold'))}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Italic"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => run(() => document.execCommand('italic'))}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Insert link"
          disabled={disabled}
          title="Insert link"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={insertLink}
        >
          <span className={styles.linkBtn}>Link</span>
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Remove link"
          disabled={disabled}
          title="Remove link"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={removeLink}
        >
          Unlink
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label="Underline"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => run(() => document.execCommand('underline'))}
        >
          <span className={styles.underlineBtn}>U</span>
        </button>
        <div className={styles.swatches} role="list" aria-label="Text colour">
          <button
            type="button"
            className={styles.swatchDefault}
            title="Default text colour (selection)"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(readDefaultTextColor(ref.current), false)}
          >
            A
          </button>
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.swatch}
              style={{ background: c }}
              title={`${c} (Alt+click = all text)`}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => applyColor(c, e.altKey)}
            />
          ))}
          <button
            type="button"
            className={styles.swatchAll}
            title="Apply default colour to all notes text"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(readDefaultTextColor(ref.current), true)}
          >
            All
          </button>
        </div>
        <div className={styles.sizeGroup} aria-label="Font size (pt)">
          {FONT_SIZE_PT.map((pt) => (
            <button
              key={pt}
              type="button"
              className={styles.sizeBtn}
              disabled={disabled}
              title={`${pt} pt (Alt+click = all text)`}
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              onClick={(e) => applySize(pt, e.altKey)}
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
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
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
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => run(() => document.execCommand('insertOrderedList'))}
        >
          1.
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${formatReady ? styles.toolBtnActive : ''}`}
          disabled={disabled}
          title={formatReady ? 'Apply copied formatting to selection' : 'Copy formatting from selection'}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={copyOrApplyFormat}
        >
          {formatReady ? 'Apply fmt' : 'Copy fmt'}
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          disabled={disabled}
          title="Back to last setting (undo one format change)"
          onClick={undoLast}
        >
          Undo
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          disabled={disabled}
          title="Clear formatting (selection)"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => run(() => clearRichTextSelection())}
        >
          Tx
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          disabled={disabled}
          title="Clear all formatting"
          onClick={() => {
            if (disabled || !ref.current) return;
            pushUndo();
            const next = clearRichTextAll(ref.current);
            ref.current.innerHTML = next;
            emit();
          }}
        >
          Clear
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
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
      />
    </div>
  );
};
