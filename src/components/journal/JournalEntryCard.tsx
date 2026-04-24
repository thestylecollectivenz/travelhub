import * as React from 'react';
import type { JournalComment, JournalEntry, JournalPhoto } from '../../models';
import { useJournal } from '../../context/JournalContext';
import { useSpContext } from '../../context/SpContext';
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

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry, photos, canModerate = true }) => {
  const spContext = useSpContext();
  const {
    updateEntry,
    deleteEntry,
    toggleLike,
    commentsForEntry,
    loadCommentsForEntry,
    addComment,
    deleteComment
  } = useJournal();

  const displayName = spContext.pageContext.user.displayName ?? '';
  const isOwner = entry.authorName === displayName;
  const showMenu = canModerate || isOwner;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState(entry.entryText);
  const [draftLocation, setDraftLocation] = React.useState(entry.location);

  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState('');

  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraftText(entry.entryText);
    setDraftLocation(entry.location);
  }, [entry.entryText, entry.location]);

  React.useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  const comments: JournalComment[] = commentsForEntry(entry.id);

  const openComments = async (): Promise<void> => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (!next) return;
    setCommentsLoading(true);
    try {
      await loadCommentsForEntry(entry.id);
    } finally {
      setCommentsLoading(false);
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
          <div className={styles.author}>{entry.authorName || 'Traveller'}</div>
          <div className={styles.timestamp}>{formatTimestamp(entry.entryTimestamp)}</div>
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
          <textarea className={styles.textarea} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
          <input className={styles.input} value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Location" />
          <div className={styles.editActions}>
            <button type="button" className={styles.iconButton} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                updateEntry(entry.id, { entryText: draftText, location: draftLocation })
                  .then(() => setEditing(false))
                  .catch(console.error);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.text}>{entry.entryText}</div>
      )}

      {photos.length ? (
        <div className={styles.photoGrid}>
          {photos.map((p) => (
            <img
              key={p.id}
              className={styles.photoThumb}
              src={p.fileUrl}
              alt={p.caption ? p.caption : ''}
              loading="lazy"
              onClick={() => setLightboxUrl(p.fileUrl)}
            />
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
          💬 {commentsOpen ? 'Hide' : 'Comments'}
          <span aria-hidden>·</span>
          <span>{comments.length}</span>
        </button>

        <button type="button" className={styles.iconButton} aria-label="Share (coming next)" disabled title="Sharing options arrive in P4-3">
          <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden>
            <path d="M4 10V6l8-3v8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="4" cy="10" r="1.6" fill="currentColor" />
            <circle cx="12" cy="5" r="1.6" fill="currentColor" />
            <circle cx="12" cy="11" r="1.6" fill="currentColor" />
          </svg>
          Share
        </button>
      </div>

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

      {lightboxUrl ? (
        <button
          type="button"
          className={styles.lightbox}
          onClick={() => setLightboxUrl(null)}
          aria-label="Close image preview"
        >
          <img className={styles.lightboxImg} src={lightboxUrl} alt="" />
        </button>
      ) : null}
    </article>
  );
};
