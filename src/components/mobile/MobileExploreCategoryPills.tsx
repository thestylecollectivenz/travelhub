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
  maxPrimary?: number;
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

/** Shared Explore / Saved category chip row (primary pills + More). */
export const MobileExploreCategoryPills: React.FC<MobileExploreCategoryPillsProps> = ({
  category,
  onChange,
  includeAll = false,
  maxPrimary = 6
}) => {
  const sorted = React.useMemo(() => exploreCategoriesSorted(), []);
  const primary = sorted.slice(0, maxPrimary);
  const more = sorted.slice(maxPrimary);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const primaryIds = new Set(primary.map((c) => c.id));
  const selectedInMore = category !== 'all' && !primaryIds.has(category);

  return (
    <div className={styles.catPills} role="list">
      {includeAll ? (
        <button
          type="button"
          role="listitem"
          className={`${styles.catPill} ${category === 'all' ? styles.catPillOn : ''}`}
          style={{ '--cat-accent': '#2f5eb8', '--cat-bg': '#e8eef8' } as React.CSSProperties}
          onClick={() => onChange('all')}
        >
          All
        </button>
      ) : null}
      {primary.map((cat) => (
        <Pill key={cat.id} cat={cat} on={category === cat.id} onClick={() => onChange(cat.id)} />
      ))}
      {selectedInMore ? (
        <Pill
          cat={exploreCategoriesSorted().find((c) => c.id === category) || primary[0]}
          on
          onClick={() => onChange(category as ExploreCategoryId)}
        />
      ) : null}
      {more.length ? (
        <div className={styles.moreWrap}>
          <button type="button" className={styles.catPill} onClick={() => setMoreOpen((v) => !v)}>
            More
          </button>
          {moreOpen ? (
            <div className={styles.moreMenu} role="menu">
              {more.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    onChange(cat.id);
                  }}
                >
                  <CategoryGlyph id={cat.id} />
                  {cat.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
