import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { usePlaces } from '../../context/PlacesContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripRole } from '../../context/TripRoleContext';
import { useTripPermissions } from '../../hooks/useTripPermissions';
import { ReminderService } from '../../services/ReminderService';
import { TravellerAvatar } from '../shared/TravellerAvatar';
import { TripIdeaReplies } from '../dayIdeas/TripIdeaReplies';
import { confirmUserAction } from '../../utils/confirmAction';
import {
  createJotterIdea,
  deleteJotterIdea,
  isJotterIdeaReminder,
  JOTTER_IDEAS_CHANGED_EVENT,
  setJotterIdeaComplete,
  updateJotterIdeaText
} from '../../utils/tripJotterIdeas';
import { notifyDayIdeasChanged } from '../../hooks/useTripDayIdeas';
import {
  formatIdeaTime,
  isIdeaRecentlyAdded,
  isUnifiedIdeaYours,
  loadUnifiedTripIdeas,
  matchesTripIdeasFilter,
  notifyTripIdeasChanged,
  TRIP_IDEAS_CHANGED_EVENT,
  type TripIdeasFilter,
  type UnifiedTripIdea
} from '../../utils/tripIdeasUnified';
import { MOBILE_OPEN_JOTTER_COMPOSE } from '../../utils/mobileHomePendingAction';
import { consumePendingJotterCompose } from '../../utils/mobileHomePendingAction';
import chrome from './MobileTabChrome.module.css';
import styles from './MobileTripIdeasTab.module.css';

type SortOrder = 'newest' | 'oldest';

function memberForIdea(
  idea: UnifiedTripIdea,
  members: ReturnType<typeof useTripMembers>['members']
): { name: string; avatarUrl?: string } {
  if (idea.isAi) return { name: 'AI suggestion' };
  const email = (idea.authorEmail || '').trim().toLowerCase();
  const match = members.find((m) => m.userEmail.trim().toLowerCase() === email);
  if (match) {
    return { name: match.userDisplayName || match.userEmail, avatarUrl: match.avatarUrl };
  }
  return { name: idea.authorLabel || 'Traveller' };
}

export const MobileTripJotterList: React.FC = () => {
  const spContext = useSpContext();
  const { trip, tripDays, localEntries } = useTripWorkspace();
  const { placeById } = usePlaces();
  const { members } = useTripMembers(trip?.id);
  const { role } = useTripRole();
  const { canEditItinerary } = useTripPermissions();
  const [rows, setRows] = React.useState<UnifiedTripIdea[]>([]);
  const [filter, setFilter] = React.useState<TripIdeasFilter>('all');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortOrder>('newest');
  const [draft, setDraft] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [howOpen, setHowOpen] = React.useState(false);
  const [composeError, setComposeError] = React.useState('');

  const canContribute = role === 'Editor' || role === 'Companion';

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!trip?.id) {
      setRows([]);
      return;
    }
    const all = await loadUnifiedTripIdeas(
      spContext,
      trip.id,
      tripDays,
      placeById,
      trip.destination,
      localEntries
    );
    setRows(all);
  }, [trip?.id, trip?.destination, tripDays, spContext, placeById, localEntries]);

  React.useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  React.useEffect(() => {
    const handler = (): void => {
      void refresh().catch(console.error);
    };
    window.addEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
    window.addEventListener(TRIP_IDEAS_CHANGED_EVENT, handler);
    window.addEventListener('travelhub-day-ideas-changed', handler);
    return () => {
      window.removeEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
      window.removeEventListener(TRIP_IDEAS_CHANGED_EVENT, handler);
      window.removeEventListener('travelhub-day-ideas-changed', handler);
    };
  }, [refresh]);

  React.useEffect(() => {
    const openCompose = (): void => setComposeOpen(true);
    if (consumePendingJotterCompose()) setComposeOpen(true);
    window.addEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openCompose);
    return () => window.removeEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openCompose);
  }, []);

  React.useEffect(() => {
    if (!menuId) return;
    const close = (): void => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuId]);

  const counts = React.useMemo(() => {
    const open = rows.filter((r) => !r.isComplete);
    return {
      all: open.length,
      yours: open.filter((r) => isUnifiedIdeaYours(r, spContext, members)).length,
      ai: open.filter((r) => r.isAi).length,
      replies: open.filter((r) => r.replyCount > 0).length,
      complete: rows.filter((r) => r.isComplete).length
    };
  }, [rows, spContext, members]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => matchesTripIdeasFilter(r, filter, spContext, members));
    if (q) {
      list = list.filter(
        (r) =>
          r.text.toLowerCase().includes(q) ||
          (r.locationLabel || '').toLowerCase().includes(q) ||
          (r.authorLabel || '').toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
      return sort === 'newest' ? -cmp : cmp;
    });
    return list;
  }, [rows, filter, search, sort, spContext, members]);

  const addIdea = async (): Promise<void> => {
    const text = draft.trim();
    if (!trip?.id || !text || busy) return;
    setComposeError('');
    setBusy(true);
    try {
      await createJotterIdea(spContext, trip.id, text, members, false);
      setDraft('');
      setComposeOpen(false);
      await refresh();
      notifyTripIdeasChanged();
    } catch (err) {
      setComposeError('Ideas need at least 8 characters of real text.');
      // eslint-disable-next-line no-console
      console.error('MobileTripIdeasTab: add failed', err);
    } finally {
      setBusy(false);
    }
  };

  const toggleComplete = async (idea: UnifiedTripIdea): Promise<void> => {
    const svc = new ReminderService(spContext);
    if (idea.source === 'jotter' || isJotterIdeaReminder(idea.reminder)) {
      await setJotterIdeaComplete(spContext, idea.id, !idea.isComplete);
    } else {
      await svc.update(idea.id, { isComplete: !idea.isComplete });
      notifyDayIdeasChanged();
    }
    await refresh();
    notifyTripIdeasChanged();
  };

  const deleteIdea = async (idea: UnifiedTripIdea): Promise<void> => {
    if (!(await confirmUserAction('Delete this idea?'))) return;
    if (idea.source === 'jotter' || isJotterIdeaReminder(idea.reminder)) {
      await deleteJotterIdea(spContext, idea.id);
    } else {
      const svc = new ReminderService(spContext);
      await svc.delete(idea.id);
      notifyDayIdeasChanged();
    }
    await refresh();
    notifyTripIdeasChanged();
  };

  const saveEdit = async (idea: UnifiedTripIdea): Promise<void> => {
    const text = editText.trim();
    if (!text) return;
    if (idea.source === 'jotter' || isJotterIdeaReminder(idea.reminder)) {
      await updateJotterIdeaText(spContext, idea.id, text);
    } else {
      const svc = new ReminderService(spContext);
      await svc.update(idea.id, { title: text, reminderText: text });
      notifyDayIdeasChanged();
    }
    setEditingId(null);
    setEditText('');
    await refresh();
    notifyTripIdeasChanged();
  };

  const shareIdea = async (idea: UnifiedTripIdea): Promise<void> => {
    const text = idea.text;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* ignore */
    }
    setMenuId(null);
  };

  const canManage = (idea: UnifiedTripIdea): boolean => {
    if (canEditItinerary) return true;
    if (idea.isAi) return false;
    return isUnifiedIdeaYours(idea, spContext, members);
  };

  if (!canContribute) {
    return <p className={chrome.muted}>Ideas are available to editors and companions on this trip.</p>;
  }

  const filterChips: Array<{ key: TripIdeasFilter; label: string; count?: number }> = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'yours', label: 'Yours', count: counts.yours },
    { key: 'ai', label: 'AI', count: counts.ai },
    { key: 'replies', label: 'With replies', count: counts.replies },
    { key: 'complete', label: 'Complete', count: counts.complete }
  ];

  return (
    <div>
      <p className={chrome.pageSub} style={{ marginTop: 0 }}>
        Trip ideas from the home jotter and itinerary days, including AI suggestions.
      </p>

      <div className={chrome.filterChipRow} role="group" aria-label="Filter ideas">
        {filterChips.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            className={filter === key ? chrome.filterChipOn : chrome.filterChip}
            onClick={() => setFilter(key)}
          >
            {label}
            {count !== undefined ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ideas…"
          aria-label="Search ideas"
        />
        <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className={styles.addRow}>
        <button type="button" className={styles.addBtn} onClick={() => setComposeOpen((v) => !v)}>
          + Add idea
        </button>
      </div>

      {composeOpen ? (
        <div className={styles.composeCard}>
          <textarea
            className={styles.composeInput}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (composeError) setComposeError('');
            }}
            placeholder="Jot an idea for the trip…"
            aria-label="New idea"
            disabled={busy}
            autoFocus
          />
          {composeError ? <p className={styles.composeError}>{composeError}</p> : null}
          <div className={styles.composeActions}>
            <button type="button" className={styles.composeCancel} onClick={() => setComposeOpen(false)}>
              Cancel
            </button>
            <button type="button" className={styles.composeSave} disabled={!draft.trim() || busy} onClick={() => void addIdea()}>
              Add
            </button>
          </div>
        </div>
      ) : null}

      {!filtered.length ? <p className={chrome.muted}>No ideas match this filter yet.</p> : null}

      {filtered.map((idea) => {
        const author = memberForIdea(idea, members);
        const editing = editingId === idea.id;
        const manageable = canManage(idea);
        const canDelete = manageable || (idea.isAi && canEditItinerary);
        const isNew = !idea.isComplete && isIdeaRecentlyAdded(idea.createdAt);
        return (
          <article key={idea.id} className={`${styles.ideaCard} ${idea.isComplete ? styles.ideaCardDone : ''} ${isNew ? styles.ideaCardNew : ''}`}>
            <div className={styles.ideaCardHead}>
              {idea.isAi ? (
                <span className={styles.aiAvatar} style={{ width: 34, height: 34 }} aria-hidden>
                  AI
                </span>
              ) : (
                <TravellerAvatar displayName={author.name} avatarUrl={author.avatarUrl} size={34} />
              )}
              <div className={styles.ideaCardMeta}>
                <div className={styles.ideaCardNameRow}>
                  <p className={styles.ideaCardName}>{author.name}</p>
                  {idea.isAi ? (
                    <span className={`${styles.ideaBadge} ${styles.badgeAi}`}>AI</span>
                  ) : idea.source === 'day' ? (
                    <span className={`${styles.ideaBadge} ${styles.badgeDay}`}>Day idea</span>
                  ) : isUnifiedIdeaYours(idea, spContext, members) ? (
                    <span className={`${styles.ideaBadge} ${styles.badgeYours}`}>Yours</span>
                  ) : null}
                  {isNew ? <span className={`${styles.ideaBadge} ${styles.badgeNew}`}>New</span> : null}
                </div>
                <p className={styles.ideaCardTime}>{formatIdeaTime(idea.createdAt)}</p>
              </div>
              <div className={styles.ideaCardActions}>
                <button type="button" className={styles.replyBtn} onClick={() => setMenuId(null)}>
                  {idea.replyCount ? `${idea.replyCount} repl${idea.replyCount === 1 ? 'y' : 'ies'} ›` : 'No replies'}
                </button>
                {canDelete || manageable ? (
                  <div className={styles.menuWrap}>
                    <button
                      type="button"
                      className={styles.menuBtn}
                      aria-label="Idea actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === idea.id ? null : idea.id);
                      }}
                    >
                      …
                    </button>
                    {menuId === idea.id ? (
                      <div className={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
                        {manageable && !idea.isAi ? (
                          <button
                            type="button"
                            className={styles.menuItem}
                            onClick={() => {
                              setEditingId(idea.id);
                              setEditText(idea.text);
                              setMenuId(null);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        <button type="button" className={styles.menuItem} onClick={() => void toggleComplete(idea)}>
                          {idea.isComplete ? 'Mark open' : 'Mark complete'}
                        </button>
                        <button type="button" className={styles.menuItem} onClick={() => void shareIdea(idea)}>
                          Share
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            className={`${styles.menuItem} ${styles.menuItemDanger}`}
                            onClick={() => void deleteIdea(idea)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {editing ? (
              <>
                <textarea
                  className={styles.editInput}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  aria-label="Edit idea"
                  rows={3}
                />
                <div className={styles.composeActions}>
                  <button type="button" className={styles.composeCancel} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button type="button" className={styles.composeSave} onClick={() => void saveEdit(idea)}>
                    Save
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.ideaText}>{idea.text}</p>
            )}

            {idea.locationLabel ? (
              <p className={styles.locationStamp}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="10.8" r="2" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                {idea.locationLabel}
              </p>
            ) : null}

            <TripIdeaReplies
              row={idea.reminder}
              spContext={spContext}
              members={members}
              canContribute={canContribute}
              canEditItinerary={canEditItinerary}
              onUpdated={() => void refresh()}
              compact
            />
          </article>
        );
      })}

      <div className={styles.banner}>
        <p className={styles.bannerText}>💡 Ideas are better together</p>
        <button type="button" className={styles.bannerBtn} onClick={() => setHowOpen((v) => !v)} aria-expanded={howOpen}>
          How it works
        </button>
      </div>
      {howOpen ? (
        <div className={styles.howPanel} role="region" aria-label="How trip ideas work">
          <p>
            Capture ideas on the home jotter or here in Lists. AI suggestions rotate across your itinerary days and tag
            the stop they relate to.
          </p>
          <p>
            Tap an idea to expand replies — companions can add detail, links, or votes. Mark complete when you have
            booked or decided; completed ideas move to the Complete filter without disappearing.
          </p>
          <p>Use the + Add idea button or the home jotter to start a new one any time.</p>
        </div>
      ) : null}
    </div>
  );
};
