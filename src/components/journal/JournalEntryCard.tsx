import * as React from 'react';
import type { JournalComment, JournalEntry, JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useConfig } from '../../context/ConfigContext';
import { JournalImageLightbox } from './JournalImageLightbox';
import { RichTextEditor } from './RichTextEditor';
import { isLikelyJournalHtml, plainTextToEditorHtml } from '../../utils/journalRichText';
import styles from './JournalEntryCard.module.css';

export interface JournalEntryCardProps {
  entry: JournalEntry;
  photos: JournalPhoto[];
  /** Temporary: treat all workspace viewers as authorised editors for journal moderation. */
  canModerate?: boolean;
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

function JournalPhotoSlot({
  photo,
  onOpenLightbox
}: {
  photo: JournalPhoto;
  onOpenLightbox: (url: string) => void;
}): React.ReactElement {
  const { updatePhotoCaption, togglePhotoLike } = useJournal();
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
    <div className={styles.photoCard}>
      <figure className={styles.photoFigure}>
        <img
          className={styles.photoThumb}
          src={photo.fileUrl}
          alt={photo.caption ? photo.caption : ''}
          loading="lazy"
          onClick={() => onOpenLightbox(photo.fileUrl)}
        />
        <div className={styles.photoHeartWrap}>
          <button
            type="button"
            className={styles.photoHeartBtn}
            onClick={() => togglePhotoLike(photo.id).catch(console.error)}
            aria-label="Like photo"
          >
            {liked ? (
              <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden>
                <path
                  d="M3.2 3.6c0-1.1.9-2 2-2 1 0 1.8.6 2.1 1.4.3-.8 1.1-1.4 2.1-1.4 1.1 0 2 .9 2 2 0 2.4-3.5 5.6-4.1 6.1-.1.1-.3.1-.4 0-.6-.5-4.1-3.7-4.1-6.1Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden>
                <path
                  d="M3.2 3.6c0-1.1.9-2 2-2 1 0 1.8.6 2.1 1.4.3-.8 1.1-1.4 2.1-1.4 1.1 0 2 .9 2 2 0 2.4-3.5 5.6-4.1 6.1-.1.1-.3.1-.4 0-.6-.5-4.1-3.7-4.1-6.1Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {photo.likeCount > 0 ? <span className={styles.photoLikeCount}>{photo.likeCount}</span> : null}
        </div>
      </figure>
      <div className={styles.photoCaptionRow}>
        {editingCap ? (
          <>
            <input
              className={styles.photoCaptionInput}
              value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              aria-label="Caption"
            />
            <button
              type="button"
              className={styles.iconButton}
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
              className={styles.iconButton}
              onClick={() => {
                setCapDraft(photo.caption);
                setEditingCap(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className={styles.photoCaption}>{photo.caption?.trim() || '\u00a0'}</span>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.photoCaptionEdit}`}
              aria-label="Edit caption"
              onClick={() => setEditingCap(true)}
            >
              ✎
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry, photos, canModerate = true }) => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { journalAuthorName } = useConfig();
  const {
    updateEntry,
    deleteEntry,
    toggleLike,
    commentsForEntry,
    loadCommentsForEntry,
    addComment,
    deleteComment,
    ensureShareableLink,
    commentCountForEntry
  } = useJournal();

  const displayName = spContext.pageContext.user.displayName ?? '';
  const isOwner = entry.authorName === journalAuthorName || entry.authorName === displayName;
  const showMenu = canModerate || isOwner;
  const showAuthorLine = trip?.showAuthorName !== false;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draftHtml, setDraftHtml] = React.useState(() => plainTextToEditorHtml(entry.entryText));
  const [draftLocation, setDraftLocation] = React.useState(entry.location);

  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentsLoaded, setCommentsLoaded] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState('');

  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string>('');
  const [shareBusy, setShareBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<number | undefined>(undefined);

  const webShareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  React.useEffect(() => {
    setDraftHtml(isLikelyJournalHtml(entry.entryText) ? entry.entryText : plainTextToEditorHtml(entry.entryText));
    setDraftLocation(entry.location);
  }, [entry.entryText, entry.location]);

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

  return (
    <article className={styles.card}>
      <div className={styles.metaRow}>
        <div>
          {showAuthorLine ? (
            <>
              <div className={styles.author}>{entry.authorName || 'Traveller'}</div>
              <div className={styles.timestamp}>{formatTimestamp(entry.entryTimestamp)}</div>
            </>
          ) : (
            <div className={styles.timestamp}>{formatTimestamp(entry.entryTimestamp)}</div>
          )}
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
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuDanger}`}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    deleteEntry(entry.id).catch(console.error);
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

      {photos.length ? (
        <div className={styles.photoGrid}>
          {photos.map((p) => (
            <JournalPhotoSlot key={p.id} photo={p} onOpenLightbox={setLightboxUrl} />
          ))}
        </div>
      ) : null}

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
                rel="noreferrer"
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
                <button type="button" className={styles.iconButton} onClick={() => deleteComment(entry.id, c.id).catch(console.error)}>
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

      {lightboxUrl ? <JournalImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} /> : null}
    </article>
  );
};
