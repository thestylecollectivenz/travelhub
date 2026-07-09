import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
import { useConfig } from '../../context/ConfigContext';
import { RichTextEditor } from './RichTextEditor';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { richTextToPlainText } from '../../utils/journalRichText';
import styles from './JournalEntryComposer.module.css';

export interface JournalEntryComposerProps {
  dayId: string;
  onCancel: () => void;
  onSaved: () => void;
  /** Increment to open the photo file picker (e.g. Photos tab “new entry” flow). */
  focusPhotoPickerKey?: number;
}

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

export const JournalEntryComposer: React.FC<JournalEntryComposerProps> = ({ dayId, onCancel, onSaved, focusPhotoPickerKey }) => {
  const { addEntry, addPhoto } = useJournal();
  const { config } = useConfig();
  const [entryHtml, setEntryHtml] = React.useState('<p><br></p>');
  const [location, setLocation] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = React.useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [helperQuestion, setHelperQuestion] = React.useState('');
  const [helperAnswer, setHelperAnswer] = React.useState('');
  const [helperBusy, setHelperBusy] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const normalizeDictation = React.useCallback((input: string): string => {
    let t = (input || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    t = t.replace(/\bi\b/g, 'I');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t)) t += '.';
    return t;
  }, []);

  const appendDictation = React.useCallback(
    (chunk: string) => {
      const nextChunk = normalizeDictation(chunk);
      if (!nextChunk) return;
      setEntryHtml((prev) => {
        const plain = richTextToPlainText(prev).trim();
        const nextPlain = `${plain}${plain ? '\n\n' : ''}${nextChunk}`.trim();
        return `<p>${nextPlain.replace(/\n\n/g, '</p><p>')}</p>`;
      });
    },
    [normalizeDictation]
  );

  const { listening: dictating, toggleListening: toggleDictation, stopListening: stopDictation } =
    useContinuousSpeechInput(appendDictation);

  const prevPhotoFocusKey = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (focusPhotoPickerKey === undefined) return;
    if (focusPhotoPickerKey <= 0) return;
    if (prevPhotoFocusKey.current === focusPhotoPickerKey) return;
    prevPhotoFocusKey.current = focusPhotoPickerKey;
    window.requestAnimationFrame(() => {
      photoInputRef.current?.click();
    });
  }, [focusPhotoPickerKey]);

  React.useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    setPhotoCaptions((prev) => {
      const next = files.map((_, i) => prev[i] ?? '');
      return next;
    });
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

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
    e.target.value = '';
  };

  const save = async (): Promise<void> => {
    if (isRichTextEditorEmpty(entryHtml)) {
      setError('Please write something for this entry.');
      return;
    }
    setSaving(true);
    stopDictation();
    setError(null);
    setProgress(null);
    try {
      const entry = await addEntry({ dayId, entryText: entryHtml.trim(), location: location.trim() || undefined });
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
          const cap = photoCaptions[i]?.trim() ?? '';
          await addPhoto({ journalEntryId: entry.id, dayId, file: files[i], caption: cap });
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

  const askHelper = async (): Promise<void> => {
    const q = helperQuestion.trim();
    if (!q) return;
    const key = (config.geminiApiKey || '').trim();
    if (!key) {
      setError('Add a Gemini API key in User settings to use the journal AI helper.');
      return;
    }
    setHelperBusy(true);
    setError(null);
    try {
      const context = richTextToPlainText(entryHtml).trim();
      const prompt = context
        ? `Journal context:\n${context}\n\nQuestion: ${q}`
        : `Question: ${q}`;
      const { answer } = await answerTravelChat(key, [{ role: 'user', text: prompt }], undefined, undefined);
      setHelperAnswer(answer.trim());
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setHelperBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.label}>
        <span>Entry</span>
        <div className={styles.dictationRow}>
          <button type="button" className={styles.button} onClick={toggleDictation} disabled={saving}>
            {dictating ? 'Stop dictation' : 'Speak to write'}
          </button>
        </div>
        <div className={styles.editorWrap}>
          <RichTextEditor value={entryHtml} onChange={setEntryHtml} disabled={saving} minHeight="9rem" />
        </div>
      </div>
      <div className={styles.helperWrap}>
        <label className={styles.label}>
          Ask AI helper (e.g. place names, memory prompts)
          <input
            className={styles.input}
            value={helperQuestion}
            onChange={(e) => setHelperQuestion(e.target.value)}
            placeholder="Ask about your day..."
            disabled={helperBusy || saving}
          />
        </label>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            void askHelper();
          }}
          disabled={helperBusy || saving || !helperQuestion.trim()}
        >
          {helperBusy ? 'Thinking…' : 'Ask helper'}
        </button>
        {helperAnswer ? <div className={styles.helperAnswer}>{helperAnswer}</div> : null}
      </div>
      <label className={styles.label}>
        Location (optional)
        <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className={styles.label}>
        Photos (optional)
        <input
          ref={photoInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          onChange={onPickFiles}
        />
      </label>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className={styles.photoRow}>
          {previewUrls[i] ? (
            <img className={styles.photoPreview} src={previewUrls[i]} alt="" />
          ) : null}
          <div className={styles.photoMeta}>
            <span className={styles.fileName}>{f.name}</span>
            <input
              className={styles.captionInput}
              placeholder="Caption (optional)"
              value={photoCaptions[i] ?? ''}
              onChange={(e) => {
                const next = [...photoCaptions];
                next[i] = e.target.value;
                setPhotoCaptions(next);
              }}
            />
          </div>
        </div>
      ))}
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
