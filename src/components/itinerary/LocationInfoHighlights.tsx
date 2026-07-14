import * as React from 'react';
import type { ItineraryEntry } from '../../models/ItineraryEntry';
import type { Place } from '../../models/Place';
import { useSpContext } from '../../context/SpContext';
import type { LocationHighlightKind, LocationHighlightRow } from '../../utils/locationInfoEntry';
import { subscribeLocationInfoAIStatus } from '../../utils/locationInfoAIEvents';
import { scheduleLocationInfoAIGeneration } from '../../utils/locationInfoGeneration';
import styles from './LocationInfoHighlights.module.css';

const KIND_ICON: Record<LocationHighlightKind, string> = {
  sight: '🏛',
  food: '🍽',
  drink: '🍷',
  souvenir: '🎁'
};

const KIND_LABEL: Record<LocationHighlightKind, string> = {
  sight: 'Sights',
  food: 'Food',
  drink: 'Drink',
  souvenir: 'Souvenirs'
};

const SECTION_ORDER: LocationHighlightKind[] = ['sight', 'food', 'drink', 'souvenir'];

const SECTION_TO_MERGE: Record<LocationHighlightKind, 'sights' | 'food' | 'drink' | 'souvenirs'> = {
  sight: 'sights',
  food: 'food',
  drink: 'drink',
  souvenir: 'souvenirs'
};

function highlightRowKey(row: LocationHighlightRow): string {
  return `${row.kind}::${row.id}`;
}

export interface LocationInfoHighlightsProps {
  rows: LocationHighlightRow[];
  onChange: (rows: LocationHighlightRow[]) => void;
  readOnly?: boolean;
  emptyHint?: string;
  entry?: ItineraryEntry;
  place?: Place;
  geminiApiKey?: string;
  hasAnyContent?: boolean;
  onGenerationComplete?: () => void;
  onOpenSettings?: () => void;
  /** Optional class for mobile large-touch edit sizing. */
  className?: string;
}

export const LocationInfoHighlights: React.FC<LocationInfoHighlightsProps> = ({
  rows,
  onChange,
  readOnly = false,
  emptyHint = 'Add a Gemini API key in User settings to auto-generate highlights, or add items manually.',
  entry,
  place,
  geminiApiKey = '',
  hasAnyContent = false,
  onGenerationComplete,
  onOpenSettings,
  className
}) => {
  const spContext = useSpContext();
  const [draftLine, setDraftLine] = React.useState('');
  const [draftKind, setDraftKind] = React.useState<LocationHighlightKind>('sight');
  const [loadingSection, setLoadingSection] = React.useState<LocationHighlightKind | 'all' | null>(null);
  const [sectionError, setSectionError] = React.useState<Partial<Record<LocationHighlightKind | 'all', string>>>({});

  const hasKey = Boolean((geminiApiKey || '').trim());

  const entryId = entry?.id;

  React.useEffect(() => {
    if (!entryId) return undefined;
    return subscribeLocationInfoAIStatus(entryId, (detail) => {
      if (detail.loading) {
        setLoadingSection(detail.section === 'all' ? 'all' : (detail.section as LocationHighlightKind) ?? 'all');
        return;
      }
      setLoadingSection(null);
      if (detail.error) {
        const key = detail.section === 'all' ? 'all' : (detail.section as LocationHighlightKind);
        setSectionError((prev) => ({ ...prev, [key]: detail.error }));
      } else if (detail.success) {
        setSectionError({});
        if (onGenerationComplete) onGenerationComplete();
      }
    });
  }, [entryId, onGenerationComplete]);

  const rowsByKind = React.useMemo(() => {
    const map: Record<LocationHighlightKind, LocationHighlightRow[]> = {
      sight: [],
      food: [],
      drink: [],
      souvenir: []
    };
    for (let i = 0; i < rows.length; i++) {
      map[rows[i].kind].push(rows[i]);
    }
    return map;
  }, [rows]);

  const toggle = (key: string): void => {
    onChange(rows.map((x) => (highlightRowKey(x) === key ? { ...x, done: !x.done } : x)));
  };

  const remove = (key: string): void => {
    onChange(rows.filter((x) => highlightRowKey(x) !== key));
  };

  const addLine = (): void => {
    const label = draftLine.trim();
    if (!label) return;
    onChange([
      ...rows,
      { id: `item-${draftKind}-${Date.now()}`, label, done: false, kind: draftKind, source: 'user' }
    ]);
    setDraftLine('');
  };

  const refreshSection = (kind: LocationHighlightKind): void => {
    if (!entry || !place || !hasKey || readOnly) return;
    setSectionError((prev) => ({ ...prev, [kind]: undefined }));
    scheduleLocationInfoAIGeneration({
      spContext,
      entry,
      place,
      apiKey: geminiApiKey,
      section: SECTION_TO_MERGE[kind],
      onComplete: onGenerationComplete
    });
  };

  const doneCount = rows.filter((x) => x.done).length;
  const anyLoading = loadingSection !== null;

  return (
    <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
      {!hasKey && !hasAnyContent && !readOnly ? (
        <p className={styles.noKeyPrompt}>
          Add a Gemini API key in{' '}
          {onOpenSettings ? (
            <button type="button" className={styles.settingsLink} onClick={onOpenSettings}>
              User settings
            </button>
          ) : (
            'User settings'
          )}{' '}
          to auto-generate highlights.
        </p>
      ) : null}

      {SECTION_ORDER.map((kind) => {
        const sectionRows = rowsByKind[kind];
        const isLoading = loadingSection === kind || loadingSection === 'all';
        const err = sectionError[kind] || (loadingSection === 'all' ? sectionError.all : undefined);
        return (
          <div key={kind} className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>
                {KIND_ICON[kind]} {KIND_LABEL[kind]}
              </span>
              {!readOnly && hasKey && entry ? (
                <button
                  type="button"
                  className={styles.refreshBtn}
                  disabled={anyLoading}
                  title={`Refresh ${KIND_LABEL[kind]} with AI`}
                  onClick={() => refreshSection(kind)}
                >
                  {isLoading ? <span className={styles.spinner} aria-hidden /> : '↻'}
                </button>
              ) : null}
            </div>
            {err ? (
              <p className={styles.sectionError}>
                Couldn&apos;t generate highlights. Check your API key in User settings or try again.{' '}
                <button type="button" className={styles.retryLink} onClick={() => refreshSection(kind)}>
                  Retry
                </button>
              </p>
            ) : null}
            {sectionRows.length ? (
              <ul className={styles.list}>
                {sectionRows.map((item) => (
                  <li key={highlightRowKey(item)} className={styles.row}>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={readOnly}
                        onChange={() => toggle(highlightRowKey(item))}
                      />
                      <span className={item.done ? styles.labelDone : undefined}>{item.label}</span>
                    </label>
                    {!readOnly ? (
                      <button type="button" className={styles.removeBtn} onClick={() => remove(highlightRowKey(item))} aria-label="Remove">
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptySection}>No {KIND_LABEL[kind].toLowerCase()} yet.</p>
            )}
          </div>
        );
      })}

      {!rows.length && !SECTION_ORDER.some((k) => rowsByKind[k].length) ? (
        <p className={styles.empty}>{emptyHint}</p>
      ) : null}

      {!readOnly ? (
        <div className={styles.addRow}>
          <select
            className={styles.addKind}
            value={draftKind}
            onChange={(e) => setDraftKind(e.target.value as LocationHighlightKind)}
            aria-label="Type"
          >
            <option value="sight">Sight</option>
            <option value="food">Food</option>
            <option value="drink">Drink</option>
            <option value="souvenir">Souvenir</option>
          </select>
          <input
            className={styles.addInput}
            value={draftLine}
            placeholder="Add item manually"
            onChange={(e) => setDraftLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLine();
              }
            }}
          />
          <button type="button" className={styles.addBtn} onClick={addLine}>
            Add
          </button>
        </div>
      ) : null}
      {rows.length ? (
        <p className={styles.progress}>
          {doneCount} of {rows.length} done
        </p>
      ) : null}
    </div>
  );
};
