import * as React from 'react';
import styles from './MobileDayPickActions.module.css';

export type TipListTarget = 'todo' | 'packing' | 'shopping';

export interface MobileTipListChooserProps {
  open: boolean;
  tipPreview: string;
  onPick: (target: TipListTarget) => void;
  onCancel: () => void;
}

/** Choose To-do / Packing / Shopping when creating from a travel tip. */
export const MobileTipListChooser: React.FC<MobileTipListChooserProps> = ({
  open,
  tipPreview,
  onPick,
  onCancel
}) => {
  if (!open) return null;
  const preview = tipPreview.trim().slice(0, 80);
  return (
    <div className={styles.root} role="group" aria-label="Save tip as">
      <p className={styles.title}>Save tip as{preview ? `: “${preview}${tipPreview.trim().length > 80 ? '…' : ''}”` : ''}</p>
      <div className={styles.list}>
        <button type="button" className={styles.dayBtn} onClick={() => onPick('todo')}>
          To-do
        </button>
        <button type="button" className={styles.dayBtn} onClick={() => onPick('packing')}>
          Packing list
        </button>
        <button type="button" className={styles.dayBtn} onClick={() => onPick('shopping')}>
          Shopping list
        </button>
      </div>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
};

export interface MobileTipItemEditProps {
  open: boolean;
  kind: 'packing' | 'shopping' | 'todo';
  title: string;
  notes: string;
  onChangeTitle: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export const MobileTipItemEdit: React.FC<MobileTipItemEditProps> = ({
  open,
  kind,
  title,
  notes,
  onChangeTitle,
  onChangeNotes,
  onSave,
  onCancel,
  busy
}) => {
  if (!open) return null;
  const heading =
    kind === 'packing' ? 'Add packing item' : kind === 'shopping' ? 'Add shopping item' : 'Add to-do';
  return (
    <div className={styles.root} role="group" aria-label={heading}>
      <p className={styles.title}>{heading}</p>
      <label className={styles.cancel} style={{ display: 'grid', gap: '0.25rem', textAlign: 'left' }}>
        Title
        <input
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          style={{
            border: '1px solid color-mix(in srgb, #1e2a44 14%, transparent)',
            borderRadius: '0.65rem',
            padding: '0.5rem 0.65rem',
            font: 'inherit'
          }}
        />
      </label>
      <label className={styles.cancel} style={{ display: 'grid', gap: '0.25rem', textAlign: 'left', marginTop: '0.45rem' }}>
        Notes
        <textarea
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          rows={3}
          style={{
            border: '1px solid color-mix(in srgb, #1e2a44 14%, transparent)',
            borderRadius: '0.65rem',
            padding: '0.5rem 0.65rem',
            font: 'inherit',
            resize: 'vertical'
          }}
        />
      </label>
      <div className={styles.list} style={{ marginTop: '0.65rem' }}>
        <button type="button" className={styles.dayBtn} onClick={onSave} disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  );
};
