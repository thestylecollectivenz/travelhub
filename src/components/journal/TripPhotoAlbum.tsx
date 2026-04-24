import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalImageLightbox } from './JournalImageLightbox';
import styles from './TripPhotoAlbum.module.css';

type AlbumLayout = 'all' | 'by-day';

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

export const TripPhotoAlbum: React.FC = () => {
  const { allTripPhotos, addAlbumPhoto } = useJournal();
  const { trip, tripDays } = useTripWorkspace();

  const [layout, setLayout] = React.useState<AlbumLayout>('all');
  const [scopeDayId, setScopeDayId] = React.useState<string>('');
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadDayId, setUploadDayId] = React.useState<string>('');
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [captions, setCaptions] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  React.useEffect(() => {
    if (days.length > 0 && !uploadDayId) {
      setUploadDayId(days[0].id);
    }
  }, [days, uploadDayId]);

  const photos = allTripPhotos;

  const grouped = React.useMemo(() => {
    const map = new Map<string, JournalPhoto[]>();
    for (const p of photos) {
      const k = p.dayId || '_';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [photos]);

  const orderedDayIds = React.useMemo(() => days.map((d) => d.id), [days]);

  const visibleSections = React.useMemo(() => {
    if (layout === 'all') {
      return [{ title: null as string | null, items: photos }];
    }
    if (scopeDayId) {
      const d = days.find((x) => x.id === scopeDayId);
      const items = photos.filter((p) => p.dayId === scopeDayId);
      return [{ title: d ? `Day ${d.dayNumber} — ${d.displayTitle}` : 'Photos', items }];
    }
    const sections: { title: string; items: JournalPhoto[] }[] = [];
    for (const dayId of orderedDayIds) {
      const items = grouped.get(dayId) ?? [];
      if (!items.length) continue;
      const d = days.find((x) => x.id === dayId);
      sections.push({
        title: d ? `Day ${d.dayNumber} — ${d.displayTitle}` : 'Photos',
        items
      });
    }
    return sections;
  }, [layout, scopeDayId, photos, grouped, orderedDayIds, days]);

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
    setPendingFiles(next);
    setCaptions(next.map(() => ''));
    if (next.length) setError(null);
    e.target.value = '';
  };

  const runUpload = async (): Promise<void> => {
    if (!uploadDayId) {
      setError('Select which day these photos belong to.');
      return;
    }
    if (!pendingFiles.length) {
      setError('Choose one or more photos.');
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(null);
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        setProgress(`Uploading ${i + 1} of ${pendingFiles.length}…`);
        const cap = captions[i]?.trim() ?? '';
        await addAlbumPhoto(uploadDayId, pendingFiles[i], cap);
      }
      setPendingFiles([]);
      setCaptions([]);
      setUploadOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const totalVisible = visibleSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <section className={styles.root} aria-label="Trip photo album">
      <header className={styles.header}>
        <h2 className={styles.title}>Photos</h2>
        <p className={styles.subtitle}>Journal and album images for this trip</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Album layout">
          <button
            type="button"
            className={`${styles.segmentButton} ${layout === 'all' ? styles.segmentActive : ''}`}
            onClick={() => {
              setLayout('all');
              setScopeDayId('');
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.segmentButton} ${layout === 'by-day' ? styles.segmentActive : ''}`}
            onClick={() => {
              setLayout('by-day');
              setScopeDayId('');
            }}
          >
            By day
          </button>
        </div>
        {layout === 'by-day' ? (
          <label className={styles.dayFilter}>
            <span className={styles.dayFilterLabel}>Day</span>
            <select
              className={styles.select}
              value={scopeDayId}
              onChange={(e) => setScopeDayId(e.target.value)}
              aria-label="Filter photos by day"
            >
              <option value="">Every day</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {d.dayNumber} — {d.displayTitle}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className={styles.addButton} onClick={() => setUploadOpen((v) => !v)}>
          {uploadOpen ? 'Close upload' : 'Add photos'}
        </button>
      </div>

      {uploadOpen ? (
        <div className={styles.uploadPanel}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Day for new photos</span>
            <select className={styles.select} value={uploadDayId} onChange={(e) => setUploadDayId(e.target.value)}>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {d.dayNumber} — {d.displayTitle}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Images</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={onPickFiles}
            />
          </label>
          {pendingFiles.map((f, i) => (
            <div key={`${f.name}-${i}`} className={styles.fileRow}>
              <span className={styles.fileName}>{f.name}</span>
              <input
                className={styles.captionInput}
                placeholder="Caption (optional)"
                value={captions[i] ?? ''}
                onChange={(e) => {
                  const next = [...captions];
                  next[i] = e.target.value;
                  setCaptions(next);
                }}
              />
            </div>
          ))}
          {error ? <div className={styles.error}>{error}</div> : null}
          {progress ? <div className={styles.progress}>{progress}</div> : null}
          <div className={styles.uploadActions}>
            <button type="button" className={styles.submitUpload} disabled={uploading || !pendingFiles.length} onClick={() => runUpload().catch(console.error)}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      ) : null}

      {totalVisible === 0 ? (
        <div className={styles.empty} role="status">
          No photos yet. Add some from the journal or use Add photos here.
        </div>
      ) : (
        visibleSections.map((sec, idx) => (
          <div key={`${sec.title ?? 'all'}-${idx}`} className={styles.section}>
            {sec.title ? <h3 className={styles.sectionTitle}>{sec.title}</h3> : null}
            <div className={styles.grid}>
              {sec.items.map((p) => (
                <figure key={p.id} className={styles.cell}>
                  <button type="button" className={styles.thumbBtn} onClick={() => setLightboxUrl(p.fileUrl)} aria-label="View full size">
                    <img src={p.fileUrl} alt="" className={styles.thumb} loading="lazy" />
                  </button>
                  {p.caption?.trim() ? <figcaption className={styles.caption}>{p.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </div>
        ))
      )}

      {lightboxUrl ? <JournalImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} /> : null}
    </section>
  );
};
