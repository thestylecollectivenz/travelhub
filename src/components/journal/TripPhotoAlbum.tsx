import * as React from 'react';
import type { JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useJournalMediaSelection } from '../../context/JournalMediaSelectionContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { JournalEntryComposer } from './JournalEntryComposer';
import { JournalImageLightbox } from './JournalImageLightbox';
import { JournalPhotoBoard } from './JournalPhotoBoard';
import { TRAVELHUB_SCROLL_PHOTOS_DAY } from '../../utils/contentScroll';
import { formatDayPhotoSectionTitle } from '../../utils/formatDayHeadingLabel';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './TripPhotoAlbum.module.css';

function AlbumPhotoFooter({
  photo,
  canModerate
}: {
  photo: JournalPhoto;
  canModerate: boolean;
}): React.ReactElement {
  const { updatePhotoCaption, togglePhotoLike, deletePhoto } = useJournal();
  const spContext = useSpContext();
  const [editingCap, setEditingCap] = React.useState(false);
  const [capDraft, setCapDraft] = React.useState(photo.caption);

  React.useEffect(() => {
    setCapDraft(photo.caption);
  }, [photo.caption]);

  const liked = React.useMemo(() => {
    const users = (photo.likedByUsers ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const login = (spContext.pageContext.user.loginName ?? '').trim();
    return users.some((u) => u.toLowerCase() === login.toLowerCase());
  }, [photo.likedByUsers, spContext.pageContext.user.loginName]);

  return (
    <div className={styles.photoFooter}>
      <div className={styles.likeCell}>
        <button
          type="button"
          className={styles.heartBtn}
          onClick={() => togglePhotoLike(photo.id).catch(console.error)}
          aria-label="Like photo"
        >
          {liked ? '♥' : '♡'}
        </button>
        {photo.likeCount > 0 ? <span className={styles.likeCount}>{photo.likeCount}</span> : null}
      </div>
      <div className={styles.captionCell}>
        {editingCap ? (
          <>
            <input
              className={styles.captionInput}
              value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              aria-label="Caption"
            />
            <div className={styles.captionEditRow}>
              <button
                type="button"
                className={styles.captionActionBtn}
                onClick={() => {
                  updatePhotoCaption(photo.id, capDraft.trim())
                    .then(() => setEditingCap(false))
                    .catch(console.error);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className={styles.captionActionBtn}
                onClick={() => {
                  setCapDraft(photo.caption);
                  setEditingCap(false);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className={styles.captionView}>
            <span className={styles.caption}>{photo.caption?.trim() || '\u00a0'}</span>
            {canModerate ? (
              <button type="button" className={styles.captionEditBtn} aria-label="Edit caption" onClick={() => setEditingCap(true)}>
                ✎
              </button>
            ) : null}
          </div>
        )}
      </div>
      {canModerate ? (
        <button
          type="button"
          className={styles.deletePhotoBtn}
          onClick={() => {
            void (async () => {
              if (!(await confirmUserAction('Delete this photo?'))) return;
              deletePhoto(photo.id).catch(console.error);
            })();
          }}
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

type AlbumLayout = 'all' | 'by-day';

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

export const TripPhotoAlbum: React.FC = () => {
  const { allTripPhotos, allEntries, addAlbumPhoto, addPhoto } = useJournal();
  const { selectedPhotoId, setSelectedPhotoId, setSelectedEntryId } = useJournalMediaSelection();
  const { trip, tripDays, selectedDayId, sharedPreview } = useTripWorkspace();

  const [layout, setLayout] = React.useState<AlbumLayout>('all');
  const [scopeDayId, setScopeDayId] = React.useState<string>('');
  const [readFilter, setReadFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  const [photosLastSeenMaxId, setPhotosLastSeenMaxId] = React.useState<number>(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const [journalComposerOpen, setJournalComposerOpen] = React.useState(false);
  const [journalComposerDayId, setJournalComposerDayId] = React.useState('');
  const [photoPickerFocusKey, setPhotoPickerFocusKey] = React.useState(0);

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadDayId, setUploadDayId] = React.useState<string>('');
  const [uploadEntryId, setUploadEntryId] = React.useState<string>('');
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [captions, setCaptions] = React.useState<string[]>([]);
  const [pendingPreviews, setPendingPreviews] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!trip?.id) return;
    const key = `travelhub-photos-last-seen-id-${trip.id}`;
    const prev = Number(window.localStorage.getItem(key) || '0');
    setPhotosLastSeenMaxId(prev);
    const maxId = allTripPhotos.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    if (maxId > 0) window.localStorage.setItem(key, String(maxId));
  }, [trip?.id, allTripPhotos]);

  const isPhotoUnread = React.useCallback(
    (photo: JournalPhoto): boolean => {
      if (!photosLastSeenMaxId) return true;
      return (Number(photo.id) || 0) > photosLastSeenMaxId;
    },
    [photosLastSeenMaxId]
  );

  const days = React.useMemo(() => {
    if (!trip) return [];
    return tripDays.filter((d) => d.tripId === trip.id && d.dayType !== 'PreTrip').sort((a, b) => a.dayNumber - b.dayNumber);
  }, [trip, tripDays]);

  React.useEffect(() => {
    if (days.length > 0 && !uploadDayId) {
      setUploadDayId(days[0].id);
    }
  }, [days, uploadDayId]);

  const uploadEntriesForDay = React.useMemo(() => {
    if (!uploadDayId) return [];
    return allEntries
      .filter((e) => e.dayId === uploadDayId)
      .sort((a, b) => a.entryTimestamp.localeCompare(b.entryTimestamp));
  }, [allEntries, uploadDayId]);

  React.useEffect(() => {
    if (!uploadEntryId) return;
    if (!uploadEntriesForDay.some((e) => e.id === uploadEntryId)) {
      setUploadEntryId('');
    }
  }, [uploadEntriesForDay, uploadEntryId]);

  React.useEffect(() => {
    const onScrollDay = (ev: Event): void => {
      const dayId = (ev as CustomEvent<{ dayId?: string }>).detail?.dayId;
      if (!dayId) return;
      setLayout('by-day');
      setScopeDayId('');
      window.requestAnimationFrame(() => {
        document.getElementById(`photos-day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener(TRAVELHUB_SCROLL_PHOTOS_DAY, onScrollDay as EventListener);
    return () => window.removeEventListener(TRAVELHUB_SCROLL_PHOTOS_DAY, onScrollDay as EventListener);
  }, []);

  React.useEffect(() => {
    if (!selectedDayId) return;
    setLayout('by-day');
    window.requestAnimationFrame(() => {
      document.getElementById(`photos-day-${selectedDayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedDayId]);

  React.useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPendingPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pendingFiles]);

  const photos = allTripPhotos;

  const defaultJournalDayId = React.useCallback((): string => {
    if (!days.length) return '';
    const match = days.find((d) => d.id === selectedDayId);
    return match?.id ?? days[0].id;
  }, [days, selectedDayId]);

  const openJournalComposer = React.useCallback(() => {
    setJournalComposerDayId(defaultJournalDayId());
    setJournalComposerOpen(true);
    setPhotoPickerFocusKey((k) => k + 1);
  }, [defaultJournalDayId]);

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

  const filterPhotos = React.useCallback(
    (items: JournalPhoto[]): JournalPhoto[] => {
      if (readFilter === 'all') return items;
      return items.filter((p) => (readFilter === 'unread' ? isPhotoUnread(p) : !isPhotoUnread(p)));
    },
    [readFilter, isPhotoUnread]
  );

  const visibleSections = React.useMemo(() => {
    if (layout === 'all') {
      const items = filterPhotos(photos);
      return [{ title: null as string | null, dayId: undefined as string | undefined, items }];
    }
    if (scopeDayId) {
      const d = days.find((x) => x.id === scopeDayId);
      const items = filterPhotos(photos.filter((p) => p.dayId === scopeDayId));
      return [
        {
          title: d ? formatDayPhotoSectionTitle(d) : 'Photos',
          dayId: scopeDayId,
          items
        }
      ];
    }
    const sections: { title: string; dayId?: string; items: JournalPhoto[] }[] = [];
    for (const dayId of orderedDayIds) {
      const items = filterPhotos(grouped.get(dayId) ?? []);
      if (!items.length) continue;
      const d = days.find((x) => x.id === dayId);
      sections.push({
        title: d ? formatDayPhotoSectionTitle(d) : 'Photos',
        dayId,
        items
      });
    }
    return sections;
  }, [layout, scopeDayId, photos, grouped, orderedDayIds, days, filterPhotos]);

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
        if (uploadEntryId) {
          await addPhoto({
            journalEntryId: uploadEntryId,
            dayId: uploadDayId,
            file: pendingFiles[i],
            caption: cap
          });
        } else {
          await addAlbumPhoto(uploadDayId, pendingFiles[i], cap);
        }
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
  const lightboxPhotos = React.useMemo(() => {
    const merged: JournalPhoto[] = [];
    for (const sec of visibleSections) {
      merged.push(...sec.items);
    }
    return merged.map((p) => ({ url: p.fileUrl, caption: p.caption }));
  }, [visibleSections]);
  const selectedDayPhotosCount = React.useMemo(
    () => (selectedDayId ? photos.filter((p) => p.dayId === selectedDayId).length : 0),
    [photos, selectedDayId]
  );

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
                  {formatDayPhotoSectionTitle(d)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.readFilter} role="group" aria-label="Photo read status">
          <button
            type="button"
            className={`${styles.segmentButton} ${readFilter === 'all' ? styles.segmentActive : ''}`}
            onClick={() => setReadFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.segmentButton} ${readFilter === 'unread' ? styles.segmentActive : ''}`}
            onClick={() => setReadFilter('unread')}
          >
            Unread
          </button>
          <button
            type="button"
            className={`${styles.segmentButton} ${readFilter === 'read' ? styles.segmentActive : ''}`}
            onClick={() => setReadFilter('read')}
          >
            Read
          </button>
        </div>
        <div className={styles.toolbarEnd}>
          <button type="button" className={styles.addButton} onClick={() => setUploadOpen((v) => !v)}>
            {uploadOpen ? 'Close upload' : 'Add photos'}
          </button>
          {!sharedPreview && days.length > 0 ? (
            <button type="button" className={styles.secondaryButton} onClick={openJournalComposer}>
              New journal entry
            </button>
          ) : null}
        </div>
      </div>

      {journalComposerOpen && journalComposerDayId && !sharedPreview ? (
        <div className={styles.journalComposerWrap}>
          <label className={styles.journalComposerDay}>
            <span>Day for this entry</span>
            <select
              className={styles.select}
              value={journalComposerDayId}
              onChange={(e) => setJournalComposerDayId(e.target.value)}
              aria-label="Journal entry day"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayPhotoSectionTitle(d)}
                </option>
              ))}
            </select>
          </label>
          <JournalEntryComposer
            dayId={journalComposerDayId}
            focusPhotoPickerKey={photoPickerFocusKey}
            onCancel={() => setJournalComposerOpen(false)}
            onSaved={() => setJournalComposerOpen(false)}
          />
        </div>
      ) : null}

      {uploadOpen ? (
        <div className={styles.uploadPanel}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Day for new photos</span>
            <select
              className={styles.select}
              value={uploadDayId}
              onChange={(e) => {
                setUploadDayId(e.target.value);
                setUploadEntryId('');
              }}
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayPhotoSectionTitle(d)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Journal entry (optional)</span>
            <select className={styles.select} value={uploadEntryId} onChange={(e) => setUploadEntryId(e.target.value)}>
              <option value="">Album only — assign later</option>
              {uploadEntriesForDay.map((e, i) => (
                <option key={e.id} value={e.id}>
                  Entry {i + 1} — {new Date(e.entryTimestamp).toLocaleString()}
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
              {pendingPreviews[i] ? (
                <img className={styles.filePreview} src={pendingPreviews[i]} alt="" />
              ) : (
                <span className={styles.filePreviewPlaceholder} aria-hidden />
              )}
              <div className={styles.fileRowMain}>
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

      {selectedDayId && layout === 'by-day' && scopeDayId === selectedDayId && selectedDayPhotosCount === 0 && !journalComposerOpen && !uploadOpen ? (
        <div className={styles.empty} role="status">
          No photos for the selected day yet.
        </div>
      ) : totalVisible === 0 && !journalComposerOpen && !uploadOpen ? (
        <div className={styles.empty} role="status">
          No photos yet. Add some from the journal or use Add photos here.
        </div>
      ) : totalVisible > 0 ? (
        visibleSections.map((sec, idx) => (
          <div
            key={`${sec.title ?? 'all'}-${idx}`}
            id={'dayId' in sec && sec.dayId ? `photos-day-${sec.dayId}` : undefined}
            className={styles.section}
          >
            {sec.title ? <h3 className={styles.sectionTitle}>{sec.title}</h3> : null}
            <JournalPhotoBoard
              photos={sec.items}
              selectedPhotoId={selectedPhotoId}
              onSelectPhoto={(id) => {
                setSelectedPhotoId(id);
                const match = sec.items.find((p) => p.id === id);
                setSelectedEntryId(match?.journalEntryId?.trim() ? match.journalEntryId : null);
              }}
              onOpenLightbox={(url) => {
                const idx = lightboxPhotos.findIndex((p) => p.url === url);
                setLightboxIndex(idx >= 0 ? idx : 0);
              }}
              draggable={!sharedPreview}
              renderFooter={(p) => <AlbumPhotoFooter photo={p} canModerate={!sharedPreview} />}
            />
          </div>
        ))
      ) : null}

      {lightboxIndex !== null ? (
        <JournalImageLightbox
          items={lightboxPhotos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
};
