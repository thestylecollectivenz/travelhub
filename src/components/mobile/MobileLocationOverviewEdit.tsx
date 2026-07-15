import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import {
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes
} from '../../utils/locationInfoEntry';
import { isRichTextEditorEmpty, plainTextToEditorHtml } from '../../utils/journalRichText';
import { RichTextEditor } from '../journal/RichTextEditor';
import { useShellMode } from '../../hooks/useShellMode';
import styles from './MobileLocationNotesEdit.module.css';

export interface MobileLocationOverviewEditProps {
  entry: ItineraryEntry;
  onBack: () => void;
}

export const MobileLocationOverviewEdit: React.FC<MobileLocationOverviewEditProps> = ({ entry, onBack }) => {
  const { updateEntry } = useTripWorkspace();
  const shellMode = useShellMode();
  const data = parseLocationInfoNotes(entry.notes);
  const [draft, setDraft] = React.useState(() =>
    data ? plainTextToEditorHtml(data.overview || '') : '<p><br></p>'
  );

  React.useEffect(() => {
    const parsed = parseLocationInfoNotes(entry.notes);
    setDraft(parsed ? plainTextToEditorHtml(parsed.overview || '') : '<p><br></p>');
  }, [entry.id, entry.notes]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  if (!data) return null;

  const persist = (html: string): void => {
    const next = normalizeLocationInfoNotes({
      ...data,
      overview: isRichTextEditorEmpty(html) ? '' : html,
      userEditedOverview: true
    });
    updateEntry({ ...entry, notes: serializeLocationInfoNotes(next) });
  };

  const shellAttr = shellMode === 'ipad-portrait' ? 'ipad-portrait' : undefined;

  return ReactDOM.createPortal(
    <div className={styles.overlay} role="presentation" data-shell={shellAttr}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Edit overview">
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
          <h2 className={styles.title}>Overview</h2>
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
          <div className={styles.editorWrap}>
            <RichTextEditor
              value={draft}
              onChange={(html) => {
                setDraft(html);
                persist(html);
              }}
              minHeight="16rem"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
