import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
import styles from './JournalEntryComposer.module.css';

export interface JournalEntryComposerProps {
  dayId: string;
  onCancel: () => void;
  onSaved: () => void;
}

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

export const JournalEntryComposer: React.FC<JournalEntryComposerProps> = ({ dayId, onCancel, onSaved }) => {
  const { addEntry, addPhoto } = useJournal();
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(e.target.files ?? []);
    const next: File[] = [];
    for (const f of picked) {
      if (f.size > 10 * 1024 * 1024) {
        setError('Each image must be 10MB or smaller.');
        continue;
      }
      if (!isAllowedImage(f)) {
        setError('Only JPG, PNG, or WEBP images are supported.');
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (next.length) setError(null);
  };

  const save = async (): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please write something for this entry.');
      return;
    }
    setSaving(true);
    setError(null);
    setProgress(null);
    try {
      const entry = await addEntry({ dayId, entryText: trimmed, location: location.trim() || undefined });
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
          await addPhoto({ journalEntryId: entry.id, dayId, file: files[i], caption: '' });
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save journal entry.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className={styles.root}>
      <label className={styles.label}>
        Entry
        <textarea className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className={styles.label}>
        Location (optional)
        <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className={styles.label}>
        Photos (optional)
        <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={onPickFiles} />
      </label>
      {error ? <div className={styles.error}>{error}</div> : null}
      {progress ? <div className={styles.progress}>{progress}</div> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => save().catch(console.error)} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};
