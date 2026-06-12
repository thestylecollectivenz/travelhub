import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { DEFAULT_PHOTO_FOCAL, photoObjectPositionStyle, type PhotoFocalPoint } from '../../utils/journalPhotoFocal';
import { journalPhotoThumbUrl } from '../../utils/journalPhotoDisplayUrl';
import styles from './JournalPhotoFocalPicker.module.css';

export interface JournalPhotoFocalPickerProps {
  photo: JournalPhoto;
  onSave: (focal: PhotoFocalPoint) => Promise<void>;
}

function focalFromPointer(clientX: number, clientY: number, rect: DOMRect): PhotoFocalPoint {
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(100, Math.max(0, Math.round(x))),
    y: Math.min(100, Math.max(0, Math.round(y)))
  };
}

export const JournalPhotoFocalPicker: React.FC<JournalPhotoFocalPickerProps> = ({ photo, onSave }) => {
  const frameRef = React.useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = React.useState<PhotoFocalPoint>(() => ({
    x: photo.focalX ?? DEFAULT_PHOTO_FOCAL.x,
    y: photo.focalY ?? DEFAULT_PHOTO_FOCAL.y
  }));
  const [busy, setBusy] = React.useState(false);
  const draggingRef = React.useRef(false);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  React.useEffect(() => {
    setDraft({
      x: photo.focalX ?? DEFAULT_PHOTO_FOCAL.x,
      y: photo.focalY ?? DEFAULT_PHOTO_FOCAL.y
    });
  }, [photo.id, photo.focalX, photo.focalY]);

  const persist = React.useCallback(
    async (next: PhotoFocalPoint): Promise<void> => {
      setBusy(true);
      try {
        await onSave(next);
      } finally {
        setBusy(false);
      }
    },
    [onSave]
  );

  const setFromEvent = React.useCallback((clientX: number, clientY: number): void => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    setDraft(focalFromPointer(clientX, clientY, rect));
  }, []);

  const finishDrag = React.useCallback((): void => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    void persist(draftRef.current);
  }, [persist]);

  React.useEffect(() => {
    const onUp = (): void => finishDrag();
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [finishDrag]);

  const imgStyle: React.CSSProperties = {
    ...photoObjectPositionStyle({ focalX: draft.x, focalY: draft.y })
  };

  return (
    <div className={styles.root}>
      <p className={styles.hint}>Click or drag on the square preview to choose which part of the photo shows in tiles and print.</p>
      <button
        ref={frameRef}
        type="button"
        className={styles.frame}
        aria-label="Set photo focal point"
        onPointerDown={(e) => {
          draggingRef.current = true;
          setFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          setFromEvent(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 1;
          let next = draft;
          if (e.key === 'ArrowLeft') next = { ...draft, x: Math.max(0, draft.x - step) };
          else if (e.key === 'ArrowRight') next = { ...draft, x: Math.min(100, draft.x + step) };
          else if (e.key === 'ArrowUp') next = { ...draft, y: Math.max(0, draft.y - step) };
          else if (e.key === 'ArrowDown') next = { ...draft, y: Math.min(100, draft.y + step) };
          else return;
          e.preventDefault();
          setDraft(next);
          void persist(next);
        }}
      >
        <img className={styles.image} src={journalPhotoThumbUrl(photo.fileUrl, 480)} alt="" style={imgStyle} draggable={false} />
        <span className={styles.marker} style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true" />
      </button>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btn}
          disabled={busy}
          onClick={() => {
            const next = { ...DEFAULT_PHOTO_FOCAL };
            setDraft(next);
            void persist(next);
          }}
        >
          Centre
        </button>
        <span className={styles.coords}>
          {draft.x}% · {draft.y}%
        </span>
      </div>
    </div>
  );
};
