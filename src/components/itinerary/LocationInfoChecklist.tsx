import * as React from 'react';
import type { LocationInfoCheckItem } from '../../utils/locationInfoEntry';
import styles from './LocationInfoChecklist.module.css';

export interface LocationInfoChecklistProps {
  items: LocationInfoCheckItem[];
  onChange: (items: LocationInfoCheckItem[]) => void;
  readOnly?: boolean;
  addPlaceholder?: string;
  aiHint?: string;
}

export const LocationInfoChecklist: React.FC<LocationInfoChecklistProps> = ({
  items,
  onChange,
  readOnly = false,
  addPlaceholder = 'Add item (one per line in edit)',
  aiHint
}) => {
  const [draftLine, setDraftLine] = React.useState('');

  const toggle = (id: string): void => {
    onChange(items.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  };

  const addLine = (): void => {
    const label = draftLine.trim();
    if (!label) return;
    onChange([
      ...items,
      { id: `item-${Date.now()}`, label, done: false }
    ]);
    setDraftLine('');
  };

  const remove = (id: string): void => {
    onChange(items.filter((x) => x.id !== id));
  };

  const doneCount = items.filter((x) => x.done).length;

  return (
    <div className={styles.root}>
      {items.length ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly}
                  onChange={() => toggle(item.id)}
                />
                <span className={item.done ? styles.labelDone : undefined}>{item.label}</span>
              </label>
              {!readOnly ? (
                <button type="button" className={styles.removeBtn} onClick={() => remove(item.id)} aria-label="Remove">
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{aiHint || 'No items yet.'}</p>
      )}
      {!readOnly ? (
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            value={draftLine}
            placeholder={addPlaceholder}
            onChange={(e) => setDraftLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLine();
              }
            }}
          />
          <button type="button" className={styles.addBtn} onClick={addLine}>
            Add
          </button>
        </div>
      ) : null}
      {items.length ? (
        <p className={styles.progress}>
          {doneCount} of {items.length} done
        </p>
      ) : null}
    </div>
  );
};
