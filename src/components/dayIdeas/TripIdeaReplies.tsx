import * as React from 'react';
import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { TripMember } from '../../models/TripMember';
import type { TripReminder } from '../../services/ReminderService';
import { ReminderService } from '../../services/ReminderService';
import { confirmUserAction } from '../../utils/confirmAction';
import { getCurrentUserEmail } from '../../utils/currentUserEmail';
import {
  canManageDayIdeaReply,
  dayIdeaReplies,
  formatDayIdeaReplyAuthor,
  formatDayIdeaStamp,
  isDayIdeaReminder,
  parseDayIdeaMeta,
  withDayIdeaReplyAdded,
  withDayIdeaReplyRemoved
} from '../../utils/dayIdeas';
import {
  isJotterIdeaReminder,
  jotterIdeaReplies,
  parseJotterIdeaMeta,
  withJotterReplyAdded,
  withJotterReplyRemoved
} from '../../utils/tripJotterIdeas';
import { notifyDayIdeasChanged } from '../../hooks/useTripDayIdeas';
import { JOTTER_IDEAS_CHANGED_EVENT } from '../../utils/tripJotterIdeas';
import { notifyTripIdeasChanged } from '../../utils/tripIdeasUnified';
import styles from './DayIdeaReplies.module.css';

export interface TripIdeaRepliesProps {
  row: TripReminder;
  spContext: WebPartContext;
  members?: TripMember[];
  canContribute: boolean;
  canEditItinerary: boolean;
  onUpdated?: () => void;
  compact?: boolean;
}

function notifyAll(): void {
  notifyDayIdeasChanged();
  window.dispatchEvent(new Event(JOTTER_IDEAS_CHANGED_EVENT));
  notifyTripIdeasChanged();
}

export const TripIdeaReplies: React.FC<TripIdeaRepliesProps> = ({
  row,
  spContext,
  members,
  canContribute,
  canEditItinerary,
  onUpdated,
  compact = false
}) => {
  const isJotter = isJotterIdeaReminder(row);
  const replies = isJotter
    ? jotterIdeaReplies(parseJotterIdeaMeta(row.taskNote))
    : isDayIdeaReminder(row)
      ? dayIdeaReplies(parseDayIdeaMeta(row.taskNote))
      : [];
  const [open, setOpen] = React.useState(replies.length > 0);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (replies.length) setOpen(true);
  }, [replies.length, row.id]);

  const postReply = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || !canContribute) return;
    setBusy(true);
    try {
      const svc = new ReminderService(spContext);
      const patch = isJotter
        ? withJotterReplyAdded(row, text, getCurrentUserEmail(spContext))
        : withDayIdeaReplyAdded(row, text, getCurrentUserEmail(spContext));
      await svc.update(row.id, patch);
      setDraft('');
      onUpdated?.();
      notifyAll();
    } finally {
      setBusy(false);
    }
  };

  const deleteReply = async (replyId: string): Promise<void> => {
    if (!(await confirmUserAction('Delete this reply?'))) return;
    const svc = new ReminderService(spContext);
    const patch = isJotter ? withJotterReplyRemoved(row, replyId) : withDayIdeaReplyRemoved(row, replyId);
    await svc.update(row.id, patch);
    onUpdated?.();
    notifyAll();
  };

  const rootClass = compact ? `${styles.root} ${styles.compact}` : styles.root;

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          {replies.length ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'No replies'}
        </span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className={styles.body}>
          {replies.length ? (
            <ul className={styles.list}>
              {replies.map((reply) => {
                const author = formatDayIdeaReplyAuthor(reply, members);
                const manageable = canManageDayIdeaReply(reply, spContext, members, canEditItinerary);
                return (
                  <li key={reply.id} className={styles.reply}>
                    <p className={styles.replyText}>{reply.text}</p>
                    <div className={styles.replyMeta}>
                      <span>
                        {author} · {formatDayIdeaStamp(reply.createdAt)}
                      </span>
                      {manageable ? (
                        <button type="button" className={styles.replyDelete} onClick={() => void deleteReply(reply.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>No replies yet.</p>
          )}
          {canContribute ? (
            <div className={styles.addRow}>
              <textarea
                className={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply or add more detail…"
                rows={2}
                aria-label="Reply to idea"
              />
              <button type="button" className={styles.addBtn} disabled={busy || !draft.trim()} onClick={() => void postReply()}>
                Reply
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
