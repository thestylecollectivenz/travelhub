import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { useTripRole } from '../../context/TripRoleContext';
import {
  createJotterIdea,
  deleteJotterIdea,
  JOTTER_IDEAS_CHANGED_EVENT,
  loadJotterIdeas,
  type JotterIdeaRow
} from '../../utils/tripJotterIdeas';
import { MOBILE_OPEN_JOTTER_COMPOSE } from '../../utils/mobileHomePendingAction';
import { consumePendingJotterCompose } from '../../utils/mobileHomePendingAction';
import chrome from './MobileTabChrome.module.css';
import styles from './MobileHome.module.css';

type JotterFilter = 'all' | 'ai' | 'yours';

export const MobileTripJotterList: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const { members } = useTripMembers(trip?.id);
  const { role } = useTripRole();
  const [rows, setRows] = React.useState<JotterIdeaRow[]>([]);
  const [filter, setFilter] = React.useState<JotterFilter>('all');
  const [draft, setDraft] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canContribute = role === 'Editor' || role === 'Companion';

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!trip?.id) {
      setRows([]);
      return;
    }
    const all = await loadJotterIdeas(spContext, trip.id);
    setRows(all);
  }, [trip?.id, spContext]);

  React.useEffect(() => {
    void refresh().catch(console.error);
  }, [refresh]);

  React.useEffect(() => {
    const handler = (): void => {
      void refresh().catch(console.error);
    };
    window.addEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
  }, [refresh]);

  React.useEffect(() => {
    const openCompose = (): void => {
      setComposeOpen(true);
    };
    if (consumePendingJotterCompose()) setComposeOpen(true);
    window.addEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openCompose);
    return () => window.removeEventListener(MOBILE_OPEN_JOTTER_COMPOSE, openCompose);
  }, []);

  const filtered = React.useMemo(() => {
    if (filter === 'ai') return rows.filter((r) => r.isAi);
    if (filter === 'yours') return rows.filter((r) => !r.isAi);
    return rows;
  }, [rows, filter]);

  const addIdea = async (): Promise<void> => {
    const text = draft.trim();
    if (!trip?.id || !text || busy) return;
    setBusy(true);
    try {
      await createJotterIdea(spContext, trip.id, text, members, false);
      setDraft('');
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MobileTripJotterList: add failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (!canContribute) {
    return <p className={chrome.muted}>Ideas are available to editors and companions on this trip.</p>;
  }

  return (
    <div>
      <p className={chrome.pageSub} style={{ marginTop: 0 }}>
        Trip ideas from the home jotter, including AI suggestions.
      </p>

      <div className={chrome.filterChipRow} role="group" aria-label="Filter ideas">
        {(['all', 'yours', 'ai'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? chrome.filterChipOn : chrome.filterChip}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'All' : key === 'yours' ? 'Yours' : 'AI'}
          </button>
        ))}
      </div>

      {composeOpen ? (
        <form
          className={styles.jotterForm}
          onSubmit={(e) => {
            e.preventDefault();
            void addIdea();
          }}
        >
          <input
            className={styles.jotterInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Jot an idea…"
            aria-label="New idea"
            disabled={busy}
            autoFocus
          />
          <button type="submit" className={styles.jotterAddBtn} disabled={!draft.trim() || busy}>
            Add
          </button>
        </form>
      ) : (
        <button type="button" className={chrome.inlinePrimaryBtn} onClick={() => setComposeOpen(true)}>
          + Add idea
        </button>
      )}

      {!filtered.length ? <p className={chrome.muted}>No ideas yet.</p> : null}
      <ul className={styles.jotterList} style={{ marginTop: '0.65rem' }}>
        {filtered.map((idea) => (
          <li key={idea.id} className={styles.jotterItem}>
            <span className={styles.jotterMain}>
              <span className={styles.jotterText}>{idea.text}</span>
              {idea.authorLabel ? <span className={styles.jotterDate}>{idea.authorLabel}</span> : null}
            </span>
            {idea.isAi ? <span className={styles.aiBadge}>AI</span> : null}
            {!idea.isAi ? (
              <button
                type="button"
                className={chrome.textBtn}
                aria-label="Delete idea"
                onClick={() => {
                  void deleteJotterIdea(spContext, idea.id).then(() => refresh());
                }}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};
