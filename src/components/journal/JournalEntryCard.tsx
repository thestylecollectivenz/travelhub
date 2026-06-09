import * as React from 'react';
import type { JournalComment, JournalEntry, JournalPhoto } from '../../models';
import type { TripDay } from '../../models/TripDay';
import { useJournal } from '../../context/JournalContext';
import { useJournalMediaSelection } from '../../context/JournalMediaSelectionContext';
import { confirmUserAction } from '../../utils/confirmAction';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { JournalImageLightbox } from './JournalImageLightbox';
import { JournalPhotoBoard } from './JournalPhotoBoard';
import { JournalPhotoCaptionFooter } from './JournalPhotoCaptionFooter';
import { RichTextEditor } from './RichTextEditor';
import { isLikelyJournalHtml, plainTextToEditorHtml } from '../../utils/journalRichText';
import { readJournalPhotoDragData } from '../../utils/journalPhotoDrag';
import { formatOrdinalDayDate } from '../../utils/formatTripDayDate';
import styles from './JournalEntryCard.module.css';

function isAllowedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
  const okMime = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === '';
  return okExt && okMime;
}

export interface JournalEntryCardProps {
  entry: JournalEntry;
  photos: JournalPhoto[];
  journalDays?: TripDay[];
  /** Temporary: treat all workspace viewers as authorised editors for journal moderation. */
  canModerate?: boolean;
  isUnread?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  photos,
  journalDays = [],
  canModerate = true,
  isUnread,
  dragHandleProps
}) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { journalAuthorName } = useConfig();
  const {
    updateEntry,
    deleteEntry,
    moveEntryToDay,
    addPhoto,
    assignPhotoToEntry,
    toggleLike,
    commentsForEntry,
    loadCommentsForEntry,
    addComment,
    deleteComment,
    ensureShareableLink,
    commentCountForEntry
  } = useJournal();
  const { selectedPhotoId, setSelectedPhotoId, setSelectedEntryId } = useJournalMediaSelection();

  const displayName = spContext.pageContext.user.displayName ?? '';
  const isOwner = entry.authorName === journalAuthorName || entry.authorName === displayName;
  const showMenu = canModerate || isOwner;
  const showAuthorLine = trip?.showAuthorName !== false;
  const showEntryTimestamp = trip?.showJournalEntryDate !== false;
  const entryDay = journalDays.find((d) => d.id === entry.dayId);
  const dateLabel = showEntryTimestamp
    ? formatTimestamp(entry.entryTimestamp)
    : entryDay?.calendarDate
      ? formatOrdinalDayDate(entryDay.calendarDate)
      : null;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draftHtml, setDraftHtml] = React.useState(() => plainTextToEditorHtml(entry.entryText));
  const [draftLocation, setDraftLocation] = React.useState(entry.location);

  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentsLoaded, setCommentsLoaded] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState('');

  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const lightboxItems = React.useMemo(
    () => photos.map((p) => ({ url: p.fileUrl, caption: p.caption })),
    [photos]
  );
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string>('');
  const [shareBusy, setShareBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [dropActive, setDropActive] = React.useState(false);
  const [moveDayId, setMoveDayId] = React.useState(entry.dayId);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const copyTimerRef = React.useRef<number | undefined>(undefined);

  const webShareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  React.useEffect(() => {
    setDraftHtml(isLikelyJournalHtml(entry.entryText) ? entry.entryText : plainTextToEditorHtml(entry.entryText));
    setDraftLocation(entry.location);
    setMoveDayId(entry.dayId);
  }, [entry.entryText, entry.location, entry.dayId]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const comments: JournalComment[] = commentsForEntry(entry.id);
  const commentCountDisplay = commentsOpen && commentsLoaded ? comments.length : commentCountForEntry(entry.id);
  const commentButtonLabel =
    commentCountDisplay === 0
      ? 'Comments'
      : commentCountDisplay === 1
        ? '1 comment'
        : `${commentCountDisplay} comments`;

  const openComments = async (): Promise<void> => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (!next) return;
    setCommentsLoading(true);
    try {
      await loadCommentsForEntry(entry.id);
      setCommentsLoaded(true);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openShare = async (): Promise<void> => {
    const next = !shareOpen;
    setShareOpen(next);
    setCopied(false);
    if (!next) return;
    setShareBusy(true);
    try {
      const existing = entry.shareableLink?.trim() ?? '';
      const url = existing || (await ensureShareableLink(entry.id));
      setShareUrl(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('JournalEntryCard.openShare', err);
      setShareUrl('');
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('JournalEntryCard.copyShareLink', err);
    }
  };

  const liked = React.useMemo(() => {
    const users = (entry.likedByUsers ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const login = (spContext.pageContext.user.loginName ?? '').trim();
    return users.some((u) => u.toLowerCase() === login.toLowerCase());
  }, [entry.likedByUsers, spContext.pageContext.user.loginName]);

  const onPhotoFiles = async (files: FileList | File[]): Promise<void> => {
    const list = Array.from(files);
    if (!list.length) return;
    setPhotoUploading(true);
    try {
      for (const file of list) {
        if (!isAllowedImage(file) || file.size > 10 * 1024 * 1024) continue;
        // eslint-disable-next-line no-await-in-loop
        await addPhoto({ journalEntryId: entry.id, dayId: entry.dayId, file });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('JournalEntryCard.onPhotoFiles', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const onPhotoDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDropActive(false);
    const photoId = readJournalPhotoDragData(e.dataTransfer);
    if (photoId) {
      const dragged = photos.find((p) => p.id === photoId);
      if (dragged?.journalEntryId === entry.id) {
        return;
      }
      assignPhotoToEntry(photoId, entry.dayId, entry.id).catch(console.error);
      return;
    }
    if (e.dataTransfer.files?.length) {
      onPhotoFiles(e.dataTransfer.files).catch(console.error);
    }
  };

  return (
    <div
      className={`${styles.card} ${isUnread ? styles.cardUnread : ''} ${dropActive ? styles.cardDropActive : ''}`}
      data-journal-id={entry.id}
      onDragOver={(e) => {
        if (!canModerate) return;
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={canModerate ? onPhotoDrop : undefined}
    >
      <div className={styles.metaRow}>
        {dragHandleProps ? (
          <button
            type="button"
            className={styles.dragHandle}
            aria-label="Drag to reorder or move entry"
            title="Drag to reorder"
            {...dragHandleProps}
          >
            ⋮⋮
          </button>
        ) : null}
        <div className={styles.metaMain}>
          {isUnread ? <span className={styles.unreadBadge}>New</span> : null}
          {showAuthorLine ? <div className={styles.author}>{entry.authorName || 'Traveller'}</div> : null}
          {dateLabel ? <div className={styles.timestamp}>{dateLabel}</div> : null}
        </div>
        {showMenu ? (
          <div className={styles.menuWrap}>
            <button type="button" className={styles.menuButton} aria-label="Entry actions" onClick={() => setMenuOpen((v) => !v)}>
              ⋯
            </button>
            {menuOpen ? (
              <div className={styles.menu} role="menu">
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
                {journalDays.length > 1 ? (
                  <div className={styles.menuMoveRow} role="none">
                    <label className={styles.menuMoveLabel}>
                      Move to day
                      <select
                        className={styles.menuMoveSelect}
                        value={moveDayId}
                        onChange={(e) => setMoveDayId(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {journalDays.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.dayType === 'PreTrip' ? 'Pre-trip' : `Day ${d.dayNumber}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className={styles.menuItem}
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        if (moveDayId && moveDayId !== entry.dayId) {
                          moveEntryToDay(entry.id, moveDayId).catch(console.error);
                        }
                      }}
                    >
                      Apply move
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuDanger}`}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void (async () => {
                      if (!(await confirmUserAction('Delete this journal entry? Photos and comments will be removed.'))) return;
                      deleteEntry(entry.id).catch(console.error);
                    })();
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {entry.location?.trim() ? <div className={styles.location}>📍 {entry.location}</div> : null}

      {editing ? (
        <div className={styles.editForm}>
          <RichTextEditor value={draftHtml} onChange={setDraftHtml} />
          <input className={styles.input} value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Location" />
          <div className={styles.editActions}>
            <button type="button" className={styles.iconButton} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                updateEntry(entry.id, { entryText: draftHtml, location: draftLocation })
                  .then(() => setEditing(false))
                  .catch(console.error);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : isLikelyJournalHtml(entry.entryText) ? (
        <div className={styles.richText} dangerouslySetInnerHTML={{ __html: entry.entryText }} />
      ) : (
        <div className={styles.text}>{entry.entryText}</div>
      )}

      {canModerate ? (
        <div className={styles.addPhotosRow}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            className={styles.hiddenFileInput}
            onChange={(e) => {
              if (e.target.files?.length) {
                onPhotoFiles(e.target.files).catch(console.error);
              }
              e.target.value = '';
            }}
          />
          <button type="button" className={styles.addPhotosBtn} disabled={photoUploading} onClick={() => photoInputRef.current?.click()}>
            {photoUploading ? 'Uploading…' : 'Add photos'}
          </button>
          <span className={styles.dropHint}>or drop photos here</span>
        </div>
      ) : null}

      <JournalPhotoBoard
        photos={photos}
        selectedPhotoId={selectedPhotoId}
        onSelectPhoto={(id) => {
          setSelectedPhotoId(id);
          setSelectedEntryId(entry.id);
        }}
        onOpenLightbox={(url) => {
          const idx = photos.findIndex((p) => p.fileUrl === url);
          setLightboxIndex(idx >= 0 ? idx : 0);
        }}
        draggable={canModerate}
        sortable={canModerate}
        sortableEntryId={entry.id}
        footerOptional
        renderFooter={(p) => <JournalPhotoCaptionFooter photo={p} canModerate={canModerate} />}
      />

      <div className={styles.actionsRow}>
        <button type="button" className={styles.iconButton} onClick={() => toggleLike(entry.id).catch(console.error)} aria-label="Like">
          {liked ? (
            <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
              <path
                d="M3.2 3.6c0-1.1.9-2 2-2 1 0 1.8.6 2.1 1.4.3-.8 1.1-1.4 2.1-1.4 1.1 0 2 .9 2 2 0 2.4-3.5 5.6-4.1 6.1-.1.1-.3.1-.4 0-.6-.5-4.1-3.7-4.1-6.1Z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
              <path
                d="M3.2 3.6c0-1.1.9-2 2-2 1 0 1.8.6 2.1 1.4.3-.8 1.1-1.4 2.1-1.4 1.1 0 2 .9 2 2 0 2.4-3.5 5.6-4.1 6.1-.1.1-.3.1-.4 0-.6-.5-4.1-3.7-4.1-6.1Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{entry.likeCount}</span>
        </button>

        <button type="button" className={styles.iconButton} onClick={() => openComments().catch(console.error)}>
          💬 {commentsOpen ? 'Hide' : commentButtonLabel}
        </button>

        <button type="button" className={styles.iconButton} onClick={() => openShare().catch(console.error)} aria-expanded={shareOpen}>
          <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
            <path d="M4 10V6l8-3v8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="4" cy="10" r="1.6" fill="currentColor" />
            <circle cx="12" cy="5" r="1.6" fill="currentColor" />
            <circle cx="12" cy="11" r="1.6" fill="currentColor" />
          </svg>
          Share
        </button>
      </div>

      {shareOpen ? (
        <div className={styles.sharePanel} role="region" aria-label="Share journal entry">
          {shareBusy ? <div className={styles.timestamp}>Preparing link…</div> : null}
          {!shareBusy && shareUrl ? (
            <div className={styles.shareRow}>
              <button type="button" className={styles.shareAction} onClick={() => copyShareLink().catch(console.error)}>
                <span className={styles.shareIconBtn} aria-hidden>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                    <path
                      d="M10 13a5 5 0 0 1 5-5h1M15 8l2-2m0 0l2 2m-2-2v6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M8 11H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={copied ? `${styles.shareActionLabel} ${styles.shareActionLabelCopied}` : styles.shareActionLabel}>
                  {copied ? 'Copied!' : 'Copy link'}
                </span>
              </button>
              <a
                className={styles.shareAction}
                href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.shareIconBtn} aria-hidden>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                    <path
                      d="M12 3C7 3 3 6.8 3 11.4c0 2 .9 3.8 2.4 5.1L3 21l4.7-2.3c1.3.7 2.8 1.1 4.3 1.1 5 0 9-3.8 9-8.4S17 3 12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <path d="M9 10h.01M12 10h.01M15 10h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={styles.shareActionLabel}>WhatsApp</span>
              </a>
              <a
                className={styles.shareAction}
                href={`mailto:?subject=${encodeURIComponent('Travel Journal')}&body=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.shareIconBtn} aria-hidden>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className={styles.shareActionLabel}>Email</span>
              </a>
              {webShareSupported ? (
                <button
                  type="button"
                  className={styles.shareAction}
                  onClick={() => {
                    navigator
                      .share({ title: 'Travel journal entry', url: shareUrl })
                      .catch((err) => console.error('navigator.share', err));
                  }}
                >
                  <span className={styles.shareIconBtn} aria-hidden>
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                      <circle cx="18" cy="5" r="2.5" fill="currentColor" />
                      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
                      <circle cx="18" cy="19" r="2.5" fill="currentColor" />
                      <path d="M8 11l8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className={styles.shareActionLabel}>Share</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {!shareBusy && !shareUrl ? <div className={styles.timestamp}>Could not generate a share link.</div> : null}
        </div>
      ) : null}

      {commentsOpen ? (
        <div className={styles.comments}>
          {commentsLoading ? <div className={styles.timestamp}>Loading comments…</div> : null}
          {comments.map((c) => (
            <div key={c.id} className={styles.commentRow}>
              <div className={styles.commentMeta}>
                <span>{c.authorName}</span>
                <span>{formatTimestamp(c.commentTimestamp)}</span>
              </div>
              <div className={styles.commentText}>{c.commentText}</div>
              {c.authorName === displayName ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => {
                    void (async () => {
                      if (!(await confirmUserAction('Delete this comment?'))) return;
                      deleteComment(entry.id, c.id).catch(console.error);
                    })();
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
          <div className={styles.commentComposer}>
            <input
              className={styles.commentInput}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment…"
            />
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                const t = commentDraft.trim();
                if (!t) return;
                addComment(entry.id, t)
                  .then(() => setCommentDraft(''))
                  .catch(console.error);
              }}
            >
              Post
            </button>
          </div>
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <JournalImageLightbox
          items={lightboxItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
};
