import * as React from 'react';
import { isLikelyJournalHtml, plainTextToEditorHtml } from '../../utils/journalRichText';
import styles from './RichTextContent.module.css';

export interface RichTextContentProps {
  html: string;
  className?: string;
}

export const RichTextContent: React.FC<RichTextContentProps> = ({ html, className }) => {
  const safe = React.useMemo(() => {
    const raw = (html || '').trim();
    if (!raw) return '';
    return isLikelyJournalHtml(raw) ? raw : plainTextToEditorHtml(raw);
  }, [html]);

  if (!safe) return null;

  return <div className={`${styles.root} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: safe }} />;
};
