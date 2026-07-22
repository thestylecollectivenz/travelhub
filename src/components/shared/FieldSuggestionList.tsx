import * as React from 'react';
import styles from './FieldSuggestionList.module.css';

export interface FieldSuggestionListProps {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  active: boolean;
  maxItems?: number;
}

export const FieldSuggestionList: React.FC<FieldSuggestionListProps> = ({
  options,
  value,
  onSelect,
  active,
  maxItems = 10
}) => {
  if (!active || options.length === 0) return null;

  const q = value.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, maxItems);
  if (filtered.length === 0) return null;

  return (
    <ul className={styles.list} role="listbox" aria-label="Suggestions">
      {filtered.map((opt) => (
        <li key={opt}>
          <button
            type="button"
            className={styles.item}
            role="option"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        </li>
      ))}
    </ul>
  );
};
