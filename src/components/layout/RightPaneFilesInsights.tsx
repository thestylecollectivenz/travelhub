import * as React from 'react';
import { useAttachments } from '../../context/AttachmentsContext';
import { buildFilesLinksInsights } from '../../utils/filesLinksInsights';
import styles from './RightPaneInsights.module.css';

export const RightPaneFilesInsights: React.FC = () => {
  const { documents, links } = useAttachments();

  const insights = React.useMemo(() => buildFilesLinksInsights(documents, links), [documents, links]);

  const hasIssues =
    insights.duplicateUrls.length > 0 ||
    insights.unlinkedDocuments > 0 ||
    insights.unlinkedLinks > 0 ||
    insights.missingEntryLinks > 0;

  return (
    <section className={styles.root} aria-label="Files and links review">
      <h2 className={styles.heading}>Files review</h2>
      <p className={styles.muted}>Spot duplicates and items that may need linking to a card.</p>
      {!hasIssues ? (
        <p className={styles.muted}>No issues detected.</p>
      ) : (
        <ul className={styles.list}>
          {insights.duplicateUrls.map((dup) => (
            <li key={dup.url} className={`${styles.listItem} ${styles.warnItem}`}>
              Duplicate link ({dup.titles.length}): {dup.titles[0]}
            </li>
          ))}
          {insights.unlinkedDocuments > 0 ? (
            <li className={`${styles.listItem} ${styles.warnItem}`}>
              {insights.unlinkedDocuments} document{insights.unlinkedDocuments === 1 ? '' : 's'} not linked to a card
            </li>
          ) : null}
          {insights.unlinkedLinks > 0 ? (
            <li className={`${styles.listItem} ${styles.warnItem}`}>
              {insights.unlinkedLinks} link{insights.unlinkedLinks === 1 ? '' : 's'} not linked to a card
            </li>
          ) : null}
          {insights.missingEntryLinks > 0 ? (
            <li className={styles.listItem}>
              {insights.missingEntryLinks} file/link{insights.missingEntryLinks === 1 ? '' : 's'} without a day
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
};
