import * as React from 'react';
import type { LocationHighlightKind, LocationHighlightRow } from '../../utils/locationInfoEntry';
import styles from './LocationInfoHighlights.module.css';

const KIND_ICON: Record<LocationHighlightKind, string> = {
  sight: '🏛',
  food: '🍽',
  drink: '🍷',
  souvenir: '🎁'
};

const KIND_LABEL: Record<LocationHighlightKind, string> = {
  sight: 'Sight',
  food: 'Food',
  drink: 'Drink',
  souvenir: 'Souvenir'
};

export interface LocationInfoHighlightsProps {
  rows: LocationHighlightRow[];
  onChange: (rows: LocationHighlightRow[]) => void;
  readOnly?: boolean;
  emptyHint?: string;
}

export const LocationInfoHighlights: React.FC<LocationInfoHighlightsProps> = ({
  rows,
  onChange,
  readOnly = false,
  emptyHint = 'AI suggestions will appear here once research is enabled.'
}) => {
  const [draftLine, setDraftLine] = React.useState('');
  const [draftKind, setDraftKind] = React.useState<LocationHighlightKind>('sight');

  const toggle = (id: string): void => {
    onChange(rows.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  };

  const remove = (id: string): void => {
    onChange(rows.filter((x) => x.id !== id));
  };

  const addLine = (): void => {
    const label = draftLine.trim();
    if (!label) return;
    onChange([
      ...rows,
      { id: `item-${Date.now()}`, label, done: false, kind: draftKind }
    ]);
    setDraftLine('');
  };

  const doneCount = rows.filter((x) => x.done).length;

  return (
    <div className={styles.root}>
      {rows.length ? (
        <ul className={styles.list}>
          {rows.map((item) => (
            <li key={item.id} className={styles.row}>
              <span className={styles.kindIcon} title={KIND_LABEL[item.kind]} aria-hidden>
                {KIND_ICON[item.kind]}
              </span>
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
                <>
                  <button
                    type="button"
                    className={styles.refreshBtn}
                    disabled
                    title="Refresh this suggestion with AI (coming soon)"
                    aria-label={`Refresh ${item.label}`}
                  >
                    ↻
                  </button>
                  <button type="button" className={styles.removeBtn} onClick={() => remove(item.id)} aria-label="Remove">
                    ×
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{emptyHint}</p>
      )}
      {!readOnly ? (
        <div className={styles.addRow}>
          <select
            className={styles.addKind}
            value={draftKind}
            onChange={(e) => setDraftKind(e.target.value as LocationHighlightKind)}
            aria-label="Type"
          >
            <option value="sight">Sight</option>
            <option value="food">Food</option>
            <option value="drink">Drink</option>
            <option value="souvenir">Souvenir</option>
          </select>
          <input
            className={styles.addInput}
            value={draftLine}
            placeholder="Add item manually"
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
      {rows.length ? (
        <p className={styles.progress}>
          {doneCount} of {rows.length} done
        </p>
      ) : null}
    </div>
  );
};
