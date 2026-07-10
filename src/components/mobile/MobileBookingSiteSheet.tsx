import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styles from './MobileBookingSiteSheet.module.css';

export interface MobileBookingSiteSheetProps {
  title: string;
  options: Array<{ id: string; label: string; href: string }>;
  onClose: () => void;
}

export const MobileBookingSiteSheet: React.FC<MobileBookingSiteSheetProps> = ({ title, options, onClose }) => {
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Book now" onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Book now</h3>
        <p className={styles.sub}>{title}</p>
        <div className={styles.list}>
          {options.map((opt) => (
            <a key={opt.id} className={styles.option} href={opt.href} target="_blank" rel="noopener noreferrer">
              {opt.label}
            </a>
          ))}
        </div>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
};
