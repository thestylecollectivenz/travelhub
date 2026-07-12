import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { useConfig } from '../../context/ConfigContext';
import { useTripMembers } from '../../hooks/useTripMembers';
import type { Trip } from '../../models';
import {
  createJotterIdea,
  ensureJotterDisplayIdeas,
  JOTTER_IDEAS_CHANGED_EVENT,
  type JotterIdeaRow
} from '../../utils/tripJotterIdeas';
import styles from './MobileHome.module.css';

export interface MobileIdeasJotterProps {
  trip?: Trip;
}

export const MobileIdeasJotter: React.FC<MobileIdeasJotterProps> = ({ trip }) => {
  const spContext = useSpContext();
  const { config } = useConfig();
  const { members } = useTripMembers(trip?.id);
  const [ideas, setIdeas] = React.useState<JotterIdeaRow[]>([]);
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!trip?.id) {
      setIdeas([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await ensureJotterDisplayIdeas(
        spContext,
        trip.id,
        trip,
        members,
        config.geminiApiKey,
        3
      );
      setIdeas(rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MobileIdeasJotter: load failed', err);
    } finally {
      setLoading(false);
    }
  }, [trip, spContext, members, config.geminiApiKey]);

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
      <h3 className={styles.homeCardTitle}>Ideas jotter</h3>
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
        />
        <button type="submit" className={styles.jotterAddBtn} disabled={!draft.trim() || saving} aria-label="Add idea">
          +
        </button>
      </form>
      {loading && !ideas.length ? <p className={styles.homeCardHint}>Loading ideas…</p> : null}
      <ul className={styles.jotterList}>
        {ideas.map((idea) => (
          <li key={idea.id} className={styles.jotterItem}>
            <span className={styles.jotterText}>{idea.text}</span>
            {idea.isAi ? <span className={styles.aiBadge}>AI</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
