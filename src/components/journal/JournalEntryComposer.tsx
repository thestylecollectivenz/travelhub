import * as React from 'react';
import { useJournal } from '../../context/JournalContext';
import { useConfig } from '../../context/ConfigContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { RichTextEditor } from './RichTextEditor';
import { isRichTextEditorEmpty } from '../../utils/journalRichText';
import { answerTravelChat } from '../../services/GeminiService';
import { formatGeminiUserMessage } from '../../services/geminiErrorMessage';
import { useContinuousSpeechInput } from '../../hooks/useContinuousSpeechInput';
import { richTextToPlainText } from '../../utils/journalRichText';
import { buildAiCurrentFocusBlock, buildTripDayAiContext } from '../../utils/buildTripDayAiContext';
import { placeDisplayLabel } from '../../utils/placeDisplayLabel';
import { compressImageForUpload } from '../../utils/compressImageForUpload';
import { confirmUserAction } from '../../utils/confirmAction';
import { isLocationInfoEntry } from '../../utils/locationInfoEntry';
import { formatTimeHHMM } from '../../utils/itineraryTimeUtils';
import { markdownToHtml } from '../../utils/markdownToHtml';
import { RichTextContent } from '../shared/RichTextContent';
import styles from './JournalEntryComposer.module.css';

export interface JournalEntryComposerProps {
  dayId: string;
  onCancel: () => void;
  onSaved: () => void;
  /** Increment to open the photo file picker (e.g. Photos tab “new entry” flow). */
  focusPhotoPickerKey?: number;
}

/** SharePoint / upload soft limit — prompt to compress above this. */
const LARGE_PHOTO_BYTES = Math.round(4.5 * 1024 * 1024);

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

function isTransientSaveError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /load failed|failed to fetch|network|timeout|temporarily/i.test(msg);
}

async function withTransientRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < attempts - 1 && isTransientSaveError(err)) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw last;
}

export const JournalEntryComposer: React.FC<JournalEntryComposerProps> = ({ dayId, onCancel, onSaved, focusPhotoPickerKey }) => {
  const { addEntry, addPhoto } = useJournal();
  const { config } = useConfig();
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const [entryHtml, setEntryHtml] = React.useState('<p><br></p>');
  const [location, setLocation] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = React.useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
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
    e.target.value = '';
    void (async () => {
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
        let file = f;
        if (f.size > LARGE_PHOTO_BYTES) {
          const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
          const ok = await confirmUserAction(
            'This photo is large',
            `${f.name} is about ${sizeMb} MB. Compress and resize it before upload?`
          );
          if (!ok) {
            setError('Large photo skipped. Choose Compress next time, or pick a smaller image.');
            continue;
          }
          try {
            setProgress(`Compressing ${f.name}…`);
            file = await compressImageForUpload(f, 1920, 0.78);
          } catch {
            setError(`Could not compress ${f.name}. Try a smaller image.`);
            continue;
          } finally {
            setProgress(null);
          }
        }
        next.push(file);
      }
      setFiles(next);
      if (next.length) setError(null);
    })();
  };

  const save = async (): Promise<void> => {
    if (savingRef.current) return;
    if (isRichTextEditorEmpty(entryHtml)) {
      setError('Please write something for this entry.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    stopDictation();
    setError(null);
    setProgress(null);
    try {
      const entry = await withTransientRetry(() =>
        addEntry({ dayId, entryText: entryHtml.trim(), location: location.trim() || undefined })
      );
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
          const cap = photoCaptions[i]?.trim() ?? '';
          await withTransientRetry(() =>
            addPhoto({ journalEntryId: entry.id, dayId, file: files[i], caption: cap })
          );
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save journal entry.');
    }
    // Reset busy lock after awaits complete (intentional; not a stale read).
    // eslint-disable-next-line require-atomic-updates -- save serialisation lock
    savingRef.current = false;
    setSaving(false);
    setProgress(null);
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
      const day = tripDays.find((d) => d.id === dayId);
      const place = day?.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
      const placeTitle = place
        ? placeDisplayLabel(place)
        : location.trim() || undefined;
      const tripContext = trip
        ? buildTripDayAiContext({
            trip,
            tripDays,
            day,
            entries: localEntries,
            placeTitle,
            placeForDay: (d) => {
              const p = d.primaryPlaceId ? placeById(d.primaryPlaceId) : undefined;
              return p;
            },
            daySpecific: true
          })
        : undefined;
      const focus = buildAiCurrentFocusBlock({
        isTasksView: false,
        dayScope: 'day',
        selectedDay: day,
        placeTitle,
        mainWorkspaceTab: 'journal'
      });
      const draftPlain = richTextToPlainText(entryHtml).trim();
      const prompt = [
        draftPlain ? `Draft journal entry so far:\n${draftPlain}` : '',
        location.trim() ? `Entry location field: ${location.trim()}` : '',
        `Question: ${q}`
      ]
        .filter(Boolean)
        .join('\n\n');
      const { answer } = await answerTravelChat(key, [{ role: 'user', text: prompt }], tripContext, {
        currentFocusBlock: focus
      });
      setHelperAnswer(answer.trim());
    } catch (err) {
      setError(formatGeminiUserMessage(err));
    } finally {
      setHelperBusy(false);
    }
  };

  const insertItineraryRecap = (): void => {
    const dayItems = localEntries
      .filter((e) => e.dayId === dayId && !e.parentEntryId && !isLocationInfoEntry(e))
      .slice()
      .sort((a, b) => {
        const ta = (a.timeStart || '').trim();
        const tb = (b.timeStart || '').trim();
        if (ta && tb && ta !== tb) return ta.localeCompare(tb);
        if (ta && !tb) return -1;
        if (!ta && tb) return 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.title || '').localeCompare(b.title || '');
      });
    if (!dayItems.length) {
      setHelperAnswer('No itinerary items planned for this day.');
      return;
    }
    const lines = dayItems.map((e) => {
      const title = (e.title || 'Untitled').trim() || 'Untitled';
      const time = formatTimeHHMM(e.timeStart || '');
      return time ? `• **${title}** — ${time}` : `• **${title}**`;
    });
    setHelperAnswer(`**Itinerary recap**\n\n${lines.join('\n')}`);
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
          <RichTextEditor
            value={entryHtml}
            onChange={setEntryHtml}
            disabled={saving}
            minHeight="9rem"
            variant="full"
          />
        </div>
      </div>
      <div className={styles.helperWrap}>
        <span className={styles.helperLabel}>Ask AI helper (e.g. place names, memory prompts)</span>
        <div className={styles.inputRow}>
          <input
            className={styles.helperInput}
            value={helperQuestion}
            onChange={(e) => setHelperQuestion(e.target.value)}
            placeholder="Ask about your day…"
            disabled={helperBusy || saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void askHelper();
              }
            }}
          />
          <button
            type="button"
            className={styles.askBtn}
            onClick={() => {
              void askHelper();
            }}
            disabled={helperBusy || saving || !helperQuestion.trim()}
          >
            {helperBusy ? '…' : 'Ask'}
          </button>
        </div>
        <div className={styles.helperActions}>
          <button
            type="button"
            className={styles.recapBtn}
            onClick={insertItineraryRecap}
            disabled={helperBusy || saving}
          >
            Itinerary recap
          </button>
        </div>
        {helperAnswer ? (
          <RichTextContent html={markdownToHtml(helperAnswer)} className={styles.helperAnswer} />
        ) : null}
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
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={() => {
            void save();
          }}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};
