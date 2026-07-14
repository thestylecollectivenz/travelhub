import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes
} from '../../utils/locationInfoEntry';
import { plainTextToEditorHtml, richTextToPlainText } from '../../utils/journalRichText';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobileLocationNotesEdit.module.css';

export interface MobileLocationNotesEditProps {
  entry: ItineraryEntry;
  onBack: () => void;
}

export const MobileLocationNotesEdit: React.FC<MobileLocationNotesEditProps> = ({ entry, onBack }) => {
  const { updateEntry } = useTripWorkspace();
  const shellMode = useShellMode();
  const data = parseLocationInfoNotes(entry.notes);
  const [draft, setDraft] = React.useState(() =>
    data ? richTextToPlainText(data.practicalTips || '') : ''
  );

  React.useEffect(() => {
    const parsed = parseLocationInfoNotes(entry.notes);
    setDraft(parsed ? richTextToPlainText(parsed.practicalTips || '') : '');
  }, [entry.id, entry.notes]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  if (!data) return null;

  const persist = (plain: string): void => {
    const html = plain.trim() ? plainTextToEditorHtml(plain.trim()) : '';
    const next = normalizeLocationInfoNotes({
      ...data,
      practicalTips: html,
      userEditedPracticalTips: true
    });
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
  };

  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role="presentation" data-shell={shellAttr}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Edit notes">
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => {
              persist(draft);
              onBack();
            }}
          >
            ‹ Back
          </button>
          <h2 className={styles.title}>Notes</h2>
          <button
            type="button"
            className={styles.doneBtn}
            onClick={() => {
              persist(draft);
              onBack();
            }}
          >
            Done
          </button>
        </header>
        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              persist(e.target.value);
            }}
            placeholder="Practical tips for this place…"
            rows={12}
            aria-label="Notes"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
