import * as React from 'react';
import { useAttachments } from '../../context/AttachmentsContext';
import { buildFilesLinksInsights } from '../../utils/filesLinksInsights';
import { requestInsightFocus } from '../../utils/insightFocus';
import styles from './RightPaneInsights.module.css';

export const RightPaneFilesInsights: React.FC = () => {
  const { documents, links } = useAttachments();
  const [activeFocus, setActiveFocus] = React.useState<string | null>(null);

  const insights = React.useMemo(() => buildFilesLinksInsights(documents, links), [documents, links]);

  const hasIssues =
    insights.duplicateUrls.length > 0 ||
    insights.unlinkedDocuments > 0 ||
    insights.unlinkedLinks > 0 ||
    insights.missingEntryLinks > 0;

  const focus = (key: string): void => {
    setActiveFocus(key);
    requestInsightFocus('files', key);
  };

  return (
    <section className={styles.root} aria-label="Files and links review">
      <h2 className={styles.heading}>Files review</h2>
      <p className={styles.muted}>Click an issue to show matching items in the main list.</p>
      {!hasIssues ? (
        <p className={styles.muted}>No issues detected.</p>
      ) : (
        <ul className={styles.list}>
          {insights.duplicateUrls.map((dup) => (
            <li key={dup.url}>
              <button
                type="button"
                className={`${styles.listItem} ${styles.clickableItem} ${styles.warnItem} ${activeFocus === `dup:${dup.url}` ? styles.clickableItemActive : ''}`}
                onClick={() => focus(`duplicate:${dup.url}`)}
              >
                Duplicate link ({dup.titles.length}): {dup.titles[0]}
              </button>
            </li>
          ))}
          {insights.unlinkedDocuments > 0 ? (
            <li>
              <button
                type="button"
                className={`${styles.listItem} ${styles.clickableItem} ${styles.warnItem} ${activeFocus === 'unlinked_documents' ? styles.clickableItemActive : ''}`}
                onClick={() => focus('unlinked_documents')}
              >
                {insights.unlinkedDocuments} document{insights.unlinkedDocuments === 1 ? '' : 's'} not linked to a card
              </button>
            </li>
          ) : null}
          {insights.unlinkedLinks > 0 ? (
            <li>
              <button
                type="button"
                className={`${styles.listItem} ${styles.clickableItem} ${styles.warnItem} ${activeFocus === 'unlinked_links' ? styles.clickableItemActive : ''}`}
                onClick={() => focus('unlinked_links')}
              >
                {insights.unlinkedLinks} link{insights.unlinkedLinks === 1 ? '' : 's'} not linked to a card
              </button>
            </li>
          ) : null}
          {insights.missingEntryLinks > 0 ? (
            <li>
              <button
                type="button"
                className={`${styles.listItem} ${styles.clickableItem} ${activeFocus === 'missing_day' ? styles.clickableItemActive : ''}`}
                onClick={() => focus('missing_day')}
              >
                {insights.missingEntryLinks} file/link{insights.missingEntryLinks === 1 ? '' : 's'} without a day
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
};
