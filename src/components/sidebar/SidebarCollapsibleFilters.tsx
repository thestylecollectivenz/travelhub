import * as React from 'react';
import styles from './TripSidebar.module.css';

export const SidebarCollapsibleFilters: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children
}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div className={styles.dayListSection}>
      <button
        type="button"
        className={styles.sectionCollapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.dayListHeading}>{title}</span>
        <span className={styles.sectionChevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? children : null}
    </div>
  );
};
