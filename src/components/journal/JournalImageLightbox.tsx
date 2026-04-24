import * as React from 'react';
import styles from './JournalImageLightbox.module.css';

export interface JournalImageLightboxProps {
  url: string;
  onClose: () => void;
}

export const JournalImageLightbox: React.FC<JournalImageLightboxProps> = ({ url, onClose }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <button type="button" className={styles.lightbox} onClick={onClose} aria-label="Close image preview">
      <img className={styles.lightboxImg} src={url} alt="" onClick={(e) => e.stopPropagation()} />
    </button>
  );
};
