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

const PILL_EST_WIDTH = 88;
const MORE_PILL_WIDTH = 72;
const ALL_PILL_WIDTH = 56;

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
  includeAll = false
}) => {
  const sorted = React.useMemo(() => exploreCategoriesSorted(), []);
  const pillsRef = React.useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(6);
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    const el = pillsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = (): void => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const reserved = MORE_PILL_WIDTH + (includeAll ? ALL_PILL_WIDTH : 0);
      const fit = Math.max(1, Math.floor((width - reserved) / PILL_EST_WIDTH));
      setVisibleCount(Math.min(sorted.length, fit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sorted.length, includeAll]);

  React.useEffect(() => {
    if (!moreOpen) return undefined;
    const onDoc = (ev: MouseEvent): void => {
      const t = ev.target as Node | null;
      if (t && pillsRef.current && !pillsRef.current.contains(t)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const primary = sorted.slice(0, visibleCount);
  const more = sorted.slice(visibleCount);
  const primaryIds = new Set(primary.map((c) => c.id));
  const selectedInMore = category !== 'all' && !primaryIds.has(category);
  const selectedOverflow = selectedInMore
    ? sorted.find((c) => c.id === category)
    : undefined;

  return (
    <div className={styles.catPillsBlock}>
      <div className={styles.catPills} role="list" ref={pillsRef}>
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
        {selectedOverflow ? (
          <Pill cat={selectedOverflow} on onClick={() => onChange(selectedOverflow.id)} />
        ) : null}
        {more.length ? (
          <div className={styles.moreWrap}>
            <button
              type="button"
              className={`${styles.catPill} ${moreOpen ? styles.catPillOn : ''}`}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((v) => !v)}
            >
              More
            </button>
          </div>
        ) : null}
      </div>
      {moreOpen && more.length ? (
        <div className={styles.moreMenu} role="menu">
          {more.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="menuitem"
              className={`${styles.moreItem} ${category === cat.id ? styles.moreItemOn : ''}`}
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
  );
};
