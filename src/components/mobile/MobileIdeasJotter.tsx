import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import { ItineraryService } from '../../services/ItineraryService';
import type { Trip } from '../../models';
import {
  buildJotterHomeDisplay,
  createJotterIdea,
  JOTTER_IDEAS_CHANGED_EVENT,
  loadJotterIdeas,
  type JotterDisplayRow,
  type JotterIconKind
} from '../../utils/tripJotterIdeas';
import styles from './MobileHome.module.css';

export interface MobileIdeasJotterProps {
  trip?: Trip;
}

function formatJotterDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function JotterRowIcon({ kind }: { kind: JotterIconKind }): React.ReactElement {
  if (kind === 'place') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="10.8" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === 'photo') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="9" cy="10" r="1.5" fill="currentColor" />
        <path d="m5 17 4-4 3 3 4-5 3 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18h6M10 22h4M12 3a5 5 0 0 1 5 5c0 2.2-1.4 3.3-2.5 4.2-.8.7-1.2 1.1-1.2 2.3h-2.6c0-1.2-.4-1.6-1.2-2.3C10.4 11.3 9 10.2 9 8a5 5 0 0 1 3-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const MobileIdeasJotter: React.FC<MobileIdeasJotterProps> = ({ trip }) => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { members } = useTripMembers(trip?.id);
  const [ideas, setIdeas] = React.useState<JotterDisplayRow[]>([]);
  const [allUserCount, setAllUserCount] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!trip?.id) {
      setIdeas([]);
      setAllUserCount(0);
      return;
    }
    setLoading(true);
    try {
      const entrySvc = new ItineraryService(spContext);
      const [entries, allRows] = await Promise.all([
        entrySvc.getAll(trip.id),
        loadJotterIdeas(spContext, trip.id)
      ]);
      const itineraryTitles = entries
        .filter((e) => !e.parentEntryId)
        .flatMap((e) => [e.title, e.location].filter(Boolean) as string[]);
      setAllUserCount(allRows.filter((r) => !r.isAi).length);
      const rows = await buildJotterHomeDisplay(
        spContext,
        trip.id,
        trip,
        members,
        config.geminiApiKey,
        itineraryTitles,
        showAll ? 12 : 3
      );
      setIdeas(rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MobileIdeasJotter: load failed', err);
    } finally {
      setLoading(false);
    }
  }, [trip, spContext, members, config.geminiApiKey, showAll]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const handler = (): void => {
      void refresh();
    };
    window.addEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(JOTTER_IDEAS_CHANGED_EVENT, handler);
  }, [refresh]);

  const addIdea = async (): Promise<void> => {
    const text = draft.trim();
    if (!trip?.id || !text || saving) return;
    setSaving(true);
    try {
      await createJotterIdea(spContext, trip.id, text, members, false);
      setDraft('');
      setComposeOpen(false);
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MobileIdeasJotter: save failed', err);
    } finally {
      setSaving(false);
    }
  };

  if (!trip) {
    return (
      <section className={styles.homeCard} aria-label="Ideas jotter">
        <h3 className={styles.homeCardTitle}>Ideas jotter</h3>
        <p className={styles.homeCardHint}>Create a trip to capture ideas.</p>
      </section>
    );
  }

  return (
    <section className={styles.homeCard} aria-label="Ideas jotter">
      <div className={styles.homeCardHead}>
        <h3 className={styles.homeCardTitle}>Ideas jotter</h3>
        <button
          type="button"
          className={styles.jotterHeadAdd}
          aria-label="Add idea"
          onClick={() => setComposeOpen((v) => !v)}
        >
          +
        </button>
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
            disabled={saving}
            autoFocus
          />
          <button type="submit" className={styles.jotterAddBtn} disabled={!draft.trim() || saving}>
            Add
          </button>
        </form>
      ) : null}

      {loading && !ideas.length ? <p className={styles.homeCardHint}>Loading ideas…</p> : null}
      <ul className={styles.jotterList}>
        {ideas.map((idea) => (
          <li key={idea.id} className={styles.jotterItem}>
            <span className={`${styles.jotterIcon} ${styles[`jotterIcon_${idea.icon}`]}`} aria-hidden>
              <JotterRowIcon kind={idea.icon} />
            </span>
            <span className={styles.jotterMain}>
              <span className={styles.jotterText}>{idea.text}</span>
              {idea.createdAt && !idea.ephemeral ? (
                <span className={styles.jotterDate}>{formatJotterDate(idea.createdAt)}</span>
              ) : idea.isAi ? (
                <span className={styles.jotterDate}>Just now</span>
              ) : null}
            </span>
            {idea.isAi ? <span className={styles.aiBadge}>AI</span> : null}
          </li>
        ))}
      </ul>

      {allUserCount > 3 ? (
        <button type="button" className={styles.homeCardFooter} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : 'View all notes'}
          <span aria-hidden> ›</span>
        </button>
      ) : null}
    </section>
  );
};
