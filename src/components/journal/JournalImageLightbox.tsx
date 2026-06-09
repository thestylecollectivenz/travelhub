import * as React from 'react';
import styles from './JournalImageLightbox.module.css';

export interface JournalGalleryItem {
  url: string;
  caption?: string;
}

export interface JournalImageLightboxProps {
  items: JournalGalleryItem[];
  startIndex: number;
  onClose: () => void;
}

export const JournalImageLightbox: React.FC<JournalImageLightboxProps> = ({ items, startIndex, onClose }) => {
  const [index, setIndex] = React.useState(() => Math.min(Math.max(0, startIndex), Math.max(0, items.length - 1)));
  const touchStartX = React.useRef<number | null>(null);

  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = React.useCallback((): void => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = React.useCallback((): void => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) goPrev();
      else if (e.key === 'ArrowRight' && hasNext) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, hasPrev, hasNext]);

  if (!item) {
    return null;
  }

  const caption = item.caption?.trim();

  return (
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Photo preview">
      <button type="button" className={styles.backdropBtn} onClick={onClose} aria-label="Close image preview" />
      {items.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            disabled={!hasPrev}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            disabled={!hasNext}
            aria-label="Next photo"
          >
            ›
          </button>
          <div className={styles.counter} aria-live="polite">
            {index + 1} / {items.length}
          </div>
        </>
      ) : null}
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div
        className={styles.stage}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null || items.length < 2) return;
          const end = e.changedTouches[0]?.clientX ?? start;
          const delta = end - start;
          if (Math.abs(delta) < 48) return;
          if (delta < 0 && hasNext) goNext();
          else if (delta > 0 && hasPrev) goPrev();
        }}
      >
        <img className={styles.lightboxImg} src={item.url} alt={caption || 'Journal photo'} />
        {caption ? <p className={styles.caption}>{caption}</p> : null}
      </div>
    </div>
  );
};
