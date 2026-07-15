import * as React from 'react';
import {
  exploreCategoriesSorted,
  type ExploreCategoryDef,
  type ExploreCategoryId
} from '../../utils/exploreCategories';
import { NearYouToolIcon } from '../shared/NearYouToolIcon';
import { exploreCategoryToNearTool } from '../../utils/exploreCategories';
import styles from './MobileExploreCategoryPills.module.css';

export interface MobileExploreCategoryPillsProps {
  category: ExploreCategoryId | 'all';
  onChange: (id: ExploreCategoryId | 'all') => void;
  /** When true, include an "All" pill first (saved places). */
  includeAll?: boolean;
}

function CategoryGlyph({ id }: { id: ExploreCategoryId }): React.ReactElement {
  const tool = exploreCategoryToNearTool(id);
  if (tool) return <NearYouToolIcon toolId={tool} size="sm" />;
  return (
    <span className={styles.sightsGlyph} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 18 8 8l4 6 3-4 5 8H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Pill({
  cat,
  on,
  onClick
}: {
  cat: ExploreCategoryDef;
  on: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="listitem"
      data-selected={on ? 'true' : undefined}
      className={`${styles.catPill} ${on ? styles.catPillOn : ''}`}
      style={{ '--cat-accent': cat.accent, '--cat-bg': cat.bg } as React.CSSProperties}
      onClick={onClick}
    >
      <span className={styles.catPillIcon}>
        <CategoryGlyph id={cat.id} />
      </span>
      {cat.label}
    </button>
  );
}

/** Shared Explore / Saved category chip row — horizontal scroll of all categories. */
export const MobileExploreCategoryPills: React.FC<MobileExploreCategoryPillsProps> = ({
  category,
  onChange,
  includeAll = false
}) => {
  const sorted = React.useMemo(() => exploreCategoriesSorted(), []);
  const rowRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const selected = row.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (!selected) return;
    const left = selected.offsetLeft - 12;
    row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [category]);

  return (
    <div className={styles.catPillsBlock}>
      <div className={styles.catPills} role="list" ref={rowRef}>
        {includeAll ? (
          <button
            type="button"
            role="listitem"
            data-selected={category === 'all' ? 'true' : undefined}
            className={`${styles.catPill} ${category === 'all' ? styles.catPillOn : ''}`}
            style={{ '--cat-accent': '#2f5eb8', '--cat-bg': '#e8eef8' } as React.CSSProperties}
            onClick={() => onChange('all')}
          >
            All
          </button>
        ) : null}
        {sorted.map((cat) => (
          <Pill key={cat.id} cat={cat} on={category === cat.id} onClick={() => onChange(cat.id)} />
        ))}
      </div>
    </div>
  );
};
