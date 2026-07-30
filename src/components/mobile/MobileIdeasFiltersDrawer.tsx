import * as React from 'react';
import { createPortal } from 'react-dom';
import { useShellMode } from '../../hooks/useShellMode';
import type { TripIdeasFilter } from '../../utils/tripIdeasUnified';
import styles from './MobilePackingFilters.module.css';

export interface MobileIdeasFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filter: TripIdeasFilter;
  onFilterChange: (filter: TripIdeasFilter) => void;
  counts: Partial<Record<TripIdeasFilter, number>>;
}

const ADVANCED_OPTIONS: Array<{ key: TripIdeasFilter; label: string }> = [
  { key: 'allByLocation', label: 'All by location' },
  { key: 'newByLocation', label: 'New / unread by location' },
  { key: 'favouritesByTraveller', label: 'Favourites by traveller' },
  { key: 'favouritesByLocation', label: 'Favourites by location' },
  { key: 'ai', label: 'AI suggestions' },
  { key: 'replies', label: 'With replies' }
];

/** Right slide-out advanced filters for trip ideas. */
export const MobileIdeasFiltersDrawer: React.FC<MobileIdeasFiltersDrawerProps> = ({
  open,
  onClose,
  filter,
  onFilterChange,
  counts
}) => {
  const shellMode = useShellMode();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close filters" onClick={onClose} />
      <aside
        className={styles.drawer}
        data-shell={shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ideas-filters-title"
      >
        <div className={styles.header}>
          <h2 id="ideas-filters-title" className={styles.title}>
            Filters
          </h2>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <p className={styles.sectionTitle}>More filters</p>
            <ul className={styles.statusList}>
              {ADVANCED_OPTIONS.map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={styles.statusRow}
                    onClick={() => {
                      onFilterChange(opt.key);
                      onClose();
                    }}
                  >
                    <span>
                      {opt.label}
                      {counts[opt.key] !== undefined ? ` (${counts[opt.key]})` : ''}
                    </span>
                    <span className={`${styles.radio} ${filter === opt.key ? styles.radioOn : ''}`} aria-hidden>
                      {filter === opt.key ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => {
              onFilterChange('all');
              onClose();
            }}
          >
            Reset
          </button>
          <button type="button" className={styles.applyBtn} onClick={onClose}>
            Apply filters
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
};
